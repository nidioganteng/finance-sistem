<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

require_once __DIR__ . '/../helpers/akuntansi-helpers.php';

$user = require_auth();

// GET /api/laporan-keuangan?type=tx-count&entityIds[]=...&dateFrom=...&dateTo=...
if ($method === 'GET' && ($_GET['type'] ?? '') === 'tx-count') {
    $entity_ids_raw = $_GET['entityIds'] ?? [];
    if (!is_array($entity_ids_raw)) $entity_ids_raw = [$entity_ids_raw];
    $entity_ids = array_filter(array_map('trim', $entity_ids_raw));

    if (empty($entity_ids)) error_response('entityIds diperlukan.', 400);

    $date_from = $_GET['dateFrom'] ?? date('Y') . '-01-01 00:00:00';
    $date_to   = $_GET['dateTo']   ?? date('Y') . '-12-31 23:59:59';

    $pdo = get_pdo();
    $placeholders = implode(',', array_fill(0, count($entity_ids), '?'));
    $stmt = $pdo->prepare(
        "SELECT COUNT(*) FROM `Transaction`
          WHERE entityId IN ($placeholders) AND tanggal BETWEEN ? AND ?"
    );
    $stmt->execute(array_merge($entity_ids, [$date_from, $date_to]));
    json_response(['count' => (int)$stmt->fetchColumn()]);
}

// GET /api/laporan-keuangan?entityIds[]=...&year=...&version=INTERNAL|UMUM
if ($method === 'GET') {
    // entityIds[] bisa dari query string: ?entityIds[]=id1&entityIds[]=id2
    $entity_ids_raw = $_GET['entityIds'] ?? [];
    if (!is_array($entity_ids_raw)) {
        $entity_ids_raw = [$entity_ids_raw];
    }
    $entity_ids = array_filter(array_map('trim', $entity_ids_raw));

    $year    = isset($_GET['year'])    ? (int)$_GET['year']     : (int)date('Y');
    $version = strtoupper($_GET['version'] ?? 'INTERNAL');

    if (empty($entity_ids)) error_response('entityIds diperlukan (array).', 400);
    if (!in_array($version, ['INTERNAL', 'UMUM'])) {
        error_response("version tidak valid. Pilihan: INTERNAL, UMUM", 400);
    }

    $pdo = get_pdo();

    $report_cat_filter = $version === 'INTERNAL'
        ? "c.report_category IN ('INTERNAL','SEMUA')"
        : "c.report_category IN ('UMUM','SEMUA')";

    $date_from = "$year-01-01 00:00:00";
    $date_to   = "$year-12-31 23:59:59";

    // ── Helper: query gabungan untuk banyak entity ───────────────────────────
    $placeholders = implode(',', array_fill(0, count($entity_ids), '?'));

    // Nama entity untuk label
    $stmt_e = $pdo->prepare("SELECT id, `key`, name FROM Entity WHERE id IN ($placeholders)");
    $stmt_e->execute($entity_ids);
    $entities = $stmt_e->fetchAll();

    // ── Laba Rugi Gabungan ────────────────────────────────────────────────────
    $params_lr = array_merge($entity_ids, [$date_from, $date_to]);
    $stmt_lr   = $pdo->prepare(
        "SELECT c.id, c.code, c.name, c.kategori,
                COALESCE(SUM(t.debit),  0) AS total_debit,
                COALESCE(SUM(t.kredit), 0) AS total_kredit
         FROM `Transaction` t
         JOIN CoaAccount c ON t.coaAccountId = c.id
         WHERE t.entityId IN ($placeholders)
           AND t.tanggal BETWEEN ? AND ?
           AND c.kategori IN ('PENDAPATAN','BEBAN')
           AND $report_cat_filter
         GROUP BY c.id, c.code, c.name, c.kategori
         ORDER BY c.code ASC"
    );
    $stmt_lr->execute($params_lr);
    $lr_rows = $stmt_lr->fetchAll();

    $pendapatan = [];
    $beban      = [];
    foreach ($lr_rows as $row) {
        $total_d = (float)$row['total_debit'];
        $total_k = (float)$row['total_kredit'];
        if ($row['kategori'] === 'PENDAPATAN') {
            $pendapatan[] = [
                'code'    => $row['code'],
                'name'    => $row['name'],
                'saldo'   => $total_k - $total_d,
                'debit'   => $total_d,
                'kredit'  => $total_k,
            ];
        } else {
            $beban[] = [
                'code'    => $row['code'],
                'name'    => $row['name'],
                'saldo'   => $total_d - $total_k,
                'debit'   => $total_d,
                'kredit'  => $total_k,
            ];
        }
    }

    // Beban penyusutan gabungan
    $total_beban_penyusutan_gabungan = 0.0;
    foreach ($entity_ids as $eid) {
        $total_beban_penyusutan_gabungan += total_beban_penyusutan($eid, $year);
    }
    if ($total_beban_penyusutan_gabungan > 0) {
        $beban[] = [
            'code'   => 'penyusutan_otomatis',
            'name'   => 'Beban Penyusutan Aset Tetap (otomatis)',
            'saldo'  => $total_beban_penyusutan_gabungan,
            'debit'  => $total_beban_penyusutan_gabungan,
            'kredit' => 0.0,
            'isAuto' => true,
        ];
    }

    $total_pendapatan = array_sum(array_column($pendapatan, 'saldo'));
    $total_beban      = array_sum(array_column($beban,      'saldo'));
    $laba_bersih      = $total_pendapatan - $total_beban;

    // ── Neraca Gabungan ───────────────────────────────────────────────────────
    $params_neraca = array_merge($entity_ids, [$year], $entity_ids, [$date_from, $date_to]);
    $stmt_neraca   = $pdo->prepare(
        "SELECT c.id, c.code, c.name, c.kategori, c.reportType,
                COALESCE(SUM(sa.nominal), 0) AS saldo_awal,
                COALESCE(SUM(t.debit),   0) AS total_debit,
                COALESCE(SUM(t.kredit),  0) AS total_kredit
         FROM CoaAccount c
         LEFT JOIN SaldoAwal sa
           ON sa.coaAccountId = c.id
           AND sa.entityId IN ($placeholders)
           AND sa.year = ?
         LEFT JOIN `Transaction` t
           ON  t.coaAccountId = c.id
           AND t.entityId IN ($placeholders)
           AND t.tanggal BETWEEN ? AND ?
         WHERE c.reportType IN ('NERACA','ARUS_KAS')
           AND $report_cat_filter
         GROUP BY c.id, c.code, c.name, c.kategori, c.reportType
         ORDER BY c.code ASC"
    );
    $stmt_neraca->execute($params_neraca);
    $neraca_rows = $stmt_neraca->fetchAll();

    $aktiva_lancar = [];
    $aktiva_tetap  = [];
    $kewajiban     = [];
    $modal         = [];

    $netting_pairs = [
        '111' => '311', '112' => '312', '113' => '313', '114' => '314', '115' => '315',
        '311' => '111', '312' => '112', '313' => '113', '314' => '114', '315' => '115',
    ];

    // Saldo map
    $saldo_map = [];
    foreach ($neraca_rows as $row) {
        $saldo = hitung_saldo_akhir(
            $row['kategori'], $row['code'],
            (float)$row['saldo_awal'],
            (float)$row['total_debit'],
            (float)$row['total_kredit']
        );
        $saldo_map[$row['code']] = $saldo;
    }

    $codes_netted = [];
    foreach ($neraca_rows as $row) {
        $code  = $row['code'];
        $saldo = $saldo_map[$code] ?? 0.0;

        if (isset($netting_pairs[$code]) && !in_array($code, $codes_netted)) {
            $pasangan = $netting_pairs[$code];
            $saldo_p  = $saldo_map[$pasangan] ?? 0.0;
            $codes_netted[] = $code;
            $codes_netted[] = $pasangan;
            $netto = $saldo - $saldo_p;
            if (abs($netto) < 0.01) continue;
            $entry = [
                'code'    => "$code↔$pasangan",
                'name'    => $row['name'] . ' (netto)',
                'saldo'   => abs($netto),
                'isNetting' => true,
            ];
            if ($netto >= 0) $aktiva_lancar[] = $entry;
            else             $kewajiban[]     = $entry;
            continue;
        }
        if (in_array($code, $codes_netted)) continue;

        $entry = ['id' => $row['id'], 'code' => $code, 'name' => $row['name'], 'saldo' => $saldo];
        if ($row['kategori'] === 'ASET') {
            if (is_aktiva_tetap($code, $row['name'])) $aktiva_tetap[]  = $entry;
            else                                       $aktiva_lancar[] = $entry;
        } elseif ($row['kategori'] === 'KEWAJIBAN') {
            $kewajiban[] = $entry;
        } elseif ($row['kategori'] === 'MODAL') {
            if (is_laba_ditahan($code, $row['name'])) {
                $entry['saldo']        += $laba_bersih;
                $entry['labaBerjalan']  = $laba_bersih;
            }
            $modal[] = $entry;
        }
    }

    // Akumulasi penyusutan gabungan
    $akumulasi_penyusutan = 0.0;
    foreach ($entity_ids as $eid) {
        $akumulasi_penyusutan += total_akumulasi_penyusutan($eid, $year);
    }
    if ($akumulasi_penyusutan > 0) {
        $aktiva_tetap[] = [
            'code'   => 'akumulasi_penyusutan',
            'name'   => 'Akumulasi Penyusutan (otomatis)',
            'saldo'  => -$akumulasi_penyusutan,
            'isAuto' => true,
        ];
    }

    $total_aktiva_lancar   = array_sum(array_column($aktiva_lancar, 'saldo'));
    $total_aktiva_tetap    = array_sum(array_column($aktiva_tetap,  'saldo'));
    $total_kewajiban       = array_sum(array_column($kewajiban,     'saldo'));
    $total_modal           = array_sum(array_column($modal,         'saldo'));

    // ── Arus Kas Gabungan ─────────────────────────────────────────────────────
    $params_ak = array_merge($entity_ids, [$year]);
    $stmt_ak   = $pdo->prepare(
        "SELECT MONTH(t.tanggal) AS bulan,
                COALESCE(SUM(t.debit),  0) AS total_masuk,
                COALESCE(SUM(t.kredit), 0) AS total_keluar
         FROM `Transaction` t
         JOIN CoaAccount c ON t.coaAccountId = c.id
         WHERE t.entityId IN ($placeholders)
           AND YEAR(t.tanggal)  = ?
           AND c.reportType     = 'ARUS_KAS'
         GROUP BY MONTH(t.tanggal)
         ORDER BY bulan ASC"
    );
    $stmt_ak->execute($params_ak);
    $ak_rows = $stmt_ak->fetchAll();

    $nama_bulan = [
        1=>'Januari',2=>'Februari',3=>'Maret',4=>'April',5=>'Mei',6=>'Juni',
        7=>'Juli',8=>'Agustus',9=>'September',10=>'Oktober',11=>'November',12=>'Desember',
    ];

    $ak_map = [];
    foreach ($ak_rows as $r) {
        $ak_map[(int)$r['bulan']] = ['masuk' => (float)$r['total_masuk'], 'keluar' => (float)$r['total_keluar']];
    }
    $arus_kas_monthly = [];
    for ($m = 1; $m <= 12; $m++) {
        $masuk  = $ak_map[$m]['masuk']  ?? 0.0;
        $keluar = $ak_map[$m]['keluar'] ?? 0.0;
        $arus_kas_monthly[] = [
            'bulan'     => $m,
            'namaBulan' => $nama_bulan[$m],
            'masuk'     => $masuk,
            'keluar'    => $keluar,
            'neto'      => $masuk - $keluar,
        ];
    }

    json_response([
        'entityIds'           => $entity_ids,
        'entities'            => $entities,
        'year'                => $year,
        'version'             => $version,
        'labaRugi' => [
            'pendapatan'      => $pendapatan,
            'beban'           => $beban,
            'totalPendapatan' => $total_pendapatan,
            'totalBeban'      => $total_beban,
            'labaBersih'      => $laba_bersih,
            'bebanPenyusutan' => $total_beban_penyusutan_gabungan,
        ],
        'neraca' => [
            'aktivaLancar'       => $aktiva_lancar,
            'aktivaTetap'        => $aktiva_tetap,
            'kewajiban'          => $kewajiban,
            'modal'              => $modal,
            'totalAktivaLancar'  => $total_aktiva_lancar,
            'totalAktivaTetap'   => $total_aktiva_tetap,
            'totalAktiva'        => $total_aktiva_lancar + $total_aktiva_tetap,
            'totalKewajiban'     => $total_kewajiban,
            'totalModal'         => $total_modal,
            'totalKewajibanModal'=> $total_kewajiban + $total_modal,
            'akumulasiPenyusutan'=> $akumulasi_penyusutan,
        ],
        'arusKas' => [
            'monthly'     => $arus_kas_monthly,
            'totalMasuk'  => array_sum(array_column($arus_kas_monthly, 'masuk')),
            'totalKeluar' => array_sum(array_column($arus_kas_monthly, 'keluar')),
            'totalNeto'   => array_sum(array_column($arus_kas_monthly, 'neto')),
        ],
    ]);
}

error_response('Endpoint tidak ditemukan.', 404);
