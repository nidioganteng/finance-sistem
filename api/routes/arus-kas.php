<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

$user = require_auth();

// GET /api/arus-kas?entityId=...&year=...
if ($method === 'GET') {
    $entity_id = $_GET['entityId'] ?? null;
    $year      = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');

    if (!$entity_id) error_response('entityId diperlukan.', 400);

    $pdo = get_pdo();

    $stmt = $pdo->prepare(
        'SELECT MONTH(t.tanggal) AS bulan,
                COALESCE(SUM(t.debit),  0) AS total_masuk,
                COALESCE(SUM(t.kredit), 0) AS total_keluar
         FROM `Transaction` t
         JOIN CoaAccount c ON t.coaAccountId = c.id
         WHERE t.entityId        = ?
           AND YEAR(t.tanggal)   = ?
           AND c.reportType      = \'ARUS_KAS\'
         GROUP BY MONTH(t.tanggal)
         ORDER BY bulan ASC'
    );
    $stmt->execute([$entity_id, $year]);
    $rows = $stmt->fetchAll();

    // Bangun map bulan → data
    $bulan_map = [];
    foreach ($rows as $row) {
        $bulan_map[(int)$row['bulan']] = [
            'masuk'  => (float)$row['total_masuk'],
            'keluar' => (float)$row['total_keluar'],
        ];
    }

    // Isi 12 bulan, kosong = 0
    $nama_bulan = [
        1=>'Januari',2=>'Februari',3=>'Maret',4=>'April',5=>'Mei',6=>'Juni',
        7=>'Juli',8=>'Agustus',9=>'September',10=>'Oktober',11=>'November',12=>'Desember',
    ];

    $monthly     = [];
    $total_masuk = 0.0;
    $total_keluar= 0.0;

    for ($m = 1; $m <= 12; $m++) {
        $masuk  = $bulan_map[$m]['masuk']  ?? 0.0;
        $keluar = $bulan_map[$m]['keluar'] ?? 0.0;
        $neto   = $masuk - $keluar;

        $monthly[]    = [
            'bulan'      => $m,
            'namaBulan'  => $nama_bulan[$m],
            'masuk'      => $masuk,
            'keluar'     => $keluar,
            'neto'       => $neto,
        ];
        $total_masuk  += $masuk;
        $total_keluar += $keluar;
    }

    json_response([
        'entityId'    => $entity_id,
        'year'        => $year,
        'monthly'     => $monthly,
        'totalMasuk'  => $total_masuk,
        'totalKeluar' => $total_keluar,
        'totalNeto'   => $total_masuk - $total_keluar,
    ]);
}

error_response('Endpoint tidak ditemukan.', 404);
