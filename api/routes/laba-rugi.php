<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

require_once __DIR__ . '/../helpers/akuntansi-helpers.php';

$user = require_auth();

// GET /api/laba-rugi?entityId=...&dari=...&sampai=...&version=INTERNAL|UMUM
if ($method === 'GET') {
    $entity_id = $_GET['entityId'] ?? null;
    $dari      = $_GET['dari']    ?? null;
    $sampai    = $_GET['sampai']  ?? null;
    $version   = strtoupper($_GET['version'] ?? 'INTERNAL');

    if (!$entity_id) error_response('entityId diperlukan.', 400);

    // Fallback: jika dari/sampai tidak ada, gunakan tahun berjalan
    $year = (int)date('Y');
    if (!$dari)   $dari   = "$year-01-01";
    if (!$sampai) $sampai = "$year-12-31";

    $date_from = $dari   . ' 00:00:00';
    $date_to   = $sampai . ' 23:59:59';

    // Ekstrak tahun dan cek apakah rentang waktu spesifik 1 bulan
    $year_dari  = (int)substr($dari, 0, 4);
    $month_dari = (int)substr($dari, 5, 2);
    $month_ke   = (int)substr($sampai, 5, 2);
    $month_scope = ($month_dari === $month_ke) ? $month_dari : null;

    if (!in_array($version, ['INTERNAL', 'UMUM'])) {
        error_response("version tidak valid. Pilihan: INTERNAL, UMUM", 400);
    }

    $report_cat_filter = $version === 'INTERNAL'
        ? "c.report_category IN ('INTERNAL','SEMUA')"
        : "(c.report_category IN ('UMUM','SEMUA') OR c.code = '628')";

    $pdo = get_pdo();

    // Exclusion list noBukti untuk isolasi versi UMUM vs INTERNAL
    $excluded_nobukti = get_excluded_no_bukti_for_version($pdo, $entity_id, $year_dari, $version);
    $nobukti_sql = '';
    $nobukti_params = [];
    if (!empty($excluded_nobukti)) {
        $placeholders = implode(',', array_fill(0, count($excluded_nobukti), '?'));
        $nobukti_sql = " AND (t.noBukti IS NULL OR t.noBukti NOT IN ($placeholders))";
        $nobukti_params = $excluded_nobukti;
    }

    // Ambil transaksi PENDAPATAN & BEBAN (filter mirror row dan exclusion noBukti)
    $stmt = $pdo->prepare(
        "SELECT c.id, c.code, c.name, c.kategori,
                COALESCE(SUM(t.debit),  0) AS total_debit,
                COALESCE(SUM(t.kredit), 0) AS total_kredit
         FROM `Transaction` t
         JOIN CoaAccount c ON t.coaAccountId = c.id
         WHERE t.entityId   = ?
           AND t.tanggal BETWEEN ? AND ?
           AND c.kategori   IN ('PENDAPATAN','BEBAN')
           AND $report_cat_filter
           AND (t.extraFieldsJson IS NULL OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') IS NULL OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') != 'true')
           $nobukti_sql
         GROUP BY c.id, c.code, c.name, c.kategori
         ORDER BY c.code ASC"
    );
    $stmt->execute(array_merge([$entity_id, $date_from, $date_to], $nobukti_params));
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $pendapatan = [];
    $beban      = [];

    foreach ($rows as $row) {
        $total_d = (float)$row['total_debit'];
        $total_k = (float)$row['total_kredit'];

        if ($row['kategori'] === 'PENDAPATAN') {
            // Pendapatan kredit-normal
            $saldo = $total_k - $total_d;
            $pendapatan[] = [
                'id'       => $row['id'],
                'code'     => $row['code'],
                'name'     => $row['name'],
                'kategori' => $row['kategori'],
                'debit'    => $total_d,
                'kredit'   => $total_k,
                'saldo'    => $saldo,
            ];
        } else {
            // Beban debit-normal (Di versi UMUM, akun 628 direklasifikasi sebagai 150 Kas Titipan)
            $is_mkt = ($row['code'] === '628');
            $code   = ($version === 'UMUM' && $is_mkt) ? '150' : $row['code'];
            $name   = ($version === 'UMUM' && $is_mkt) ? 'Kas Titipan' : $row['name'];
            $saldo  = $total_d - $total_k;

            $beban[] = [
                'id'       => $row['id'],
                'code'     => $code,
                'name'     => $name,
                'kategori' => $row['kategori'],
                'debit'    => $total_d,
                'kredit'   => $total_k,
                'saldo'    => $saldo,
            ];
        }
    }

    // ── Integrasi Laporan Pendapatan (FakturPendapatan belum dijurnal) ────────
    $stmt_rec = $pdo->prepare(
        "SELECT DISTINCT t.noBukti, t.fakturId, JSON_VALUE(t.extraFieldsJson, '$.fakturId') AS extraFakturId
         FROM `Transaction` t
         JOIN CoaAccount c ON t.coaAccountId = c.id
         WHERE t.entityId = ? AND t.tanggal BETWEEN ? AND ? AND c.kategori = 'PENDAPATAN'
           AND (t.extraFieldsJson IS NULL OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') IS NULL OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') != 'true')"
    );
    $stmt_rec->execute([$entity_id, $date_from, $date_to]);
    $rec_nobukti = [];
    $rec_faktur_ids = [];
    foreach ($stmt_rec->fetchAll(PDO::FETCH_ASSOC) as $rec) {
        if (!empty($rec['noBukti']))       $rec_nobukti[]    = $rec['noBukti'];
        if (!empty($rec['fakturId']))      $rec_faktur_ids[] = $rec['fakturId'];
        if (!empty($rec['extraFakturId'])) $rec_faktur_ids[] = $rec['extraFakturId'];
    }
    $rec_nobukti    = array_unique(array_filter($rec_nobukti));
    $rec_faktur_ids = array_unique(array_filter($rec_faktur_ids));

    $faktur_conds  = ["f.entityId = ?", "f.tahunPajak = ?"];
    $faktur_params = [$entity_id, $year_dari];

    if ($month_scope !== null) {
        $faktur_conds[]  = "f.masaPajak = ?";
        $faktur_params[] = $month_scope;
    }
    if (!empty($rec_nobukti)) {
        $ph = implode(',', array_fill(0, count($rec_nobukti), '?'));
        $faktur_conds[]  = "f.noFaktur NOT IN ($ph)";
        $faktur_params   = array_merge($faktur_params, $rec_nobukti);
    }
    if (!empty($rec_faktur_ids)) {
        $ph = implode(',', array_fill(0, count($rec_faktur_ids), '?'));
        $faktur_conds[]  = "f.id NOT IN ($ph)";
        $faktur_params   = array_merge($faktur_params, $rec_faktur_ids);
    }

    $stmt_faktur = $pdo->prepare(
        "SELECT COALESCE(SUM(f.nilaiProyek), 0) FROM FakturPendapatan f WHERE " . implode(' AND ', $faktur_conds)
    );
    $stmt_faktur->execute($faktur_params);
    $faktur_unlinked = (float)$stmt_faktur->fetchColumn();

    if ($faktur_unlinked > 0) {
        // Gabungkan ke akun pendapatan utama (400) bila ada, jika belum ada buat baris 400
        $found_idx = -1;
        foreach ($pendapatan as $idx => $p) {
            if ($p['code'] === '400' || preg_match('/pendapatan/i', $p['name'])) {
                $found_idx = $idx;
                break;
            }
        }
        if ($found_idx !== -1) {
            $pendapatan[$found_idx]['kredit'] += $faktur_unlinked;
            $pendapatan[$found_idx]['saldo']  += $faktur_unlinked;
        } else {
            $pendapatan[] = [
                'id'       => null,
                'code'     => '400',
                'name'     => 'Pendapatan Proyek (E-Faktur)',
                'kategori' => 'PENDAPATAN',
                'debit'    => 0.0,
                'kredit'   => $faktur_unlinked,
                'saldo'    => $faktur_unlinked,
                'isAuto'   => true,
            ];
        }
    }

    // ── Tambahkan Beban Penyusutan Otomatis dari AsetTetap ────────────────────
    $penyusutan_summary = get_penyusutan_summary($entity_id, $year_dari, $month_scope);
    $beban_penyusutan   = (float)($penyusutan_summary['total_beban'] ?? 0);

    if ($beban_penyusutan > 0) {
        $depr_idx = -1;
        foreach ($beban as $idx => $b) {
            if (in_array($b['code'], ['512', '540']) || preg_match('/penyusutan/i', $b['name'])) {
                $depr_idx = $idx;
                break;
            }
        }
        if ($depr_idx !== -1) {
            $beban[$depr_idx]['saldo'] = $beban_penyusutan;
            $beban[$depr_idx]['debit'] = $beban_penyusutan;
        } else {
            $beban[] = [
                'id'       => null,
                'code'     => '512',
                'name'     => 'Beban Penyusutan Aset Tetap',
                'kategori' => 'BEBAN',
                'debit'    => $beban_penyusutan,
                'kredit'   => 0.0,
                'saldo'    => $beban_penyusutan,
                'isAuto'   => true,
            ];
        }
    }

    $total_pendapatan = array_sum(array_column($pendapatan, 'saldo'));
    $total_beban      = array_sum(array_column($beban,      'saldo'));
    $laba_bersih      = $total_pendapatan - $total_beban;

    json_response([
        'entityId'        => $entity_id,
        'dari'            => $dari,
        'sampai'          => $sampai,
        'version'         => $version,
        'pendapatan'      => $pendapatan,
        'beban'           => $beban,
        'totalPendapatan' => $total_pendapatan,
        'totalBeban'      => $total_beban,
        'labaBersih'      => $laba_bersih,
        'bebanPenyusutan' => $beban_penyusutan,
        'fakturUnlinked'  => $faktur_unlinked,
    ]);
}

error_response('Endpoint tidak ditemukan.', 404);
