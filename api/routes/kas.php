<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

require_once __DIR__ . '/../helpers/kas-helpers.php';

// ─── Router ───────────────────────────────────────────────────────────────────
// $segments[0] = 'kas'
// $segments[1] = 'ledger' | 'no-bukti' | 'transaksi'

$sub = $segments[1] ?? '';

// ─── GET /api/kas/ledger ───────────────────────────────────────────────────────
if ($method === 'GET' && $sub === 'ledger') {
    require_auth();
    $pdo = get_pdo();

    $entity_id       = $_GET['entityId']       ?? '';
    $jenis_input_key = $_GET['jenisInputKey']  ?? 'kasKecil';
    $rekening_nama   = $_GET['rekeningNama']   ?? null;
    $dari            = $_GET['dari']           ?? null;
    $sampai          = $_GET['sampai']         ?? null;
    $page            = max(1, (int)($_GET['page'] ?? 1));

    if (!$entity_id) return error_response('entityId wajib diisi.', 400);

    // Cari jenisInputId dari key
    $stmt = $pdo->prepare("SELECT id FROM JenisInputTransaksi WHERE `key` = ?");
    $stmt->execute([$jenis_input_key]);
    $jenis_input_id = $stmt->fetchColumn();
    if (!$jenis_input_id) return error_response('Jenis input tidak ditemukan.', 404);

    // Hitung saldo awal periode
    $current_year = $dari
        ? (int)date('Y', strtotime($dari))
        : ($sampai ? (int)date('Y', strtotime($sampai)) : (int)date('Y'));

    $starting_balance = $dari
        ? get_saldo_sebelum($pdo, $entity_id, $jenis_input_id, $dari, $rekening_nama, $current_year)
        : get_initial_saldo_awal($pdo, $entity_id, $jenis_input_id, $rekening_nama, $current_year);

    // Query transaksi — ambil semua (max 2000), order ASC untuk hitung saldo kumulatif
    $sql = "SELECT t.id, t.tanggal, t.noBukti, t.keterangan, t.debit, t.kredit,
                   t.saldoSetelah, t.extraFieldsJson, t.projectId,
                   c.id as coa_id, c.code as coa_code, c.name as coa_name,
                   p.code as project_code, p.name as project_name
            FROM `Transaction` t
            LEFT JOIN CoaAccount c ON t.coaAccountId = c.id
            LEFT JOIN Project p ON t.projectId = p.id
            WHERE t.entityId = ? AND t.jenisInputId = ?";
    $params = [$entity_id, $jenis_input_id];

    if ($dari) {
        $sql .= " AND t.tanggal >= ?";
        $params[] = $dari . ' 00:00:00';
    }
    if ($sampai) {
        $sql .= " AND t.tanggal <= ?";
        $params[] = $sampai . ' 23:59:59';
    }

    $sql .= " ORDER BY t.tanggal ASC, t.noBukti ASC, t.createdAt ASC LIMIT 2000";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Kelompokkan per noBukti|tanggal — logika dari getKasLedger() src/lib/kas.ts
    $groups = [];
    foreach ($rows as $r) {
        $tanggal_raw = substr($r['tanggal'], 0, 10);
        $key = $r['noBukti'] . '|' . $tanggal_raw;
        $extra = $r['extraFieldsJson'] ? json_decode($r['extraFieldsJson'], true) : [];

        if (!isset($groups[$key])) {
            $groups[$key] = [
                'tanggalRaw'          => $tanggal_raw,
                'noBukti'             => $r['noBukti'],
                'keterangan'          => $r['keterangan'],
                'masuk'               => 0.0,
                'keluar'              => 0.0,
                'saldo'               => 0.0,
                'akunTags'            => [],
                'rekening'            => null,
                'crossingEntityKeys'  => null,
                'crossingFromEntityKey' => null,
                'crossingGroupId'     => null,
                'hasKasEntry'         => false,
                'allTxIds'            => [],
                'coaRows'             => [],
                'project'             => null,
            ];
        }

        $g = &$groups[$key];
        $g['allTxIds'][] = $r['id'];

        if ($r['project_code'] && !$g['project']) {
            $g['project'] = ['id' => $r['projectId'], 'code' => $r['project_code'], 'name' => $r['project_name']];
        }

        $is_kas_entry = !empty($extra['isKasEntry']);

        if ($is_kas_entry) {
            $g['hasKasEntry'] = true;
            $g['masuk']       = (float)$r['debit'];
            $g['keluar']      = (float)$r['kredit'];
            if (!empty($extra['rekeningNama']))        $g['rekening']            = $extra['rekeningNama'];
            if (!empty($extra['crossingEntityKeys']))  $g['crossingEntityKeys']  = $extra['crossingEntityKeys'];
            elseif (!empty($extra['crossingEntityKey'])) $g['crossingEntityKeys'] = [$extra['crossingEntityKey']]; // backward compat
            if (!empty($extra['crossingFromEntityKey'])) $g['crossingFromEntityKey'] = $extra['crossingFromEntityKey'];
            if (!empty($extra['crossingGroupId']))     $g['crossingGroupId']     = $extra['crossingGroupId'];
        } else {
            if ($r['coa_id']) {
                $item_desc = isset($extra['itemDescription']) ? (string)$extra['itemDescription'] : null;
                $g['akunTags'][] = $item_desc ?? $r['coa_name'];
                $g['coaRows'][] = [
                    'id'            => $r['id'],
                    'coaAccountId'  => $r['coa_id'],
                    'coaName'       => $r['coa_name'],
                    'nominal'       => (float)$r['debit'] ?: (float)$r['kredit'],
                    'isDebit'       => (float)$r['debit'] > 0,
                    'itemDescription' => $item_desc,
                ];
            }
        }
        unset($g);
    }

    // Filter per rekening (bankBuku)
    if ($rekening_nama) {
        $groups = array_filter($groups, function($g) use ($rekening_nama) {
            return !$g['hasKasEntry'] || $g['rekening'] === $rekening_nama;
        });
        $groups = array_values($groups);
    } else {
        $groups = array_values($groups);
    }

    // Akumulasi saldo kronologis dari startingBalance
    $running = $starting_balance;
    foreach ($groups as &$g) {
        $running += $g['masuk'] - $g['keluar'];
        $g['saldo'] = $running;
    }
    unset($g);

    // Tampilkan descending (terbaru di atas)
    $display_groups = array_reverse($groups);

    $page_size   = 25;
    $total_count = count($display_groups);
    $total_pages = max(1, (int)ceil($total_count / $page_size));
    $safe_page   = min(max(1, $page), $total_pages);
    $paginated   = array_slice($display_groups, ($safe_page - 1) * $page_size, $page_size);

    json_response([
        'totalCount'  => $total_count,
        'totalPages'  => $total_pages,
        'page'        => $safe_page,
        'entries'     => array_map(function($g) {
            return [
                'tanggalRaw'          => $g['tanggalRaw'],
                'noBukti'             => $g['noBukti'],
                'keterangan'          => $g['keterangan'],
                'akunTags'            => $g['akunTags'],
                'rekening'            => $g['rekening'],
                'crossingEntityKeys'  => $g['crossingEntityKeys'],
                'crossingFromEntityKey' => $g['crossingFromEntityKey'],
                'masuk'               => $g['masuk'],
                'keluar'              => $g['keluar'],
                'saldo'               => $g['saldo'],
                'allTxIds'            => $g['allTxIds'],
                'coaRows'             => $g['coaRows'],
                'project'             => $g['project'],
            ];
        }, $paginated),
    ]);
}

// ─── POST /api/kas/no-bukti ────────────────────────────────────────────────────
elseif ($method === 'POST' && $sub === 'no-bukti') {
    require_auth();
    $pdo = get_pdo();

    $entity_key = $body['entityKey'] ?? '';
    $tanggal    = $body['tanggal']   ?? '';
    if (!$entity_key || !$tanggal) return error_response('entityKey dan tanggal wajib diisi.', 400);

    // Prefix — logika dari generateNoBukti() src/lib/actions/kas.ts
    $prefix_umum = ENTITY_PREFIX_UMUM;
    $prefix_norm = ENTITY_PREFIX;
    $prefix = $prefix_umum[$entity_key] ?? $prefix_norm[$entity_key] ?? strtoupper(substr($entity_key, 0, 2));

    $mm   = date('m', strtotime($tanggal));
    $dd   = date('d', strtotime($tanggal));
    $day_part = $mm . $dd;
    $pattern  = $prefix . $day_part;

    // Cari entity id
    $stmt = $pdo->prepare('SELECT id FROM Entity WHERE `key` = ?');
    $stmt->execute([$entity_key]);
    $entity_id = $stmt->fetchColumn();
    if (!$entity_id) return error_response('Entity tidak ditemukan.', 404);

    $stmt = $pdo->prepare("SELECT noBukti FROM `Transaction` WHERE entityId = ? AND noBukti LIKE ?");
    $stmt->execute([$entity_id, $pattern . '%']);
    $existing = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $max_seq = 0;
    foreach ($existing as $nb) {
        $seq_str = substr($nb, strlen($pattern));
        if (is_numeric($seq_str)) {
            $seq = (int)$seq_str;
            if ($seq > $max_seq) $max_seq = $seq;
        }
    }

    json_response(['noBukti' => $pattern . ($max_seq + 1)]);
}

// ─── POST /api/kas/transaksi ───────────────────────────────────────────────────
elseif ($method === 'POST' && $sub === 'transaksi') {
    $user = require_auth();
    $pdo  = get_pdo();

    $entity_key      = $body['entityKey']      ?? '';
    $jenis_input_key = $body['jenisInputKey']  ?? '';
    $tanggal         = $body['tanggal']        ?? '';
    $no_bukti        = trim($body['noBukti']   ?? '');
    $keterangan      = trim($body['keterangan'] ?? '');
    $arah            = $body['arah']           ?? ''; // 'masuk' | 'keluar'
    $rows            = $body['rows']           ?? [];
    $rekening_id     = $body['rekeningId']     ?? null;
    $crossing_keys   = array_filter((array)($body['crossingEntityKeys'] ?? []));
    $project_id      = $body['projectId']      ?? null;
    $arah_laporan    = $body['arahLaporan']    ?? null;
    $sync_bank_rek_id = $body['syncBukuBankRekeningId'] ?? null;

    // Validasi dasar
    if (!$entity_key || !$jenis_input_key || !$tanggal || !$no_bukti || !$keterangan || !$arah) {
        return error_response('entityKey, jenisInputKey, tanggal, noBukti, keterangan, dan arah wajib diisi.', 400);
    }

    // Cek akses entity
    if (!in_array($entity_key, $user['entityKeys'] ?? [])) {
        return error_response('Kamu tidak punya akses ke entity ini.', 403);
    }

    $valid_rows = array_values(array_filter($rows, fn($r) => !empty($r['coaAccountId']) && (float)($r['nominal'] ?? 0) > 0));
    if (empty($valid_rows)) return error_response('Isi minimal satu baris akun dengan nominal.', 400);

    if ($jenis_input_key === 'bankBuku') {
        if (!$rekening_id) return error_response('Rekening/Bank wajib dipilih untuk transaksi Buku Bank.', 400);
        if (!is_valid_rekening($entity_key, $rekening_id)) {
            return error_response('Rekening yang dipilih tidak sesuai dengan entitas ini.', 400);
        }
    }

    // Cari entity & jenis input
    $stmt = $pdo->prepare('SELECT id FROM Entity WHERE `key` = ?');
    $stmt->execute([$entity_key]);
    $entity_id = $stmt->fetchColumn();
    if (!$entity_id) return error_response('Entity tidak ditemukan.', 404);

    $stmt = $pdo->prepare("SELECT id, nama FROM JenisInputTransaksi WHERE `key` = ?");
    $stmt->execute([$jenis_input_key]);
    $jenis_input = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$jenis_input) return error_response('Jenis input tidak ditemukan.', 404);

    // Cek duplikat noBukti
    $stmt = $pdo->prepare("SELECT id FROM `Transaction` WHERE entityId = ? AND noBukti = ? LIMIT 1");
    $stmt->execute([$entity_id, $no_bukti]);
    if ($stmt->fetchColumn()) return error_response("No. bukti \"$no_bukti\" sudah dipakai di entitas ini.", 409);

    if ($arah === 'masuk' && !empty($crossing_keys)) {
        return error_response('Pemasukan hanya boleh dari entitas yang sama, tidak bisa lintas entitas.', 400);
    }

    // Hitung saldo
    $rekening_nama  = $rekening_id ? get_rekening_nama($entity_key, $rekening_id) : null;
    $kas_coa_id     = resolve_kas_coa($pdo, $jenis_input_key, $entity_key, $rekening_id);
    $total          = array_sum(array_column($valid_rows, 'nominal'));
    $tx_year        = (int)date('Y', strtotime($tanggal));
    $prev_saldo     = get_running_saldo($pdo, $entity_id, $jenis_input['id'], $rekening_nama, $tx_year);
    $new_saldo      = $prev_saldo + ($arah === 'masuk' ? $total : -$total);
    $is_keluar      = ($arah === 'keluar');

    // crossing
    $crossing_group_id = !empty($crossing_keys) ? uuid4() : null;
    $arah_laporan_arr  = is_array($arah_laporan) && count($arah_laporan) > 0 ? $arah_laporan : null;

    $pdo->beginTransaction();
    try {
        $now       = date('Y-m-d H:i:s');
        $staff_id  = $user['staffId'] ?? $user['id'];
        $proj_id   = $project_id ?: null;
        $tanggal_dt = $tanggal . ' 00:00:00';

        $common = [
            'entityId'    => $entity_id,
            'jenisInputId'=> $jenis_input['id'],
            'tanggal'     => $tanggal_dt,
            'noBukti'     => $no_bukti,
            'keterangan'  => $keterangan,
            'saldoSetelah'=> $new_saldo,
            'staffId'     => $staff_id,
            'projectId'   => $proj_id,
        ];

        // Tentukan apakah mode sync kas kecil dari buku bank
        $is_sync_mode = (
            ($jenis_input_key === 'kasKecil' || $jenis_input_key === 'kasBesar')
            && $arah === 'masuk'
            && !empty($sync_bank_rek_id)
        );

        // akunRows — skip jika sync mode (Buku Bank keluar sudah jadi counterpart)
        if (!$is_sync_mode) {
            foreach ($valid_rows as $row) {
                $extra = [];
                if ($arah_laporan_arr)   $extra['arahLaporan']    = $arah_laporan_arr;
                if (!empty($row['keterangan'])) $extra['itemDescription'] = $row['keterangan'];
                if ($crossing_group_id) { $extra['crossingEntityKeys'] = array_values($crossing_keys); $extra['crossingGroupId'] = $crossing_group_id; }
                $stmt = $pdo->prepare(
                    "INSERT INTO `Transaction` (id, entityId, jenisInputId, tanggal, noBukti, keterangan, coaAccountId,
                     debit, kredit, saldoSetelah, extraFieldsJson, staffId, projectId, createdAt)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                );
                $stmt->execute([
                    uuid4(), $common['entityId'], $common['jenisInputId'], $common['tanggal'],
                    $common['noBukti'], $common['keterangan'], $row['coaAccountId'],
                    $is_keluar ? (float)$row['nominal'] : 0,
                    $is_keluar ? 0 : (float)$row['nominal'],
                    $common['saldoSetelah'],
                    $extra ? json_encode($extra) : null,
                    $common['staffId'], $common['projectId'], $now,
                ]);
            }
        }

        // kasEntry
        $kas_extra = ['isKasEntry' => true];
        if ($rekening_nama)      $kas_extra['rekeningNama']        = $rekening_nama;
        if ($crossing_group_id) { $kas_extra['crossingEntityKeys'] = array_values($crossing_keys); $kas_extra['crossingGroupId'] = $crossing_group_id; }
        if ($arah_laporan_arr)   $kas_extra['arahLaporan']         = $arah_laporan_arr;
        if ($proj_id)            $kas_extra['projectId']           = $proj_id;

        $stmt = $pdo->prepare(
            "INSERT INTO `Transaction` (id, entityId, jenisInputId, tanggal, noBukti, keterangan, coaAccountId,
             debit, kredit, saldoSetelah, extraFieldsJson, staffId, projectId, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $stmt->execute([
            uuid4(), $common['entityId'], $common['jenisInputId'], $common['tanggal'],
            $common['noBukti'], $common['keterangan'], $kas_coa_id,
            $is_keluar ? 0 : $total,
            $is_keluar ? $total : 0,
            $common['saldoSetelah'],
            json_encode($kas_extra),
            $common['staffId'], $common['projectId'], $now,
        ]);

        // Crossing entries (saat keluar ke entitas lain → masuk sebagai Jurnal Transaksi di entitas tujuan)
        if ($crossing_group_id && !empty($crossing_keys)) {
            $jurnal_jenis_id = get_or_create_jurnal_transaksi_jenis($pdo);
            $hutang_code     = HUTANG_COA_CODE[$entity_key] ?? null;
            $hutang_coa_id   = null;
            if ($hutang_code) {
                $stmt2 = $pdo->prepare('SELECT id FROM CoaAccount WHERE code = ?');
                $stmt2->execute([$hutang_code]);
                $hutang_coa_id = $stmt2->fetchColumn() ?: null;
            }
            $primary_coa_id = $valid_rows[0]['coaAccountId'] ?? null;
            $debit_target   = resolve_crossing_debit_coa($pdo, $primary_coa_id);

            foreach ($crossing_keys as $cross_key) {
                $stmt3 = $pdo->prepare('SELECT id FROM Entity WHERE `key` = ?');
                $stmt3->execute([$cross_key]);
                $cross_entity_id = $stmt3->fetchColumn();
                if (!$cross_entity_id) continue;

                $cross_common_extra_base = [
                    'isCrossingEntry'          => true,
                    'crossingGroupId'          => $crossing_group_id,
                    'crossingFromEntityKey'    => $entity_key,
                    'crossingFromJenisInputKey'=> $jenis_input_key,
                    'crossingFromRekeningId'   => $rekening_id,
                    'crossingFromRekeningNama' => $rekening_nama,
                ];
                if ($proj_id) $cross_common_extra_base['projectId'] = $proj_id;

                // Baris debit (PIUTANG atau BEBAN)
                if ($debit_target) {
                    $ex = array_merge($cross_common_extra_base, ['crossingRole' => $debit_target['role']]);
                    $stmt4 = $pdo->prepare(
                        "INSERT INTO `Transaction` (id, entityId, jenisInputId, tanggal, noBukti, keterangan, coaAccountId,
                         debit, kredit, saldoSetelah, extraFieldsJson, staffId, projectId, createdAt)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                    );
                    $stmt4->execute([
                        uuid4(), $cross_entity_id, $jurnal_jenis_id, $tanggal_dt,
                        $no_bukti, $keterangan, $debit_target['coaAccountId'],
                        $total, 0, 0, json_encode($ex), $staff_id, $proj_id, $now,
                    ]);
                }

                // Baris kredit (HUTANG entitas asal)
                if ($hutang_coa_id) {
                    $ex = array_merge($cross_common_extra_base, [
                        'crossingRole'        => 'HUTANG',
                        'originalHutangCoaCode' => $hutang_code,
                    ]);
                    $stmt5 = $pdo->prepare(
                        "INSERT INTO `Transaction` (id, entityId, jenisInputId, tanggal, noBukti, keterangan, coaAccountId,
                         debit, kredit, saldoSetelah, extraFieldsJson, staffId, projectId, createdAt)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                    );
                    $stmt5->execute([
                        uuid4(), $cross_entity_id, $jurnal_jenis_id, $tanggal_dt,
                        $no_bukti, $keterangan, $hutang_coa_id,
                        0, $total, 0, json_encode($ex), $staff_id, $proj_id, $now,
                    ]);
                }
            }
        }

        // Otomatis buat Termin jika uang masuk dan ada projectId
        // Logika: 1:1 dengan bagian terminCreate di createKasTransaction src/lib/actions/kas.ts
        if (!$is_keluar && $proj_id) {
            $stmt_p = $pdo->prepare("SELECT id, contractValue FROM Project WHERE id = ?");
            $stmt_p->execute([$proj_id]);
            $project = $stmt_p->fetch(PDO::FETCH_ASSOC);
            if ($project) {
                $stmt_t = $pdo->prepare("SELECT percentage FROM Termin WHERE projectId = ?");
                $stmt_t->execute([$proj_id]);
                $existing_pcts = array_column($stmt_t->fetchAll(PDO::FETCH_ASSOC), 'percentage');
                $termin_count  = count($existing_pcts);
                $max_pct       = empty($existing_pcts) ? 0 : max($existing_pcts);
                $new_pct       = compute_new_termin_percentage((float)$project['contractValue'], array_map('intval', $existing_pcts), $total);
                $delta_pct     = max(0, $new_pct - $max_pct);
                $termin_ke     = $termin_count + 1;
                $status        = $new_pct >= 80 ? 'ON_TRACK' : 'AT_RISK';

                $pdo->prepare(
                    "INSERT INTO Termin (id, projectId, name, percentage, status, createdAt) VALUES (?, ?, ?, ?, ?, ?)"
                )->execute([uuid4(), $proj_id, "Termin $termin_ke ($delta_pct% Kontrak)", $new_pct, $status, $now]);

                if ($new_pct >= 100) {
                    $pdo->prepare("UPDATE Project SET status = 'COMPLETED' WHERE id = ?")->execute([$proj_id]);
                }
            }
        }

        $pdo->commit();

        // Auto-sync Kas Kecil masuk dari Buku Bank
        if ($is_sync_mode) {
            $stmt_bj = $pdo->prepare("SELECT id FROM JenisInputTransaksi WHERE `key` = 'bankBuku'");
            $stmt_bj->execute();
            $bank_jenis_id = $stmt_bj->fetchColumn();
            if ($bank_jenis_id) {
                $sync_rek_nama  = get_rekening_nama($entity_key, $sync_bank_rek_id);
                $bank_prev      = get_running_saldo($pdo, $entity_id, $bank_jenis_id, $sync_rek_nama, $tx_year);
                $bank_new_saldo = $bank_prev - $total;
                $bank_coa_id    = resolve_kas_coa($pdo, 'bankBuku', $entity_key, $sync_bank_rek_id);
                $sync_extra     = json_encode(['isKasEntry' => true, 'rekeningNama' => $sync_rek_nama, 'syncFromKasKecil' => true]);
                $pdo->prepare(
                    "INSERT INTO `Transaction` (id, entityId, jenisInputId, tanggal, noBukti, keterangan, coaAccountId,
                     debit, kredit, saldoSetelah, extraFieldsJson, staffId, projectId, createdAt)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                )->execute([
                    uuid4(), $entity_id, $bank_jenis_id, $tanggal_dt,
                    $no_bukti, "[Auto] $keterangan", $bank_coa_id,
                    0, $total, $bank_new_saldo, $sync_extra,
                    $staff_id, $proj_id, date('Y-m-d H:i:s'),
                ]);
            }
        }

        log_activity($user['id'], "Input transaksi {$jenis_input['nama']} – $no_bukti", 'FINANCIAL_CHANGE', [
            'entityKey' => $entity_key, 'noBukti' => $no_bukti, 'total' => $total,
            'arah' => $arah, 'keterangan' => $keterangan,
        ]);

        json_response(['success' => true]);

    } catch (Throwable $e) {
        $pdo->rollBack();
        error_response('Gagal menyimpan transaksi: ' . $e->getMessage(), 500);
    }
}

// ─── DELETE /api/kas/transaksi ─────────────────────────────────────────────────
elseif ($method === 'DELETE' && $sub === 'transaksi') {
    $user = require_auth();
    $pdo  = get_pdo();

    $tx_ids = array_filter((array)($body['txIds'] ?? []));
    if (empty($tx_ids)) return error_response('Tidak ada transaksi untuk dihapus.', 400);

    // Cari crossingGroupIds dari source transactions
    $placeholders = implode(',', array_fill(0, count($tx_ids), '?'));
    $stmt = $pdo->prepare("SELECT extraFieldsJson FROM `Transaction` WHERE id IN ($placeholders)");
    $stmt->execute(array_values($tx_ids));
    $source_txs = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $crossing_group_ids = [];
    foreach ($source_txs as $json) {
        $extra = $json ? json_decode($json, true) : [];
        if (!empty($extra['crossingGroupId'])) {
            $crossing_group_ids[] = $extra['crossingGroupId'];
        }
    }
    $crossing_group_ids = array_unique($crossing_group_ids);

    $pdo->beginTransaction();
    try {
        $pdo->prepare("DELETE FROM `Transaction` WHERE id IN ($placeholders)")->execute(array_values($tx_ids));

        foreach ($crossing_group_ids as $gid) {
            $pdo->prepare(
                "DELETE FROM `Transaction` WHERE JSON_VALUE(extraFieldsJson, '$.crossingGroupId') = ?"
            )->execute([$gid]);
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        return error_response('Gagal menghapus transaksi: ' . $e->getMessage(), 500);
    }

    log_activity($user['id'], 'Hapus transaksi (' . count($tx_ids) . ' baris)', 'FINANCIAL_CHANGE', ['txIds' => $tx_ids]);
    json_response(['success' => true]);
}

// ─── PUT /api/kas/transaksi (replace) ─────────────────────────────────────────
elseif ($method === 'PUT' && $sub === 'transaksi') {
    $user = require_auth();
    $pdo  = get_pdo();

    $existing_tx_ids = array_filter((array)($body['existingTxIds'] ?? []));
    if (empty($existing_tx_ids)) return error_response('Tidak ada transaksi lama untuk diganti.', 400);

    $entity_key      = $body['entityKey']      ?? '';
    $jenis_input_key = $body['jenisInputKey']  ?? '';
    $tanggal         = $body['tanggal']        ?? '';
    $no_bukti        = trim($body['noBukti']   ?? '');
    $keterangan      = trim($body['keterangan'] ?? '');
    $arah            = $body['arah']           ?? '';
    $rows            = $body['rows']           ?? [];
    $rekening_id     = $body['rekeningId']     ?? null;
    $crossing_keys   = array_filter((array)($body['crossingEntityKeys'] ?? []));
    $project_id      = $body['projectId']      ?? null;
    $arah_laporan    = $body['arahLaporan']    ?? null;

    if (!$entity_key || !$jenis_input_key || !$tanggal || !$no_bukti || !$keterangan || !$arah) {
        return error_response('Data wajib tidak lengkap.', 400);
    }
    if (!in_array($entity_key, $user['entityKeys'] ?? [])) {
        return error_response('Kamu tidak punya akses ke entity ini.', 403);
    }

    $valid_rows = array_values(array_filter($rows, fn($r) => !empty($r['coaAccountId']) && (float)($r['nominal'] ?? 0) > 0));
    if (empty($valid_rows)) return error_response('Isi minimal satu baris akun dengan nominal.', 400);

    if ($jenis_input_key === 'bankBuku') {
        if (!$rekening_id) return error_response('Rekening/Bank wajib dipilih.', 400);
        if (!is_valid_rekening($entity_key, $rekening_id)) return error_response('Rekening tidak sesuai entitas.', 400);
    }

    $stmt = $pdo->prepare('SELECT id FROM Entity WHERE `key` = ?');
    $stmt->execute([$entity_key]);
    $entity_id = $stmt->fetchColumn();
    if (!$entity_id) return error_response('Entity tidak ditemukan.', 404);

    $stmt = $pdo->prepare("SELECT id, nama FROM JenisInputTransaksi WHERE `key` = ?");
    $stmt->execute([$jenis_input_key]);
    $jenis_input = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$jenis_input) return error_response('Jenis input tidak ditemukan.', 404);

    // Temukan crossingGroupId dari transaksi lama sebelum dihapus
    $placeholders_old = implode(',', array_fill(0, count($existing_tx_ids), '?'));
    $stmt = $pdo->prepare("SELECT extraFieldsJson FROM `Transaction` WHERE id IN ($placeholders_old)");
    $stmt->execute(array_values($existing_tx_ids));
    $old_txs = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $old_crossing_ids = [];
    foreach ($old_txs as $json) {
        $extra = $json ? json_decode($json, true) : [];
        if (!empty($extra['crossingGroupId'])) $old_crossing_ids[] = $extra['crossingGroupId'];
    }
    $old_crossing_ids = array_unique($old_crossing_ids);

    $pdo->beginTransaction();
    try {
        // Hapus lama
        $pdo->prepare("DELETE FROM `Transaction` WHERE id IN ($placeholders_old)")->execute(array_values($existing_tx_ids));
        foreach ($old_crossing_ids as $gid) {
            $pdo->prepare("DELETE FROM `Transaction` WHERE JSON_VALUE(extraFieldsJson, '$.crossingGroupId') = ?")->execute([$gid]);
        }

        // Hitung saldo baru
        $rekening_nama = $rekening_id ? get_rekening_nama($entity_key, $rekening_id) : null;
        $kas_coa_id    = resolve_kas_coa($pdo, $jenis_input_key, $entity_key, $rekening_id);
        $total         = array_sum(array_column($valid_rows, 'nominal'));
        $tx_year       = (int)date('Y', strtotime($tanggal));
        $prev_saldo    = get_running_saldo($pdo, $entity_id, $jenis_input['id'], $rekening_nama, $tx_year);
        $new_saldo     = $prev_saldo + ($arah === 'masuk' ? $total : -$total);
        $is_keluar     = ($arah === 'keluar');

        if ($arah === 'masuk' && !empty($crossing_keys)) {
            $pdo->rollBack();
            return error_response('Pemasukan tidak bisa lintas entitas.', 400);
        }

        $crossing_group_id = !empty($crossing_keys) ? uuid4() : null;
        $arah_laporan_arr  = is_array($arah_laporan) && count($arah_laporan) > 0 ? $arah_laporan : null;

        $now      = date('Y-m-d H:i:s');
        $staff_id = $user['staffId'] ?? $user['id'];
        $proj_id  = $project_id ?: null;
        $tanggal_dt = $tanggal . ' 00:00:00';

        // akunRows
        foreach ($valid_rows as $row) {
            $extra = [];
            if ($arah_laporan_arr)           $extra['arahLaporan']    = $arah_laporan_arr;
            if (!empty($row['keterangan']))  $extra['itemDescription'] = $row['keterangan'];
            if ($crossing_group_id) { $extra['crossingEntityKeys'] = array_values($crossing_keys); $extra['crossingGroupId'] = $crossing_group_id; }
            $pdo->prepare(
                "INSERT INTO `Transaction` (id, entityId, jenisInputId, tanggal, noBukti, keterangan, coaAccountId,
                 debit, kredit, saldoSetelah, extraFieldsJson, staffId, projectId, createdAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )->execute([
                uuid4(), $entity_id, $jenis_input['id'], $tanggal_dt,
                $no_bukti, $keterangan, $row['coaAccountId'],
                $is_keluar ? (float)$row['nominal'] : 0,
                $is_keluar ? 0 : (float)$row['nominal'],
                $new_saldo, $extra ? json_encode($extra) : null,
                $staff_id, $proj_id, $now,
            ]);
        }

        // kasEntry
        $kas_extra = ['isKasEntry' => true];
        if ($rekening_nama)      $kas_extra['rekeningNama']        = $rekening_nama;
        if ($crossing_group_id) { $kas_extra['crossingEntityKeys'] = array_values($crossing_keys); $kas_extra['crossingGroupId'] = $crossing_group_id; }
        if ($arah_laporan_arr)   $kas_extra['arahLaporan']         = $arah_laporan_arr;
        if ($proj_id)            $kas_extra['projectId']           = $proj_id;

        $pdo->prepare(
            "INSERT INTO `Transaction` (id, entityId, jenisInputId, tanggal, noBukti, keterangan, coaAccountId,
             debit, kredit, saldoSetelah, extraFieldsJson, staffId, projectId, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )->execute([
            uuid4(), $entity_id, $jenis_input['id'], $tanggal_dt,
            $no_bukti, $keterangan, $kas_coa_id,
            $is_keluar ? 0 : $total,
            $is_keluar ? $total : 0,
            $new_saldo, json_encode($kas_extra),
            $staff_id, $proj_id, $now,
        ]);

        // Crossing entries
        if ($crossing_group_id && !empty($crossing_keys)) {
            $jurnal_jenis_id = get_or_create_jurnal_transaksi_jenis($pdo);
            $hutang_code     = HUTANG_COA_CODE[$entity_key] ?? null;
            $hutang_coa_id   = null;
            if ($hutang_code) {
                $s = $pdo->prepare('SELECT id FROM CoaAccount WHERE code = ?');
                $s->execute([$hutang_code]);
                $hutang_coa_id = $s->fetchColumn() ?: null;
            }
            $primary_coa_id = $valid_rows[0]['coaAccountId'] ?? null;
            $debit_target   = resolve_crossing_debit_coa($pdo, $primary_coa_id);

            foreach ($crossing_keys as $cross_key) {
                $s = $pdo->prepare('SELECT id FROM Entity WHERE `key` = ?');
                $s->execute([$cross_key]);
                $cross_entity_id = $s->fetchColumn();
                if (!$cross_entity_id) continue;

                $base_extra = [
                    'isCrossingEntry' => true, 'crossingGroupId' => $crossing_group_id,
                    'crossingFromEntityKey' => $entity_key, 'crossingFromJenisInputKey' => $jenis_input_key,
                    'crossingFromRekeningId' => $rekening_id, 'crossingFromRekeningNama' => $rekening_nama,
                ];
                if ($proj_id) $base_extra['projectId'] = $proj_id;

                if ($debit_target) {
                    $pdo->prepare(
                        "INSERT INTO `Transaction` (id, entityId, jenisInputId, tanggal, noBukti, keterangan, coaAccountId,
                         debit, kredit, saldoSetelah, extraFieldsJson, staffId, projectId, createdAt)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                    )->execute([
                        uuid4(), $cross_entity_id, $jurnal_jenis_id, $tanggal_dt,
                        $no_bukti, $keterangan, $debit_target['coaAccountId'],
                        $total, 0, 0,
                        json_encode(array_merge($base_extra, ['crossingRole' => $debit_target['role']])),
                        $staff_id, $proj_id, $now,
                    ]);
                }
                if ($hutang_coa_id) {
                    $pdo->prepare(
                        "INSERT INTO `Transaction` (id, entityId, jenisInputId, tanggal, noBukti, keterangan, coaAccountId,
                         debit, kredit, saldoSetelah, extraFieldsJson, staffId, projectId, createdAt)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                    )->execute([
                        uuid4(), $cross_entity_id, $jurnal_jenis_id, $tanggal_dt,
                        $no_bukti, $keterangan, $hutang_coa_id,
                        0, $total, 0,
                        json_encode(array_merge($base_extra, ['crossingRole' => 'HUTANG', 'originalHutangCoaCode' => $hutang_code])),
                        $staff_id, $proj_id, $now,
                    ]);
                }
            }
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        return error_response('Gagal mengubah transaksi: ' . $e->getMessage(), 500);
    }

    log_activity($user['id'], "Edit transaksi – $no_bukti", 'FINANCIAL_CHANGE', [
        'entityKey' => $entity_key, 'noBukti' => $no_bukti, 'total' => $total, 'arah' => $arah,
    ]);
    json_response(['success' => true]);
}

// ─── PATCH /api/kas/transaksi (update keterangan/COA) ─────────────────────────
elseif ($method === 'PATCH' && $sub === 'transaksi') {
    $user = require_auth();
    $pdo  = get_pdo();

    $tx_ids        = array_filter((array)($body['txIds'] ?? []));
    $new_no_bukti  = trim($body['newNoBukti']   ?? '');
    $new_keterangan= trim($body['newKeterangan'] ?? '');
    $coa_updates   = (array)($body['coaUpdates'] ?? []); // [{txId, newCoaAccountId}]

    if (empty($tx_ids)) return error_response('txIds wajib diisi.', 400);
    if (!$new_no_bukti || !$new_keterangan) return error_response('No. bukti dan keterangan wajib diisi.', 400);

    $pdo->beginTransaction();
    try {
        $placeholders = implode(',', array_fill(0, count($tx_ids), '?'));
        $pdo->prepare(
            "UPDATE `Transaction` SET noBukti = ?, keterangan = ? WHERE id IN ($placeholders)"
        )->execute(array_merge([$new_no_bukti, $new_keterangan], array_values($tx_ids)));

        foreach ($coa_updates as $u) {
            if (empty($u['txId']) || empty($u['newCoaAccountId'])) continue;
            $pdo->prepare("UPDATE `Transaction` SET coaAccountId = ? WHERE id = ?")
                ->execute([$u['newCoaAccountId'], $u['txId']]);
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        return error_response('Gagal mengupdate transaksi: ' . $e->getMessage(), 500);
    }

    log_activity($user['id'], "Update keterangan/COA transaksi – $new_no_bukti", 'FINANCIAL_CHANGE', ['txIds' => $tx_ids]);
    json_response(['success' => true]);
}

else {
    error_response('Endpoint tidak ditemukan.', 404);
}
