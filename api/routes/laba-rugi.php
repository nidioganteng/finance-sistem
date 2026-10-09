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

    // Ekstrak tahun dari dari untuk hitung penyusutan
    $year_dari = (int)substr($dari, 0, 4);

    if (!in_array($version, ['INTERNAL', 'UMUM'])) {
        error_response("version tidak valid. Pilihan: INTERNAL, UMUM", 400);
    }

    $report_cat_filter = $version === 'INTERNAL'
        ? "c.report_category IN ('INTERNAL','SEMUA')"
        : "c.report_category IN ('UMUM','SEMUA')";

    $pdo = get_pdo();

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
         GROUP BY c.id, c.code, c.name, c.kategori
         ORDER BY c.code ASC"
    );
    $stmt->execute([$entity_id, $date_from, $date_to]);
    $rows = $stmt->fetchAll();

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
            // Beban debit-normal
            $saldo = $total_d - $total_k;
            $beban[] = [
                'id'       => $row['id'],
                'code'     => $row['code'],
                'name'     => $row['name'],
                'kategori' => $row['kategori'],
                'debit'    => $total_d,
                'kredit'   => $total_k,
                'saldo'    => $saldo,
            ];
        }
    }

    // Tambahkan beban penyusutan otomatis dari AsetTetap
    $beban_penyusutan = total_beban_penyusutan($entity_id, $year_dari);
    if ($beban_penyusutan > 0) {
        $beban[] = [
            'id'       => null,
            'code'     => 'penyusutan_otomatis',
            'name'     => 'Beban Penyusutan Aset Tetap (otomatis)',
            'kategori' => 'BEBAN',
            'debit'    => $beban_penyusutan,
            'kredit'   => 0.0,
            'saldo'    => $beban_penyusutan,
            'isAuto'   => true,
        ];
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
    ]);
}

error_response('Endpoint tidak ditemukan.', 404);
