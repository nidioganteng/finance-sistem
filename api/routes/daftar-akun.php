<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

require_once __DIR__ . '/../helpers/akuntansi-helpers.php';

$user = require_auth();

// GET /api/daftar-akun?entityId=...&year=...&version=INTERNAL|UMUM
if ($method === 'GET') {
    $entity_id = $_GET['entityId'] ?? null;
    $year      = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
    $version   = strtoupper($_GET['version'] ?? 'INTERNAL');

    if (!$entity_id) error_response('entityId diperlukan.', 400);

    $pdo = get_pdo();

    $report_cat_filter = $version === 'UMUM'
        ? "c.report_category IN ('UMUM','SEMUA')"
        : "c.report_category IN ('INTERNAL','SEMUA')";

    $date_from = "$year-01-01 00:00:00";
    $date_to   = "$year-12-31 23:59:59";

    // Exclusion list noBukti untuk isolasi versi UMUM vs INTERNAL
    $excluded_nobukti = get_excluded_no_bukti_for_version($pdo, $entity_id, $year, $version);
    $nobukti_sql = '';
    $nobukti_params = [];
    if (!empty($excluded_nobukti)) {
        $placeholders = implode(',', array_fill(0, count($excluded_nobukti), '?'));
        $nobukti_sql = " AND (t.noBukti IS NULL OR t.noBukti NOT IN ($placeholders))";
        $nobukti_params = $excluded_nobukti;
    }

    $stmt = $pdo->prepare(
        "SELECT c.id, c.code, c.name, c.kategori, c.reportType,
                c.report_category AS reportCategory, c.urutan,
                COALESCE(sa.nominal, 0)         AS saldo_awal,
                COALESCE(SUM(t.debit),  0)      AS total_debit,
                COALESCE(SUM(t.kredit), 0)      AS total_kredit
         FROM CoaAccount c
         LEFT JOIN SaldoAwal sa
           ON sa.coaAccountId = c.id
           AND sa.entityId    = ?
           AND sa.year        = ?
         LEFT JOIN `Transaction` t
           ON  t.coaAccountId = c.id
           AND t.entityId     = ?
           AND t.tanggal BETWEEN ? AND ?
           AND (t.extraFieldsJson IS NULL OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') IS NULL OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') != 'true')
           $nobukti_sql
         WHERE $report_cat_filter
         GROUP BY c.id, c.code, c.name, c.kategori, c.reportType,
                  c.report_category, c.urutan, sa.nominal
         ORDER BY c.urutan ASC, c.code ASC"
    );
    $stmt->execute(array_merge([$entity_id, $year, $entity_id, $date_from, $date_to], $nobukti_params));
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $result = [];
    foreach ($rows as $row) {
        $saldo_awal   = (float)$row['saldo_awal'];
        $total_debit  = (float)$row['total_debit'];
        $total_kredit = (float)$row['total_kredit'];
        $saldo_akhir  = hitung_saldo_akhir($row['kategori'], $row['code'], $saldo_awal, $total_debit, $total_kredit);
        $alokasi      = in_array($row['kategori'], ['PENDAPATAN', 'BEBAN']) ? 'LABA_RUGI' : 'NERACA';

        $fmt_rp = function(float $n): string {
            return 'Rp ' . number_format($n, 0, ',', '.');
        };

        $result[] = [
            'id'                => $row['id'],
            'coaId'             => $row['id'],
            'code'              => $row['code'],
            'name'              => $row['name'],
            'kategori'          => $row['kategori'],
            'reportType'        => $row['reportType'],
            'reportCategory'    => $row['reportCategory'],
            'urutan'            => (int)$row['urutan'],
            'saldoAwal'         => $saldo_awal,
            'totalDebet'        => $total_debit,
            'totalDebit'        => $total_debit,
            'totalKredit'       => $total_kredit,
            'saldoAkhir'        => $saldo_akhir,
            'saldoAwalFmt'      => $fmt_rp(abs($saldo_awal)),
            'totalDebetFmt'     => $total_debit > 0 ? $fmt_rp($total_debit) : '-',
            'totalKreditFmt'    => $total_kredit > 0 ? $fmt_rp($total_kredit) : '-',
            'saldoAkhirFmt'     => $fmt_rp(abs($saldo_akhir)),
            'saldoAkhirNegatif' => $saldo_akhir < 0,
            'punyaTransaksi'    => ($total_debit > 0 || $total_kredit > 0),
            'alokasi'           => $alokasi,
        ];
    }

    json_response([
        'entityId' => $entity_id,
        'year'     => $year,
        'version'  => $version,
        'akun'     => $result,
    ]);
}

error_response('Endpoint tidak ditemukan.', 404);
