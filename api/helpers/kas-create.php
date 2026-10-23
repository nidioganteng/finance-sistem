<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');
require_once __DIR__.'/kas-helpers.php';
require_once __DIR__.'/kas-transitory.php';

class KasInputException extends RuntimeException {}

/** Caller must commit the entire request, including cross-entity and bank postings. */
function kas_create_transaction(PDO $pdo, array $user, array $body): array {
    if (!$pdo->inTransaction()) throw new LogicException('Penyimpanan kas wajib dalam transaksi database.');
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
    $periode_bulan_gaji = !empty($body['periodeBulanGaji']) ? (int)$body['periodeBulanGaji'] : null;
    $periode_tahun_gaji = !empty($body['periodeTahunGaji']) ? (int)$body['periodeTahunGaji'] : (!empty($periode_bulan_gaji) ? (int)date('Y', strtotime($tanggal)) : null);
    $tanggal_nota       = !empty($body['tanggalNota']) ? trim((string)$body['tanggalNota']) : null;

    // Validasi dasar
    if (!$entity_key || !$jenis_input_key || !$tanggal || !$no_bukti || !$keterangan || !$arah) {
        throw new KasInputException('entityKey, jenisInputKey, tanggal, noBukti, keterangan, dan arah wajib diisi.', 400);
    }

    if (!in_array($arah, ['masuk', 'keluar'], true)) throw new KasInputException('Arah transaksi tidak valid.', 400);
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $tanggal);
    if (!$date || $date->format('Y-m-d') !== $tanggal) throw new KasInputException('Tanggal transaksi tidak valid.', 400);
    if (!is_array($rows) || !$rows) throw new KasInputException('Isi minimal satu baris akun.', 400);
    foreach ($rows as $row) {
        if (!is_array($row) || empty($row['coaAccountId']) || !is_numeric($row['nominal'] ?? null) || !is_finite((float)$row['nominal']) || (float)$row['nominal'] <= 0) {
            throw new KasInputException('Setiap baris wajib memiliki akun dan nominal positif.', 400);
        }
        $account = $pdo->prepare('SELECT id FROM CoaAccount WHERE id = ?');
        $account->execute([$row['coaAccountId']]);
        if (!$account->fetchColumn()) throw new KasInputException('Akun transaksi tidak ditemukan.', 400);
    }

    // Cek akses entity
    if (!in_array($entity_key, $user['entityKeys'] ?? [])) {
        throw new KasInputException('Kamu tidak punya akses ke entity ini.', 403);
    }

    try { transitory_guard_coa(array_column((array)$rows,'coaAccountId')); } catch(RuntimeException $e) { throw new KasInputException($e->getMessage(),409); }
    $valid_rows = array_values(array_filter($rows, fn($r) => !empty($r['coaAccountId']) && (float)($r['nominal'] ?? 0) > 0));
    if (empty($valid_rows)) throw new KasInputException('Isi minimal satu baris akun dengan nominal.', 400);

    if ($jenis_input_key === 'bankBuku') {
        if (!$rekening_id) throw new KasInputException('Rekening/Bank wajib dipilih untuk transaksi Buku Bank.', 400);
        if (!is_valid_rekening($entity_key, $rekening_id)) {
            throw new KasInputException('Rekening yang dipilih tidak sesuai dengan entitas ini.', 400);
        }
    }

    // Cari entity & jenis input
    $stmt = $pdo->prepare('SELECT id FROM Entity WHERE `key` = ?'.transitory_lock($pdo));
    $stmt->execute([$entity_key]);
    $entity_id = $stmt->fetchColumn();
    if (!$entity_id) throw new KasInputException('Entity tidak ditemukan.', 404);

    $stmt = $pdo->prepare("SELECT id, nama FROM JenisInputTransaksi WHERE `key` = ?");
    $stmt->execute([$jenis_input_key]);
    $jenis_input = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$jenis_input) throw new KasInputException('Jenis input tidak ditemukan.', 404);

    // Cek duplikat noBukti
    $stmt = $pdo->prepare("SELECT id FROM `Transaction` WHERE entityId = ? AND noBukti = ? LIMIT 1");
    $stmt->execute([$entity_id, $no_bukti]);
    if ($stmt->fetchColumn()) throw new KasInputException("No. bukti \"$no_bukti\" sudah dipakai di entitas ini.", 409);

    if ($arah === 'masuk' && !empty($crossing_keys)) {
        throw new KasInputException('Pemasukan hanya boleh dari entitas yang sama, tidak bisa lintas entitas.', 400);
    }

    // Hitung saldo
    $rekening_nama  = $rekening_id ? get_rekening_nama($entity_key, $rekening_id) : null;
    $kas_coa_id     = resolve_kas_coa($pdo, $jenis_input_key, $entity_key, $rekening_id);
    if (!$kas_coa_id) throw new KasInputException('Akun kas/bank belum diatur.', 400);
    if ($sync_bank_rek_id && !is_valid_rekening($entity_key, $sync_bank_rek_id)) throw new KasInputException('Rekening sinkronisasi tidak sesuai entitas.', 400);
    $total          = array_sum(array_column($valid_rows, 'nominal'));
    $tx_year        = (int)date('Y', strtotime($tanggal));
    $prev_saldo     = get_running_saldo($pdo, $entity_id, $jenis_input['id'], $rekening_nama, $tx_year);
    $new_saldo      = $prev_saldo + ($arah === 'masuk' ? $total : -$total);
    $is_keluar      = ($arah === 'keluar');

    // crossing
    $crossing_group_id = !empty($crossing_keys) ? uuid4() : null;
    $arah_laporan_arr  = is_array($arah_laporan) && count($arah_laporan) > 0 ? $arah_laporan : null;


    transitory_guard_reference($pdo,$entity_id,$no_bukti);
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
    if ($tanggal_nota)       $kas_extra['tanggalNota']         = $tanggal_nota;

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


    // Auto-sync Kas Kecil masuk dari Buku Bank
    if ($is_sync_mode) {
        $stmt_bj = $pdo->prepare("SELECT id FROM JenisInputTransaksi WHERE `key` = 'bankBuku'");
        $stmt_bj->execute();
        $bank_jenis_id = $stmt_bj->fetchColumn();
        if (!$bank_jenis_id) throw new KasInputException('Jenis input Buku Bank belum diatur.', 400);
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

    return ['success' => true, 'noBukti' => $no_bukti];
}
