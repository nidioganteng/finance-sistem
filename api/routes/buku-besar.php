<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

require_once __DIR__ . '/../helpers/akuntansi-helpers.php';

$user = require_auth();

// GET /api/buku-besar?entityId=...&year=...&view=rekap|drilldown[&coaId=...]
if ($method === 'GET') {
    $entity_id = $_GET['entityId'] ?? null;
    $year      = isset($_GET['year'])  ? (int)$_GET['year']  : (int)date('Y');
    $view      = $_GET['view']    ?? 'rekap';
    $coa_id    = $_GET['coaId']   ?? null;

    if (!$entity_id) error_response('entityId diperlukan.', 400);

    $date_from = "$year-01-01 00:00:00";
    $date_to   = "$year-12-31 23:59:59";

    $pdo = get_pdo();

    // ── Rekap: 1 baris per akun ──────────────────────────────────────────────
    if ($view === 'rekap') {
        $stmt = $pdo->prepare(
            'SELECT c.id, c.code, c.name, c.kategori, c.reportType,
                    COALESCE(SUM(t.debit),  0) AS total_debit,
                    COALESCE(SUM(t.kredit), 0) AS total_kredit,
                    COALESCE(sa.nominal,    0) AS saldo_awal
             FROM CoaAccount c
             LEFT JOIN `Transaction` t
               ON  t.coaAccountId = c.id
               AND t.entityId     = ?
               AND t.tanggal BETWEEN ? AND ?
               AND (
                   JSON_VALUE(t.extraFieldsJson, \'$.autoPostedFromJurnal\') IS NULL
                   OR JSON_VALUE(t.extraFieldsJson, \'$.isKasEntry\') = \'true\'
               )
             LEFT JOIN SaldoAwal sa
               ON  sa.coaAccountId = c.id
               AND sa.entityId     = ?
               AND sa.year         = ?
             WHERE (t.id IS NOT NULL OR sa.id IS NOT NULL)
             GROUP BY c.id, c.code, c.name, c.kategori, c.reportType, sa.nominal
             ORDER BY c.code ASC'
        );
        $stmt->execute([$entity_id, $date_from, $date_to, $entity_id, $year]);
        $rows = $stmt->fetchAll();

        $result = [];
        foreach ($rows as $row) {
            $saldo_awal    = (float)$row['saldo_awal'];
            $total_debit   = (float)$row['total_debit'];
            $total_kredit  = (float)$row['total_kredit'];
            $saldo_akhir   = hitung_saldo_akhir($row['kategori'], $row['code'], $saldo_awal, $total_debit, $total_kredit);

            $result[] = [
                'id'          => $row['id'],
                'code'        => $row['code'],
                'name'        => $row['name'],
                'kategori'    => $row['kategori'],
                'reportType'  => $row['reportType'],
                'saldoAwal'   => $saldo_awal,
                'totalDebit'  => $total_debit,
                'totalKredit' => $total_kredit,
                'saldoAkhir'  => $saldo_akhir,
            ];
        }

        json_response(['view' => 'rekap', 'year' => $year, 'data' => $result]);
    }

    // ── Drilldown: semua baris transaksi untuk satu akun ────────────────────
    if ($view === 'drilldown') {
        if (!$coa_id) error_response('coaId diperlukan untuk view drilldown.', 400);

        // Ambil info akun & saldo awal
        $stmt = $pdo->prepare('SELECT id, code, name, kategori FROM CoaAccount WHERE id = ?');
        $stmt->execute([$coa_id]);
        $coa = $stmt->fetch();
        if (!$coa) error_response('Akun tidak ditemukan.', 404);

        $stmt_sa = $pdo->prepare(
            'SELECT COALESCE(nominal, 0) AS nominal
             FROM SaldoAwal
             WHERE entityId = ? AND coaAccountId = ? AND year = ?'
        );
        $stmt_sa->execute([$entity_id, $coa_id, $year]);
        $sa_row    = $stmt_sa->fetch();
        $saldo_awal = $sa_row ? (float)$sa_row['nominal'] : 0.0;

        // Transaksi
        $stmt = $pdo->prepare(
            'SELECT t.id, t.tanggal, t.noBukti, t.keterangan, t.debit, t.kredit, t.saldoSetelah,
                    t.createdAt, c.code AS coa_code, c.name AS coa_name, c.kategori
             FROM `Transaction` t
             JOIN CoaAccount c ON t.coaAccountId = c.id
             WHERE t.entityId     = ?
               AND t.coaAccountId = ?
               AND t.tanggal BETWEEN ? AND ?
               AND (
                   JSON_VALUE(t.extraFieldsJson, \'$.autoPostedFromJurnal\') IS NULL
                   OR JSON_VALUE(t.extraFieldsJson, \'$.isKasEntry\') = \'true\'
               )
             ORDER BY t.tanggal ASC, t.createdAt ASC'
        );
        $stmt->execute([$entity_id, $coa_id, $date_from, $date_to]);
        $rows = $stmt->fetchAll();

        // Hitung saldo berjalan dari saldo awal
        $running = $saldo_awal;
        $transactions = [];
        foreach ($rows as $row) {
            $debit  = (float)$row['debit'];
            $kredit = (float)$row['kredit'];
            $running = hitung_saldo_akhir($row['kategori'], $row['coa_code'], $running, $debit, $kredit);
            $transactions[] = [
                'id'          => $row['id'],
                'tanggal'     => $row['tanggal'],
                'noBukti'     => $row['noBukti'],
                'keterangan'  => $row['keterangan'],
                'debit'       => $debit,
                'kredit'      => $kredit,
                'saldoBerjalan' => $running,
                'createdAt'   => $row['createdAt'],
            ];
        }

        $total_debit  = array_sum(array_column($rows, 'debit'));
        $total_kredit = array_sum(array_column($rows, 'kredit'));
        $saldo_akhir  = hitung_saldo_akhir($coa['kategori'], $coa['code'], $saldo_awal, $total_debit, $total_kredit);

        json_response([
            'view'         => 'drilldown',
            'year'         => $year,
            'akun'         => [
                'id'       => $coa['id'],
                'code'     => $coa['code'],
                'name'     => $coa['name'],
                'kategori' => $coa['kategori'],
            ],
            'saldoAwal'    => $saldo_awal,
            'totalDebit'   => (float)$total_debit,
            'totalKredit'  => (float)$total_kredit,
            'saldoAkhir'   => $saldo_akhir,
            'transactions' => $transactions,
        ]);
    }

    error_response("Parameter 'view' tidak valid. Pilihan: rekap, drilldown.", 400);
}

error_response('Endpoint tidak ditemukan.', 404);
