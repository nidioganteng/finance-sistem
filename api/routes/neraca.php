<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

require_once __DIR__ . '/../helpers/akuntansi-helpers.php';

$user = require_auth();

// GET /api/neraca?entityId=...&year=...&version=INTERNAL|UMUM
if ($method === 'GET') {
    $entity_id = $_GET['entityId'] ?? null;
    $year      = isset($_GET['year'])    ? (int)$_GET['year']    : (int)date('Y');
    $version   = strtoupper($_GET['version'] ?? 'INTERNAL');

    if (!$entity_id) error_response('entityId diperlukan.', 400);
    if (!in_array($version, ['INTERNAL', 'UMUM'])) error_response("version tidak valid. Pilihan: INTERNAL, UMUM", 400);

    $pdo = get_pdo();

    // Filter reportCategory berdasarkan versi
    $report_cat_filter = $version === 'INTERNAL'
        ? "c.report_category IN ('INTERNAL','SEMUA')"
        : "c.report_category IN ('UMUM','SEMUA')";

    $date_from = "$year-01-01 00:00:00";
    $date_to   = "$year-12-31 23:59:59";

    // ── Ambil semua akun NERACA + ARUS_KAS dengan saldo ──────────────────────
    $stmt = $pdo->prepare(
        "SELECT c.id, c.code, c.name, c.kategori, c.reportType, c.report_category AS reportCategory,
                COALESCE(sa.nominal, 0) AS saldo_awal,
                COALESCE(SUM(t.debit),  0) AS total_debit,
                COALESCE(SUM(t.kredit), 0) AS total_kredit
         FROM CoaAccount c
         LEFT JOIN SaldoAwal sa
           ON sa.coaAccountId = c.id AND sa.entityId = ? AND sa.year = ?
         LEFT JOIN `Transaction` t
           ON  t.coaAccountId = c.id
           AND t.entityId     = ?
           AND t.tanggal BETWEEN ? AND ?
         WHERE c.reportType IN ('NERACA','ARUS_KAS')
           AND $report_cat_filter
         GROUP BY c.id, c.code, c.name, c.kategori, c.reportType, c.report_category, sa.nominal
         ORDER BY c.code ASC"
    );
    $stmt->execute([$entity_id, $year, $entity_id, $date_from, $date_to]);
    $all_akun = $stmt->fetchAll();

    // ── Hitung laba bersih dari akun Laba/Rugi ───────────────────────────────
    $stmt_lr = $pdo->prepare(
        "SELECT c.code, c.name, c.kategori,
                COALESCE(SUM(t.debit),  0) AS total_debit,
                COALESCE(SUM(t.kredit), 0) AS total_kredit
         FROM CoaAccount c
         JOIN `Transaction` t
           ON  t.coaAccountId = c.id
           AND t.entityId     = ?
           AND t.tanggal BETWEEN ? AND ?
         WHERE c.kategori IN ('PENDAPATAN','BEBAN')
           AND $report_cat_filter
         GROUP BY c.id, c.code, c.name, c.kategori"
    );
    $stmt_lr->execute([$entity_id, $date_from, $date_to]);
    $lr_rows = $stmt_lr->fetchAll();

    $total_pendapatan = 0.0;
    $total_beban      = 0.0;
    foreach ($lr_rows as $lr) {
        if ($lr['kategori'] === 'PENDAPATAN') {
            // Pendapatan kredit-normal: saldo = kredit - debit
            $total_pendapatan += (float)$lr['total_kredit'] - (float)$lr['total_debit'];
        } else {
            // Beban debit-normal: saldo = debit - kredit
            $total_beban += (float)$lr['total_debit'] - (float)$lr['total_kredit'];
        }
    }

    // Tambahkan beban penyusutan
    $beban_penyusutan = total_beban_penyusutan($entity_id, $year);
    $total_beban     += $beban_penyusutan;
    $laba_bersih      = $total_pendapatan - $total_beban;

    // ── Akumulasi penyusutan untuk neraca ────────────────────────────────────
    $akumulasi_penyusutan = total_akumulasi_penyusutan($entity_id, $year);

    // ── Mapping kode piutang ↔ hutang antar entitas untuk netting ────────────
    // 111↔311, 112↔312, 113↔313, 114↔314, 115↔315
    $netting_pairs = [
        '111' => '311', '112' => '312', '113' => '313', '114' => '314', '115' => '315',
        '311' => '111', '312' => '112', '313' => '113', '314' => '114', '315' => '115',
    ];

    // ── Kelompokkan akun ke bagian neraca ────────────────────────────────────
    $aktiva_lancar   = [];
    $aktiva_tetap    = [];
    $kewajiban       = [];
    $modal           = [];

    // Bangun map saldo per code untuk netting
    $saldo_per_code = [];
    foreach ($all_akun as $row) {
        $saldo = hitung_saldo_akhir(
            $row['kategori'], $row['code'],
            (float)$row['saldo_awal'],
            (float)$row['total_debit'],
            (float)$row['total_kredit']
        );
        $saldo_per_code[$row['code']] = $saldo;
    }

    $codes_netted = []; // kode yang sudah dienetting (jangan tampilkan dua kali)

    foreach ($all_akun as $row) {
        $code        = $row['code'];
        $saldo       = $saldo_per_code[$code];
        $is_aktiva   = in_array($row['kategori'], ['ASET']);
        $is_kewajiban= $row['kategori'] === 'KEWAJIBAN';
        $is_modal    = $row['kategori'] === 'MODAL';

        // Netting piutang-hutang antar entitas
        if (isset($netting_pairs[$code]) && !in_array($code, $codes_netted)) {
            $pasangan_code  = $netting_pairs[$code];
            $saldo_pasangan = $saldo_per_code[$pasangan_code] ?? 0.0;
            $codes_netted[] = $code;
            $codes_netted[] = $pasangan_code;

            $netto = $saldo - $saldo_pasangan;
            if (abs($netto) < 0.01) continue; // skip jika saldo nol setelah netting

            $entry = [
                'code'        => $code . '↔' . $pasangan_code,
                'name'        => $row['name'] . ' (netto)',
                'saldo'       => $netto,
                'kategori'    => $netto >= 0 ? 'ASET' : 'KEWAJIBAN',
                'isNetting'   => true,
            ];
            if ($netto >= 0) {
                $aktiva_lancar[] = $entry;
            } else {
                $kewajiban[] = array_merge($entry, ['saldo' => abs($netto)]);
            }
            continue;
        }

        if (in_array($code, $codes_netted)) continue;

        $entry = [
            'id'       => $row['id'],
            'code'     => $code,
            'name'     => $row['name'],
            'kategori' => $row['kategori'],
            'saldo'    => $saldo,
        ];

        if ($is_aktiva) {
            if (is_aktiva_tetap($code, $row['name'])) {
                $aktiva_tetap[] = $entry;
            } else {
                $aktiva_lancar[] = $entry;
            }
        } elseif ($is_kewajiban) {
            $kewajiban[] = $entry;
        } elseif ($is_modal) {
            if (is_laba_ditahan($code, $row['name'])) {
                // Tambahkan laba bersih tahun berjalan ke laba ditahan
                $entry['saldo']        += $laba_bersih;
                $entry['labaBerjalan']  = $laba_bersih;
            }
            $modal[] = $entry;
        }
    }

    // Tambahkan akumulasi penyusutan sebagai pengurang aktiva tetap
    if ($akumulasi_penyusutan > 0) {
        $aktiva_tetap[] = [
            'code'     => 'akumulasi_penyusutan',
            'name'     => 'Akumulasi Penyusutan (otomatis)',
            'kategori' => 'ASET',
            'saldo'    => -$akumulasi_penyusutan,
            'isAuto'   => true,
        ];
    }

    // Totals
    $total_aktiva_lancar = array_sum(array_column($aktiva_lancar, 'saldo'));
    $total_aktiva_tetap  = array_sum(array_column($aktiva_tetap,  'saldo'));
    $total_aktiva        = $total_aktiva_lancar + $total_aktiva_tetap;
    $total_kewajiban     = array_sum(array_column($kewajiban,     'saldo'));
    $total_modal         = array_sum(array_column($modal,         'saldo'));
    $total_kewajiban_modal = $total_kewajiban + $total_modal;

    json_response([
        'entityId'           => $entity_id,
        'year'               => $year,
        'version'            => $version,
        'aktivaLancar'       => $aktiva_lancar,
        'aktivaTetap'        => $aktiva_tetap,
        'kewajiban'          => $kewajiban,
        'modal'              => $modal,
        'totalAktivaLancar'  => $total_aktiva_lancar,
        'totalAktivaTetap'   => $total_aktiva_tetap,
        'totalAktiva'        => $total_aktiva,
        'totalKewajiban'     => $total_kewajiban,
        'totalModal'         => $total_modal,
        'totalKewajibanModal'=> $total_kewajiban_modal,
        'labaBersih'         => $laba_bersih,
        'totalPendapatan'    => $total_pendapatan,
        'totalBeban'         => $total_beban,
        'bebanPenyusutan'    => $beban_penyusutan,
        'akumulasiPenyusutan'=> $akumulasi_penyusutan,
        'selisih'            => round($total_aktiva - $total_kewajiban_modal, 2),
    ]);
}

error_response('Endpoint tidak ditemukan.', 404);
