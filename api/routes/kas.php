<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');
require_once __DIR__.'/../helpers/kas-transitory.php';

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

    // Query transaksi — ambil semua di rentang tanggal, order ASC untuk hitung saldo kumulatif
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

    $sql .= " ORDER BY t.tanggal ASC, t.noBukti ASC, t.createdAt ASC";

    if ($jenis_input_key === 'bankBuku') {
        $rows = bank_ledger_rows($pdo, $entity_id, $jenis_input_id, $rekening_nama, $dari, $sampai);
    } else {
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    // Kelompokkan per noBukti|tanggal — logika dari getKasLedger() src/lib/kas.ts
    $groups = [];
    foreach ($rows as $r) {
        $tanggal_raw = substr($r['tanggal'], 0, 10);
        $extra = $r['extraFieldsJson'] ? json_decode($r['extraFieldsJson'], true) : [];
        $key = $r['noBukti'] . '|' . $tanggal_raw;
        if ($jenis_input_key === 'bankBuku') {
            $key .= '|' . ($extra['rekeningNama'] ?? '') . '|' . (!empty($r['sourceJurnal']) ? 'jurnal|' . $r['entityId'] . '|' . ((float)$r['debit'] > 0 ? 'in' : 'out') : 'bank');
        }

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
                'sourceJurnal'        => !empty($r['sourceJurnal']),
                'allTxIds'            => [],
                'coaRows'             => [],
                'project'             => null,
                'periodeBulanGaji'    => null,
                'periodeTahunGaji'    => null,
                'tanggalNota'         => null,
            ];
        }

        $g = &$groups[$key];
        $g['allTxIds'][] = $r['id'];

        if (!empty($extra['periodeBulanGaji']) && empty($g['periodeBulanGaji'])) {
            $g['periodeBulanGaji'] = (int)$extra['periodeBulanGaji'];
            $g['periodeTahunGaji'] = !empty($extra['periodeTahunGaji']) ? (int)$extra['periodeTahunGaji'] : (int)date('Y', strtotime($r['tanggal']));
        }

        if (!empty($extra['tanggalNota']) && empty($g['tanggalNota'])) {
            $g['tanggalNota'] = (string)$extra['tanggalNota'];
        }

        if ($r['project_code'] && !$g['project']) {
            $g['project'] = ['id' => $r['projectId'], 'code' => $r['project_code'], 'name' => $r['project_name']];
        }

        $is_kas_entry = !empty($extra['isKasEntry']);

        if ($is_kas_entry) {
            $g['hasKasEntry'] = true;
            $g['masuk']       += (float)$r['debit'];
            $g['keluar']      += (float)$r['kredit'];
            if (!empty($extra['rekeningNama']))        $g['rekening']            = $extra['rekeningNama'];
            if (!empty($extra['crossingEntityKeys']))  $g['crossingEntityKeys']  = $extra['crossingEntityKeys'];
            elseif (!empty($extra['crossingEntityKey'])) $g['crossingEntityKeys'] = [$extra['crossingEntityKey']]; // backward compat
            if (!empty($extra['crossingFromEntityKey'])) $g['crossingFromEntityKey'] = $extra['crossingFromEntityKey'];
            if (!empty($extra['crossingGroupId']))     $g['crossingGroupId']     = $extra['crossingGroupId'];
            if (!empty($extra['autoPostedFromJurnal']) && !empty($r['coa_name'])) {
                $g['bankCoaName'] = $r['coa_name'];
                $g['bankCoaId']   = $r['coa_id'] ?? '';
            }
        } else {
            // Jika row berasal dari auto-post jurnal, abaikan baris potongan pajak PPN & PPh
            if (!empty($extra['autoPostedFromJurnal'])) {
                $c_code = (string)($r['coa_code'] ?? '');
                $c_name = (string)($r['coa_name'] ?? '');
                if (
                    in_array($c_code, ['533', '534', '535', '536', '116', '117', '213'], true)
                    || preg_match('/\b(pph|ppn)\b/i', $c_name)
                    || preg_match('/^53[3-6]/', $c_code)
                    || stripos($c_name, 'pajak') !== false
                ) {
                    unset($g);
                    continue;
                }
            }

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

    // Sinkronisasi nominal & nama akun coaRows jika auto-posted dari jurnal agar sesuai akun bank yang dipilih
    foreach ($groups as &$grp) {
        $net_mutasi = ($grp['masuk'] > 0) ? $grp['masuk'] : $grp['keluar'];
        if (!empty($grp['bankCoaName'])) {
            $grp['akunTags'] = [$grp['bankCoaName']];
            $grp['coaRows'] = [
                [
                    'id'            => $grp['allTxIds'][0] ?? uuid4(),
                    'coaAccountId'  => $grp['bankCoaId'] ?? '',
                    'coaName'       => $grp['bankCoaName'],
                    'nominal'       => $net_mutasi,
                    'isDebit'       => $grp['masuk'] > 0,
                    'itemDescription' => null,
                ]
            ];
        } elseif ($net_mutasi > 0 && count($grp['coaRows']) === 1 && $grp['coaRows'][0]['nominal'] != $net_mutasi) {
            $grp['coaRows'][0]['nominal'] = $net_mutasi;
        }
    }
    unset($grp);

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
    $total_masuk = 0.0;
    $total_keluar = 0.0;
    foreach ($groups as &$g) {
        $running += $g['masuk'] - $g['keluar'];
        $g['saldo'] = $running;
        $total_masuk += (float)$g['masuk'];
        $total_keluar += (float)$g['keluar'];
    }
    unset($g);

    // Tampilkan descending (terbaru di atas)
    $display_groups = array_reverse($groups);

    $page_size   = 25;
    $total_count = count($display_groups);
    $total_pages = max(1, (int)ceil($total_count / $page_size));
    $safe_page   = min(max(1, $page), $total_pages);
    $paginated   = array_slice($display_groups, ($safe_page - 1) * $page_size, $page_size);

    $current_running_saldo = get_running_saldo($pdo, $entity_id, $jenis_input_id, $rekening_nama, $current_year);

    json_response([
        'totalCount'    => $total_count,
        'totalPages'    => $total_pages,
        'page'          => $safe_page,
        'saldoAwal'     => (float)$starting_balance,
        'totalMasuk'    => (float)$total_masuk,
        'totalKeluar'   => (float)$total_keluar,
        'saldoAkhir'    => (float)$running,
        'runningSaldo'  => (float)$current_running_saldo,
        'entries'       => array_map(function($g) {
            return [
                'tanggalRaw'          => $g['tanggalRaw'],
                'tanggalNota'         => $g['tanggalNota'],
                'noBukti'             => $g['noBukti'],
                'keterangan'          => $g['keterangan'],
                'akunTags'            => $g['akunTags'],
                'rekening'            => $g['rekening'],
                'sourceJurnal'        => $g['sourceJurnal'],
                'crossingEntityKeys'  => $g['crossingEntityKeys'],
                'crossingFromEntityKey' => $g['crossingFromEntityKey'],
                'masuk'               => $g['masuk'],
                'keluar'              => $g['keluar'],
                'saldo'               => $g['saldo'],
                'allTxIds'            => $g['allTxIds'],
                'coaRows'             => $g['coaRows'],
                'project'             => $g['project'],
                'periodeBulanGaji'    => $g['periodeBulanGaji'],
                'periodeTahunGaji'    => $g['periodeTahunGaji'],
            ];
        }, $paginated),
    ]);
}

// ─── GET /api/kas/running-saldo ────────────────────────────────────────────────
elseif ($method === 'GET' && $sub === 'running-saldo') {
    require_auth();
    $pdo = get_pdo();

    $entity_id       = $_GET['entityId']       ?? '';
    $jenis_input_key = $_GET['jenisInputKey']  ?? 'kasKecil';
    $rekening_nama   = $_GET['rekeningNama']   ?? null;
    $year            = (int)($_GET['year'] ?? date('Y'));

    if (!$entity_id) return error_response('entityId wajib diisi.', 400);

    // Cari jenisInputId dari key atau id
    $stmt = $pdo->prepare("SELECT id FROM JenisInputTransaksi WHERE `key` = ? OR id = ? LIMIT 1");
    $stmt->execute([$jenis_input_key, $jenis_input_key]);
    $jenis_input_id = $stmt->fetchColumn();
    if (!$jenis_input_id) return error_response('Jenis input tidak ditemukan.', 404);

    $saldo = get_running_saldo($pdo, $entity_id, $jenis_input_id, $rekening_nama, $year);
    json_response(['saldo' => (float)$saldo]);
}

// ─── GET /api/kas/saldo-awal ───────────────────────────────────────────────────
elseif ($method === 'GET' && $sub === 'saldo-awal') {
    require_auth();
    $pdo = get_pdo();

    $entity_id          = $_GET['entityId']          ?? '';
    $jenis_input_key_id = $_GET['jenisInputKey']     ?? 'kasKecil';
    $rekening_nama_id   = $_GET['rekeningNamaOrId']  ?? null;
    $sebelum            = $_GET['sebelum']           ?? null;
    $year               = (int)($_GET['year'] ?? date('Y'));

    if (!$entity_id) return error_response('entityId wajib diisi.', 400);

    // Cari jenisInputId dari key atau id
    $stmt = $pdo->prepare("SELECT id FROM JenisInputTransaksi WHERE `key` = ? OR id = ? LIMIT 1");
    $stmt->execute([$jenis_input_key_id, $jenis_input_key_id]);
    $jenis_input_id = $stmt->fetchColumn();
    if (!$jenis_input_id) return error_response('Jenis input tidak ditemukan.', 404);

    if ($sebelum) {
        $saldo = get_saldo_sebelum($pdo, $entity_id, $jenis_input_id, $sebelum, $rekening_nama_id, $year);
    } else {
        $saldo = get_initial_saldo_awal($pdo, $entity_id, $jenis_input_id, $rekening_nama_id, $year);
    }
    json_response(['saldo' => (float)$saldo]);
}

// ─── POST /api/kas/no-bukti ────────────────────────────────────────────────────
elseif ($method === 'POST' && $sub === 'no-bukti') {
    require_auth();
    $pdo = get_pdo();

    $entity_key = $body['entityKey'] ?? '';
    $tanggal    = $body['tanggal']   ?? '';
    if (!$entity_key || !$tanggal) return error_response('entityKey dan tanggal wajib diisi.', 400);

    try {
        json_response(['noBukti' => kas_next_voucher_number($pdo, $entity_key, $tanggal)]);
    } catch (InvalidArgumentException $e) {
        return error_response($e->getMessage(), 400);
    }

}

// ─── POST /api/kas/transaksi ───────────────────────────────────────────────────
elseif ($method === 'POST' && $sub === 'transaksi') {
    $user = require_auth();
    $pdo  = get_pdo();

    require_once __DIR__.'/../helpers/kas-create.php';
    try {
        $pdo->beginTransaction();
        $result = kas_create_transaction($pdo, $user, $body);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        return error_response('Gagal menyimpan transaksi: ' . $e->getMessage(), $e instanceof KasInputException ? $e->getCode() : 500);
    }
    json_response($result);
}

// Seluruh nomor bukti disimpan sebagai satu unit: gagal satu, batalkan semua.
elseif ($method === 'POST' && $sub === 'batch') {
    $user = require_auth();
    $pdo = get_pdo();
    require_once __DIR__.'/../helpers/kas-create.php';
    $transactions = $body['transactions'] ?? null;
    if (!is_array($transactions) || !array_is_list($transactions) || count($transactions) < 1 || count($transactions) > 50) {
        return error_response('Isi 1 sampai 50 transaksi per penyimpanan.', 400);
    }
    try {
        $pdo->beginTransaction();
        $results = [];
        foreach ($transactions as $index => $transaction) {
            if (!is_array($transaction) || !in_array($transaction['jenisInputKey'] ?? '', ['kasKecil','kasBesar','bankBuku'], true)) {
                throw new KasInputException('Jenis transaksi tidak valid.', 400);
            }
            try { $results[] = kas_create_transaction($pdo, $user, $transaction); }
            catch (Throwable $e) { throw new KasInputException('Transaksi ' . ($index + 1) . ': ' . $e->getMessage(), $e instanceof KasInputException ? $e->getCode() : 500); }
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        return error_response('Semua transaksi belum disimpan. ' . $e->getMessage(), $e instanceof KasInputException ? $e->getCode() : 500);
    }
    json_response(['success' => true, 'transactions' => $results]);
}

// ─── DELETE /api/kas/transaksi ─────────────────────────────────────────────────
elseif ($method === 'DELETE' && $sub === 'transaksi') {
    $user = require_auth();
    $pdo  = get_pdo();

    $tx_ids = array_filter((array)($body['txIds'] ?? []));
    if (empty($tx_ids)) return error_response('Tidak ada transaksi untuk dihapus.', 400);
    if (bank_ledger_has_journal_source($pdo, $tx_ids)) return error_response('Kelola transaksi ini dari Entry Jurnal agar seluruh baris jurnal tetap sinkron.', 409);
    transitory_assert_unlinked($pdo,array_values($tx_ids));

    // Cari crossingGroupIds dan projectIds dari source transactions sebelum dihapus
    $placeholders = implode(',', array_fill(0, count($tx_ids), '?'));
    $stmt = $pdo->prepare("SELECT extraFieldsJson, projectId FROM `Transaction` WHERE id IN ($placeholders)");
    $stmt->execute(array_values($tx_ids));
    $source_rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $crossing_group_ids   = [];
    $affected_project_ids = [];
    foreach ($source_rows as $row) {
        $extra = $row['extraFieldsJson'] ? json_decode($row['extraFieldsJson'], true) : [];
        if (!empty($extra['crossingGroupId'])) {
            $crossing_group_ids[] = $extra['crossingGroupId'];
        }
        if (!empty($row['projectId'])) {
            $affected_project_ids[] = $row['projectId'];
        }
    }
    $crossing_group_ids   = array_unique($crossing_group_ids);
    $affected_project_ids = array_unique($affected_project_ids);

    $pdo->beginTransaction();
    try {
        transitory_assert_unlinked($pdo,array_values($tx_ids));
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

    foreach ($affected_project_ids as $pid) {
        if ($pid) sync_project_spend($pdo, $pid);
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
    if (bank_ledger_has_journal_source($pdo, $existing_tx_ids)) return error_response('Kelola transaksi ini dari Entry Jurnal agar seluruh baris jurnal tetap sinkron.', 409);
    transitory_assert_unlinked($pdo,array_values($existing_tx_ids));

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
    $periode_bulan_gaji = !empty($body['periodeBulanGaji']) ? (int)$body['periodeBulanGaji'] : null;
    $periode_tahun_gaji = !empty($body['periodeTahunGaji']) ? (int)$body['periodeTahunGaji'] : (!empty($periode_bulan_gaji) ? (int)date('Y', strtotime($tanggal)) : null);
    $tanggal_nota       = !empty($body['tanggalNota']) ? trim((string)$body['tanggalNota']) : null;

    if (!$entity_key || !$jenis_input_key || !$tanggal || !$no_bukti || !$keterangan || !$arah) {
        return error_response('Data wajib tidak lengkap.', 400);
    }
    if (!in_array($entity_key, $user['entityKeys'] ?? [])) {
        return error_response('Kamu tidak punya akses ke entity ini.', 403);
    }

    try { transitory_guard_coa(array_column((array)$rows,'coaAccountId')); } catch(RuntimeException $e) { return error_response($e->getMessage(),409); }
    $valid_rows = array_values(array_filter($rows, fn($r) => !empty($r['coaAccountId']) && (float)($r['nominal'] ?? 0) > 0));
    if (empty($valid_rows)) return error_response('Isi minimal satu baris akun dengan nominal.', 400);
    $crossing_keys = kas_piutang_crossing_keys($pdo, $entity_key, $arah, $valid_rows, $crossing_keys);

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

    // Temukan crossingGroupId dan projectId dari transaksi lama sebelum dihapus
    $placeholders_old = implode(',', array_fill(0, count($existing_tx_ids), '?'));
    $stmt = $pdo->prepare("SELECT extraFieldsJson, projectId FROM `Transaction` WHERE id IN ($placeholders_old)");
    $stmt->execute(array_values($existing_tx_ids));
    $old_rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $old_crossing_ids = [];
    $old_project_ids  = [];
    foreach ($old_rows as $row) {
        $extra = $row['extraFieldsJson'] ? json_decode($row['extraFieldsJson'], true) : [];
        if (!empty($extra['crossingGroupId'])) $old_crossing_ids[] = $extra['crossingGroupId'];
        if (!empty($row['projectId']))         $old_project_ids[]  = $row['projectId'];
    }
    $old_crossing_ids = array_unique($old_crossing_ids);
    $old_project_ids  = array_unique($old_project_ids);

    $pdo->beginTransaction();
    try {
        transitory_guard_reference($pdo,$entity_id,$no_bukti);
        // Hapus lama
        transitory_assert_unlinked($pdo,array_values($existing_tx_ids));
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
            $row_bulan = !empty($row['periodeBulanGaji']) ? (int)$row['periodeBulanGaji'] : $periode_bulan_gaji;
            $row_tahun = !empty($row['periodeTahunGaji']) ? (int)$row['periodeTahunGaji'] : ($row_bulan ? $periode_tahun_gaji : null);
            if ($row_bulan) {
                $extra['periodeBulanGaji'] = $row_bulan;
                if ($row_tahun) {
                    $extra['periodeTahunGaji'] = $row_tahun;
                }
            }
            if ($tanggal_nota) {
                $extra['tanggalNota'] = $tanggal_nota;
            }
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
        if ($tanggal_nota)       $kas_extra['tanggalNota']         = $tanggal_nota;

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
            create_crossing_entries(
                $pdo,
                $crossing_group_id,
                $crossing_keys,
                $entity_key,
                $jenis_input_key,
                $rekening_id,
                $rekening_nama,
                $proj_id,
                $no_bukti,
                $keterangan,
                $tanggal_dt,
                $valid_rows,
                $staff_id,
                $now
            );
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        return error_response('Gagal mengubah transaksi: ' . $e->getMessage(), 500);
    }

    $all_affected_pids = array_unique(array_filter(array_merge($old_project_ids, [$proj_id])));
    foreach ($all_affected_pids as $pid) {
        if ($pid) sync_project_spend($pdo, $pid);
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
    $coa_updates   = (array)($body['coaUpdates'] ?? []);
    try { transitory_guard_coa(array_column($coa_updates,'newCoaAccountId')); } catch(RuntimeException $e) { return error_response($e->getMessage(),409); } // [{txId, newCoaAccountId}]

    if (empty($tx_ids)) return error_response('txIds wajib diisi.', 400);
    if (bank_ledger_has_journal_source($pdo, array_merge($tx_ids, array_column($coa_updates, 'txId')))) return error_response('Kelola transaksi ini dari Entry Jurnal agar seluruh baris jurnal tetap sinkron.', 409);
    transitory_assert_unlinked($pdo,array_merge(array_values($tx_ids),array_column($coa_updates,'txId')));
    if (!$new_no_bukti || !$new_keterangan) return error_response('No. bukti dan keterangan wajib diisi.', 400);

    $pdo->beginTransaction();
    try {
        transitory_assert_unlinked($pdo,array_merge(array_values($tx_ids),array_column($coa_updates,'txId')));
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
