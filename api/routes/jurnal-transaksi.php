<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

require_once __DIR__ . '/../helpers/kas-helpers.php';

// ─── Router ───────────────────────────────────────────────────────────────────
// $segments[0] = 'jurnal-transaksi'
// $segments[1] = '' (list / save) | ''  (DELETE juga ke root)

$sub = $segments[1] ?? '';

// ─── GET /api/jurnal-transaksi ─────────────────────────────────────────────────
// Logika: 1:1 dengan getJurnalTransaksiHistory() di src/lib/jurnal-transaksi.ts
if ($method === 'GET' && $sub === '') {
    require_auth();
    $pdo = get_pdo();

    $entity_id = $_GET['entityId'] ?? '';
    $dari      = $_GET['dari']     ?? null;
    $sampai    = $_GET['sampai']   ?? null;
    $page      = max(1, (int)($_GET['page'] ?? 1));

    if (!$entity_id) return error_response('entityId wajib diisi.', 400);

    // Cari jenisInputId
    $stmt = $pdo->prepare("SELECT id FROM JenisInputTransaksi WHERE `key` = 'jurnalTransaksi'");
    $stmt->execute();
    $jenis_input_id = $stmt->fetchColumn();
    if (!$jenis_input_id) {
        return json_response(['groups' => [], 'totalPages' => 1, 'page' => $page]);
    }

    // Tanggal filter
    $where_parts = ['entityId = ?', 'jenisInputId = ?'];
    $params      = [$entity_id, $jenis_input_id];
    if ($dari) {
        $where_parts[] = 'tanggal >= ?';
        $params[] = $dari . ' 00:00:00';
    }
    if ($sampai) {
        $where_parts[] = 'tanggal <= ?';
        $params[] = $sampai . ' 23:59:59';
    }
    $where_sql = implode(' AND ', $where_parts);

    // Distinct noBukti ordered by tanggal DESC — ambil semua dulu lalu paginate di PHP (pola dari getJurnalTransaksiHistory)
    $stmt = $pdo->prepare(
        "SELECT DISTINCT noBukti, MIN(tanggal) as tanggal_min
         FROM `Transaction`
         WHERE $where_sql
         GROUP BY noBukti
         ORDER BY tanggal_min DESC, noBukti DESC"
    );
    $stmt->execute($params);
    $all_no_buktis_raw = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $all_no_buktis = array_column($all_no_buktis_raw, 'noBukti');

    $page_size   = 25;
    $total_pages = max(1, (int)ceil(count($all_no_buktis) / $page_size));
    $paged_nbs   = array_slice($all_no_buktis, ($page - 1) * $page_size, $page_size);

    if (empty($paged_nbs)) {
        return json_response(['groups' => [], 'totalPages' => $total_pages, 'page' => $page]);
    }

    // Ambil semua rows untuk noBukti yang di-page
    $nb_ph = implode(',', array_fill(0, count($paged_nbs), '?'));
    $stmt  = $pdo->prepare(
        "SELECT t.id, t.tanggal, t.noBukti, t.keterangan, t.debit, t.kredit, t.projectId,
                c.id as coa_id, c.code as coa_code, c.name as coa_name,
                p.id as project_id_val, p.code as project_code, p.name as project_name
         FROM `Transaction` t
         LEFT JOIN CoaAccount c ON t.coaAccountId = c.id
         LEFT JOIN Project p ON t.projectId = p.id
         WHERE t.entityId = ? AND t.jenisInputId = ? AND t.noBukti IN ($nb_ph)
         ORDER BY t.tanggal DESC, t.noBukti DESC, t.createdAt ASC"
    );
    $stmt->execute(array_merge([$entity_id, $jenis_input_id], $paged_nbs));
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Bangun grouped map, urut sesuai paged_nbs
    $grouped = [];
    foreach ($paged_nbs as $nb) {
        $grouped[$nb] = [
            'noBukti'     => $nb,
            'tanggal'     => '',
            'tanggalRaw'  => '',
            'keterangan'  => '',
            'projectId'   => null,
            'project'     => null,
            'rows'        => [],
            'totalDebit'  => 0.0,
            'totalKredit' => 0.0,
            'allTxIds'    => [],
        ];
    }

    foreach ($rows as $r) {
        $g = &$grouped[$r['noBukti']];
        if (!$g) continue;

        if (!$g['tanggalRaw']) {
            $g['tanggalRaw']  = $r['tanggal'];
            $g['keterangan']  = $r['keterangan'];
            $g['projectId']   = $r['projectId'];
            $g['project']     = $r['project_id_val']
                ? ['id' => $r['project_id_val'], 'code' => $r['project_code'], 'name' => $r['project_name']]
                : null;
        } elseif (!$g['projectId'] && $r['projectId']) {
            $g['projectId'] = $r['projectId'];
            $g['project']   = $r['project_id_val']
                ? ['id' => $r['project_id_val'], 'code' => $r['project_code'], 'name' => $r['project_name']]
                : null;
        }

        $debit  = (float)$r['debit'];
        $kredit = (float)$r['kredit'];
        $g['rows'][] = [
            'coaAccountId' => $r['coa_id']   ?? '',
            'coaCode'      => $r['coa_code']  ?? '—',
            'coaName'      => $r['coa_name']  ?? '—',
            'keterangan'   => $r['keterangan'],
            'debit'        => $debit,
            'kredit'       => $kredit,
        ];
        $g['allTxIds'][]   = $r['id'];
        $g['totalDebit']  += $debit;
        $g['totalKredit'] += $kredit;
        unset($g);
    }

    $groups = array_values(array_filter(
        array_map(fn($nb) => $grouped[$nb] ?? null, $paged_nbs)
    ));

    json_response(['groups' => $groups, 'totalPages' => $total_pages, 'page' => $page]);
}

// ─── POST /api/jurnal-transaksi ────────────────────────────────────────────────
// Logika: 1:1 dengan saveJurnalTransaksi() di src/lib/actions/jurnal-transaksi.ts
elseif ($method === 'POST' && $sub === '') {
    $user = require_auth();
    $pdo  = get_pdo();

    $tanggal     = trim($body['tanggal']     ?? '');
    $entity_key  = trim($body['entityKey']   ?? '');
    $no_bukti    = trim($body['noBukti']     ?? '');
    $keterangan  = trim($body['keterangan']  ?? '');
    $edit_no_bukti = trim($body['editNoBukti'] ?? '');
    $project_id  = trim($body['projectId']   ?? '') ?: null;

    if (!$tanggal)    return error_response('Tanggal wajib diisi.', 400);
    if (!$no_bukti)   return error_response('No. Bukti wajib diisi.', 400);
    if (!$entity_key) return error_response('Entity tidak ditemukan.', 400);

    if (!in_array($entity_key, $user['entityKeys'] ?? [])) {
        return error_response('Kamu tidak punya akses ke entity ini.', 403);
    }

    // rows bisa berupa JSON string atau array
    $rows_raw = $body['rows'] ?? '[]';
    $rows = is_array($rows_raw) ? $rows_raw : json_decode($rows_raw, true);
    if (!is_array($rows)) return error_response('Format baris tidak valid.', 400);

    $valid_rows = array_values(array_filter(
        $rows, fn($r) => !empty($r['coaAccountId']) && ((float)($r['debit'] ?? 0) > 0 || (float)($r['kredit'] ?? 0) > 0)
    ));
    if (empty($valid_rows)) return error_response('Isi minimal satu baris akun dengan nominal.', 400);

    // Resolve entity
    $stmt = $pdo->prepare('SELECT id, name FROM Entity WHERE `key` = ?');
    $stmt->execute([$entity_key]);
    $entity = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$entity) return error_response('Entity tidak ditemukan.', 404);

    // Pastikan jenis input jurnalTransaksi ada
    $jenis_input_id = get_or_create_jurnal_transaksi_jenis($pdo);

    // Cari COA semua rows sekaligus
    $coa_ids = array_values(array_unique(array_column($valid_rows, 'coaAccountId')));
    $coa_ph  = implode(',', array_fill(0, count($coa_ids), '?'));
    $stmt    = $pdo->prepare("SELECT id, code, name, kategori, reportType FROM CoaAccount WHERE id IN ($coa_ph)");
    $stmt->execute($coa_ids);
    $coa_list = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $coa_map  = [];
    foreach ($coa_list as $c) $coa_map[$c['id']] = $c;

    // Bank COA map untuk auto-post
    $bank_coa_map         = build_bank_coa_map();                          // code => [rekeningId, entityKey, rekeningNama]
    $kas_kecil_code_to_ek = array_flip(KAS_KECIL_COA);                    // code => entityKey
    $kas_besar_code_to_ek = array_flip(KAS_BESAR_COA);

    // ─ EDIT mode: hapus lama ─────────────────────────────────────────────────
    $preserved_crossing = null;
    if ($edit_no_bukti) {
        // Simpan crossing info sebelum hapus
        $stmt = $pdo->prepare(
            "SELECT extraFieldsJson FROM `Transaction`
             WHERE entityId = ? AND jenisInputId = ? AND noBukti = ?"
        );
        $stmt->execute([$entity['id'], $jenis_input_id, $edit_no_bukti]);
        $old_txs = $stmt->fetchAll(PDO::FETCH_COLUMN);
        foreach ($old_txs as $json) {
            $ex = $json ? json_decode($json, true) : [];
            if (!empty($ex['crossingFromEntityKey'])) {
                $preserved_crossing = [
                    'crossingGroupId'       => $ex['crossingGroupId']       ?? null,
                    'crossingFromEntityKey' => $ex['crossingFromEntityKey'] ?? null,
                    'originalHutangCoaCode' => $ex['originalHutangCoaCode'] ?? null,
                ];
                break;
            }
        }

        // Hapus baris jurnal lama
        $pdo->prepare("DELETE FROM `Transaction` WHERE entityId = ? AND jenisInputId = ? AND noBukti = ?")
            ->execute([$entity['id'], $jenis_input_id, $edit_no_bukti]);
        // Hapus auto-posted
        $pdo->prepare(
            "DELETE FROM `Transaction` WHERE noBukti = ?
             AND JSON_VALUE(extraFieldsJson, '$.autoPostedFromJurnal') = 'true'"
        )->execute([$edit_no_bukti]);
        // Hapus faktur
        $pdo->prepare("DELETE FROM FakturPendapatan WHERE noFaktur = ?")->execute([$edit_no_bukti]);
        // Hapus termin terkait
        $pdo->prepare("DELETE FROM Termin WHERE name LIKE ?")->execute(["%[$edit_no_bukti]%"]);

    } else {
        // Cek duplikat
        $stmt = $pdo->prepare("SELECT id FROM `Transaction` WHERE entityId = ? AND noBukti = ? LIMIT 1");
        $stmt->execute([$entity['id'], $no_bukti]);
        if ($stmt->fetchColumn()) return error_response("No. Bukti \"$no_bukti\" sudah dipakai di entitas ini.", 409);
    }

    $now       = date('Y-m-d H:i:s');
    $staff_id  = $user['staffId'] ?? $user['id'];
    $tanggal_dt = $tanggal . ' 00:00:00';
    $first_keterangan = trim($valid_rows[0]['keterangan'] ?? '');

    $pdo->beginTransaction();
    try {
        // ── 1. Insert baris jurnal utama ──────────────────────────────────────
        foreach ($valid_rows as $row) {
            $is_kredit = (float)($row['kredit'] ?? 0) > 0;
            $extra     = null;
            if ($preserved_crossing) {
                $coa = $coa_map[$row['coaAccountId']] ?? null;
                $role = $is_kredit ? 'HUTANG' : ($coa && $coa['kategori'] === 'BEBAN' ? 'BEBAN' : 'PIUTANG');
                $extra = array_merge(
                    ['isCrossingEntry' => true],
                    $preserved_crossing,
                    ['crossingRole' => $role]
                );
            }
            $pdo->prepare(
                "INSERT INTO `Transaction` (id, entityId, jenisInputId, tanggal, noBukti, keterangan, coaAccountId,
                 debit, kredit, saldoSetelah, extraFieldsJson, staffId, projectId, createdAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )->execute([
                uuid4(), $entity['id'], $jenis_input_id, $tanggal_dt,
                $no_bukti, trim($row['keterangan'] ?? ''), $row['coaAccountId'],
                (float)($row['debit'] ?? 0), (float)($row['kredit'] ?? 0),
                0, $extra ? json_encode($extra) : null,
                $staff_id, $project_id, $now,
            ]);
        }

        // ── 2. Auto-post ke kas/bank ledger jika COA cocok ───────────────────
        // Logika: 1:1 dengan bagian auto-post di saveJurnalTransaksi src/lib/actions/jurnal-transaksi.ts
        foreach ($valid_rows as $row) {
            $coa = $coa_map[$row['coaAccountId']] ?? null;
            if (!$coa) continue;

            $debit  = (float)($row['debit']  ?? 0);
            $kredit = (float)($row['kredit'] ?? 0);
            $arah_masuk = $debit > 0;
            $nominal    = $arah_masuk ? $debit : $kredit;

            // Tentukan target entity/jenis
            $target_entity_id   = null;
            $target_jenis_id    = null;
            $rekening_nama_post  = null;

            $bank_match = $bank_coa_map[$coa['code']] ?? null;
            if ($bank_match) {
                $s = $pdo->prepare('SELECT id FROM Entity WHERE `key` = ?');
                $s->execute([$bank_match['entityKey']]);
                $t_entity_id = $s->fetchColumn();

                $s2 = $pdo->prepare("SELECT id FROM JenisInputTransaksi WHERE `key` = 'bankBuku'");
                $s2->execute();
                $t_jenis_id = $s2->fetchColumn();

                if ($t_entity_id && $t_jenis_id) {
                    $target_entity_id  = $t_entity_id;
                    $target_jenis_id   = $t_jenis_id;
                    $rekening_nama_post = $bank_match['rekeningNama'];
                }
            } elseif (isset($kas_kecil_code_to_ek[$coa['code']])) {
                $kk_key = $kas_kecil_code_to_ek[$coa['code']];
                $s = $pdo->prepare('SELECT id FROM Entity WHERE `key` = ?');
                $s->execute([$kk_key]);
                $t_entity_id = $s->fetchColumn();
                $s2 = $pdo->prepare("SELECT id FROM JenisInputTransaksi WHERE `key` = 'kasKecil'");
                $s2->execute();
                $t_jenis_id = $s2->fetchColumn();
                if ($t_entity_id && $t_jenis_id) { $target_entity_id = $t_entity_id; $target_jenis_id = $t_jenis_id; }
            } elseif (isset($kas_besar_code_to_ek[$coa['code']])) {
                $kb_key = $kas_besar_code_to_ek[$coa['code']];
                $s = $pdo->prepare('SELECT id FROM Entity WHERE `key` = ?');
                $s->execute([$kb_key]);
                $t_entity_id = $s->fetchColumn();
                $s2 = $pdo->prepare("SELECT id FROM JenisInputTransaksi WHERE `key` = 'kasBesar'");
                $s2->execute();
                $t_jenis_id = $s2->fetchColumn();
                if ($t_entity_id && $t_jenis_id) { $target_entity_id = $t_entity_id; $target_jenis_id = $t_jenis_id; }
            }

            if (!$target_entity_id || !$target_jenis_id) continue;

            $tx_year    = (int)date('Y', strtotime($tanggal));
            $prev_saldo = get_running_saldo($pdo, $target_entity_id, $target_jenis_id, $rekening_nama_post, $tx_year);
            $new_saldo  = $prev_saldo + ($arah_masuk ? $nominal : -$nominal);

            // Primary kas entry
            $kas_extra = ['isKasEntry' => true, 'autoPostedFromJurnal' => true];
            if ($rekening_nama_post) $kas_extra['rekeningNama'] = $rekening_nama_post;
            $pdo->prepare(
                "INSERT INTO `Transaction` (id, entityId, jenisInputId, tanggal, noBukti, keterangan, coaAccountId,
                 debit, kredit, saldoSetelah, extraFieldsJson, staffId, projectId, createdAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )->execute([
                uuid4(), $target_entity_id, $target_jenis_id, $tanggal_dt,
                $no_bukti, trim($row['keterangan'] ?? '') ?: $first_keterangan,
                $row['coaAccountId'],
                $arah_masuk ? $nominal : 0,
                $arah_masuk ? 0 : $nominal,
                $new_saldo, json_encode($kas_extra),
                $staff_id, $project_id, $now,
            ]);

            // Salin baris akun lawan (pendapatan, pajak, beban, dll) ke ledger bank/kas
            // Logika: 1:1 dengan counterpartRow loop di saveJurnalTransaksi
            foreach ($valid_rows as $cp_row) {
                if ($cp_row['coaAccountId'] === $row['coaAccountId']) continue;
                $cp_coa = $coa_map[$cp_row['coaAccountId']] ?? null;
                if ($cp_coa && (
                    isset($bank_coa_map[$cp_coa['code']])
                    || isset($kas_kecil_code_to_ek[$cp_coa['code']])
                    || isset($kas_besar_code_to_ek[$cp_coa['code']])
                )) continue;

                $cp_extra = ['autoPostedFromJurnal' => true];
                if ($rekening_nama_post) $cp_extra['rekeningNama'] = $rekening_nama_post;
                $pdo->prepare(
                    "INSERT INTO `Transaction` (id, entityId, jenisInputId, tanggal, noBukti, keterangan, coaAccountId,
                     debit, kredit, saldoSetelah, extraFieldsJson, staffId, projectId, createdAt)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                )->execute([
                    uuid4(), $target_entity_id, $target_jenis_id, $tanggal_dt,
                    $no_bukti, trim($cp_row['keterangan'] ?? '') ?: $first_keterangan,
                    $cp_row['coaAccountId'],
                    (float)($cp_row['debit']  ?? 0),
                    (float)($cp_row['kredit'] ?? 0),
                    $new_saldo, json_encode($cp_extra),
                    $staff_id, $project_id, $now,
                ]);
            }
        }

        $pdo->commit();

        // ── 3. Sinkronisasi ke FakturPendapatan & Kontrol Termin ─────────────
        // Logika: 1:1 dengan blok sinkronisasi di saveJurnalTransaksi src/lib/actions/jurnal-transaksi.ts
        $pendapatan_rows = array_filter($valid_rows, function($r) use ($coa_map) {
            $c = $coa_map[$r['coaAccountId']] ?? null;
            return $c && ($c['kategori'] === 'PENDAPATAN' || str_starts_with($c['code'], '4')) && (float)($r['kredit'] ?? 0) > 0;
        });
        $pph_rows = array_filter($valid_rows, function($r) use ($coa_map) {
            $c = $coa_map[$r['coaAccountId']] ?? null;
            return $c && (in_array($c['code'], ['533', '534']) || preg_match('/pph/i', $c['name'])) && (float)($r['debit'] ?? 0) > 0;
        });
        $ppn_rows = array_filter($valid_rows, function($r) use ($coa_map) {
            $c = $coa_map[$r['coaAccountId']] ?? null;
            return $c && (in_array($c['code'], ['535', '536']) || preg_match('/ppn/i', $c['name']));
        });
        $bank_rows = array_filter($valid_rows, function($r) use ($coa_map, $bank_coa_map) {
            $c = $coa_map[$r['coaAccountId']] ?? null;
            return $c && (
                isset($bank_coa_map[$c['code']])
                || ($c['reportType'] === 'ARUS_KAS' && preg_match('/bank|bpd|bri|bni|mdr/i', $c['name']))
            );
        });

        $total_pendapatan  = array_sum(array_column(array_values($pendapatan_rows), 'kredit'));
        $total_pph         = array_sum(array_column(array_values($pph_rows), 'debit'));
        $total_ppn         = 0.0;
        foreach ($ppn_rows as $r) $total_ppn += (float)($r['debit'] ?? 0) ?: (float)($r['kredit'] ?? 0);
        $bank_debit_rows   = array_filter($bank_rows, fn($r) => (float)($r['debit'] ?? 0) > 0);
        $bank_debit_total  = array_sum(array_column(array_values($bank_debit_rows), 'debit'));

        if ($total_pendapatan > 0 || ($project_id && $bank_debit_total > 0) || ($total_pph > 0 && $bank_debit_total > 0)) {
            $project_obj = null;
            if ($project_id) {
                $s = $pdo->prepare('SELECT id, entityId, name, contractValue FROM Project WHERE id = ?');
                $s->execute([$project_id]);
                $project_obj = $s->fetch(PDO::FETCH_ASSOC);
            }

            $nilai_kwitansi = $total_pendapatan > 0
                ? $total_pendapatan
                : ($bank_debit_total > 0 ? $bank_debit_total + $total_pph : 0);

            $dpp           = hitung_dpp_dari_kwitansi($nilai_kwitansi);
            $dpp_nilai_lain = hitung_dpp_nilai_lain($dpp);
            $tarif_ppn     = 12;
            $calc_ppn      = (int)round($dpp_nilai_lain * $tarif_ppn / 100);
            $ppn           = $total_ppn > 0 ? (int)$total_ppn : $calc_ppn;
            $tarif_pph     = $dpp > 0 && $total_pph > 0 ? round(($total_pph / $dpp) * 100, 2) : 3.5;
            $pph           = $total_pph > 0 ? (int)$total_pph : (int)round($dpp * $tarif_pph / 100);
            $nilai_proyek  = $nilai_kwitansi > 0
                ? $nilai_kwitansi
                : ($total_ppn > 0 ? $dpp + (int)$total_ppn : (int)round($dpp * 111 / 100));
            $laba          = (int)round($nilai_proyek - $ppn - $pph);
            $nominal_diterima = $bank_debit_total > 0 ? (int)$bank_debit_total : $laba;

            // Nama bank dari bank row pertama
            $first_bank_debit = array_values($bank_debit_rows)[0] ?? array_values($bank_rows)[0] ?? null;
            $bank_coa_obj = $first_bank_debit ? ($coa_map[$first_bank_debit['coaAccountId']] ?? null) : null;
            $bank_name = $bank_coa_obj
                ? ($bank_coa_map[$bank_coa_obj['code']]['rekeningNama'] ?? $bank_coa_obj['name'])
                : 'BPD';

            $target_entity_for_faktur = ($project_obj['entityId'] ?? null) ?? $entity['id'];
            $tx_date  = new DateTime($tanggal);
            $masa     = (int)$tx_date->format('n');
            $tahun    = (int)$tx_date->format('Y');
            $nama_rek = $project_obj['name'] ?? $entity['name'];
            $nama_jkp = $first_keterangan ?: ($project_obj ? "Jasa Konsultansi {$project_obj['name']}" : "Pendapatan $no_bukti");

            // Upsert FakturPendapatan
            $stmt_ef = $pdo->prepare(
                "SELECT id FROM FakturPendapatan WHERE noFaktur = ? AND entityId = ? LIMIT 1"
            );
            $stmt_ef->execute([$no_bukti, $target_entity_for_faktur]);
            $existing_faktur_id = $stmt_ef->fetchColumn();

            $faktur_data = [
                $target_entity_for_faktur, '-', $no_bukti, $masa, $tahun,
                $nama_rek, $nama_jkp, $dpp, $dpp_nilai_lain,
                $tarif_ppn, $tarif_pph, $ppn, $pph,
                $nilai_proyek, $laba, 1, $dpp, 0,
                $tanggal, $bank_name, $nominal_diterima, $project_id,
                $user['id'],
            ];

            if ($existing_faktur_id) {
                $pdo->prepare(
                    "UPDATE FakturPendapatan SET
                     entityId=?, npwp=?, noFaktur=?, masaPajak=?, tahunPajak=?,
                     namaRekanan=?, namaJkp=?, dpp=?, dppNilaiLain=?,
                     tarifPpnPersen=?, tarifPphPersen=?, ppn=?, pph=?,
                     nilaiProyek=?, labaSetelahPajak=?, kodeJenisProyek=?,
                     pekerjaanPerusahaan=?, pekerjaanYangDipinjam=?,
                     tanggalTerima=?, bank=?, nominalDiterima=?, projectId=?,
                     createdById=?
                     WHERE id = ?"
                )->execute(array_merge($faktur_data, [$existing_faktur_id]));
            } else {
                $pdo->prepare(
                    "INSERT INTO FakturPendapatan
                     (id, entityId, npwp, noFaktur, masaPajak, tahunPajak,
                      namaRekanan, namaJkp, dpp, dppNilaiLain,
                      tarifPpnPersen, tarifPphPersen, ppn, pph,
                      nilaiProyek, labaSetelahPajak, kodeJenisProyek,
                      pekerjaanPerusahaan, pekerjaanYangDipinjam,
                      tanggalTerima, bank, nominalDiterima, projectId,
                      createdById, createdAt)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                )->execute(array_merge([uuid4()], $faktur_data, [$now]));
            }

            // ── Update/Tambah Termin jika ada proyek
            if ($project_id && $project_obj) {
                $stmt_tw = $pdo->prepare(
                    "SELECT id, name, percentage, nominal, createdAt FROM Termin WHERE projectId = ? ORDER BY createdAt ASC"
                );
                $stmt_tw->execute([$project_id]);
                $all_termins = $stmt_tw->fetchAll(PDO::FETCH_ASSOC);

                // Hapus termin terkait noBukti ini jika edit
                $old_termin_id = null;
                foreach ($all_termins as $t) {
                    if (
                        str_contains($t['name'], "[$no_bukti]")
                        || ($edit_no_bukti && str_contains($t['name'], "[$edit_no_bukti]"))
                    ) {
                        $old_termin_id = $t['id'];
                        break;
                    }
                }
                if ($old_termin_id) {
                    $pdo->prepare("DELETE FROM Termin WHERE id = ?")->execute([$old_termin_id]);
                }

                $remaining = array_filter($all_termins, fn($t) => !$old_termin_id || $t['id'] !== $old_termin_id);
                $remaining = array_values($remaining);

                $existing_pcts = array_map(fn($t) => (int)$t['percentage'], $remaining);
                $max_pct_so_far = empty($existing_pcts) ? 0 : max($existing_pcts);
                $contract_val   = (float)($project_obj['contractValue'] ?? 0);

                $existing_cumulative = 0.0;
                foreach ($remaining as $i => $t) {
                    $prev_pct = $i === 0 ? 0 : $remaining[$i-1]['percentage'];
                    $nom = ($t['nominal'] && (float)$t['nominal'] > 0)
                        ? (float)$t['nominal']
                        : (((int)$t['percentage'] - $prev_pct) / 100) * $contract_val;
                    $existing_cumulative += $nom;
                }

                $nominal_termin = $nilai_proyek > 0 ? $nilai_proyek : ($dpp > 0 ? $dpp : $nominal_diterima);
                if ($nominal_termin > 0) {
                    $new_pct    = compute_new_termin_percentage($contract_val, $existing_pcts, $nominal_termin, $existing_cumulative);
                    $termin_ke  = count($remaining) + 1;
                    $delta_pct  = max(0, $new_pct - $max_pct_so_far);
                    $status_t   = $new_pct >= 80 ? 'ON_TRACK' : 'AT_RISK';

                    $pdo->prepare(
                        "INSERT INTO Termin (id, projectId, name, percentage, nominal, status, createdAt)
                         VALUES (?, ?, ?, ?, ?, ?, ?)"
                    )->execute([
                        uuid4(), $project_id,
                        "Termin $termin_ke ($delta_pct% Kontrak) [$no_bukti]",
                        $new_pct, $nominal_termin, $status_t, $now,
                    ]);

                    if ($new_pct >= 100) {
                        $pdo->prepare("UPDATE Project SET status = 'COMPLETED' WHERE id = ?")->execute([$project_id]);
                    }
                }
            }
        }

    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        return error_response('Gagal menyimpan jurnal: ' . $e->getMessage(), 500);
    }

    $action = $edit_no_bukti ? 'Edit' : 'Input';
    log_activity($user['id'], "$action Jurnal Transaksi – $no_bukti ({$entity['name']})" . ($first_keterangan ? ": $first_keterangan" : ''), 'FINANCIAL_CHANGE', [
        'entityKey' => $entity_key, 'noBukti' => $no_bukti,
        'projectId' => $project_id, 'rowCount' => count($valid_rows),
    ]);

    json_response(['success' => true]);
}

// ─── DELETE /api/jurnal-transaksi ──────────────────────────────────────────────
// Logika: 1:1 dengan deleteJurnalTransaksi() di src/lib/actions/jurnal-transaksi.ts
elseif ($method === 'DELETE' && $sub === '') {
    $user = require_auth();
    $pdo  = get_pdo();

    $tx_ids = array_filter((array)($body['txIds'] ?? []));
    if (empty($tx_ids)) return error_response('Tidak ada transaksi yang dihapus.', 400);

    // Ambil noBukti dari transaksi pertama
    $stmt = $pdo->prepare("SELECT noBukti FROM `Transaction` WHERE id = ? LIMIT 1");
    $stmt->execute([$tx_ids[0]]);
    $first_no_bukti = $stmt->fetchColumn();

    // Hapus source rows
    $ph = implode(',', array_fill(0, count($tx_ids), '?'));
    $pdo->prepare("DELETE FROM `Transaction` WHERE id IN ($ph)")->execute(array_values($tx_ids));

    if ($first_no_bukti) {
        // Hapus auto-posted entries
        $pdo->prepare(
            "DELETE FROM `Transaction` WHERE noBukti = ?
             AND JSON_VALUE(extraFieldsJson, '$.autoPostedFromJurnal') = 'true'"
        )->execute([$first_no_bukti]);

        // Hapus faktur pendapatan
        $pdo->prepare("DELETE FROM FakturPendapatan WHERE noFaktur = ?")->execute([$first_no_bukti]);

        // Hapus termin terkait + revert project status jika perlu
        $stmt_t = $pdo->prepare("SELECT id, projectId FROM Termin WHERE name LIKE ?");
        $stmt_t->execute(["%[$first_no_bukti]%"]);
        $termins = $stmt_t->fetchAll(PDO::FETCH_ASSOC);
        if (!empty($termins)) {
            $termin_ids = array_column($termins, 'id');
            $t_ph = implode(',', array_fill(0, count($termin_ids), '?'));
            $pdo->prepare("DELETE FROM Termin WHERE id IN ($t_ph)")->execute($termin_ids);

            foreach ($termins as $t) {
                $s = $pdo->prepare("SELECT percentage FROM Termin WHERE projectId = ?");
                $s->execute([$t['projectId']]);
                $remaining_pcts = $s->fetchAll(PDO::FETCH_COLUMN);
                $max_rem = empty($remaining_pcts) ? 0 : max(array_map('intval', $remaining_pcts));
                if ($max_rem < 100) {
                    $pdo->prepare("UPDATE Project SET status = 'ACTIVE' WHERE id = ?")->execute([$t['projectId']]);
                }
            }
        }
    }

    log_activity($user['id'], 'Hapus Jurnal Transaksi (' . count($tx_ids) . ' baris)', 'FINANCIAL_CHANGE', ['txIds' => $tx_ids]);
    json_response(['success' => true]);
}

else {
    error_response('Endpoint tidak ditemukan.', 404);
}
