<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

require_once __DIR__ . '/../helpers/akuntansi-helpers.php';

$user = require_auth();

// GET /api/daftar-akun?entityId=...&year=...
if ($method === 'GET') {
    $entity_id = $_GET['entityId'] ?? null;
    $year      = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');

    if (!$entity_id) error_response('entityId diperlukan.', 400);

    $pdo = get_pdo();

    $stmt = $pdo->prepare(
        'SELECT c.id, c.code, c.name, c.kategori, c.reportType,
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
           AND YEAR(t.tanggal) = ?
         GROUP BY c.id, c.code, c.name, c.kategori, c.reportType,
                  c.report_category, c.urutan, sa.nominal
         ORDER BY c.urutan ASC, c.code ASC'
    );
    $stmt->execute([$entity_id, $year, $entity_id, $year]);
    $rows = $stmt->fetchAll();

    $result = [];
    foreach ($rows as $row) {
        $saldo_awal   = (float)$row['saldo_awal'];
        $total_debit  = (float)$row['total_debit'];
        $total_kredit = (float)$row['total_kredit'];
        $saldo_akhir  = hitung_saldo_akhir($row['kategori'], $row['code'], $saldo_awal, $total_debit, $total_kredit);

        $result[] = [
            'id'             => $row['id'],
            'code'           => $row['code'],
            'name'           => $row['name'],
            'kategori'       => $row['kategori'],
            'reportType'     => $row['reportType'],
            'reportCategory' => $row['reportCategory'],
            'urutan'         => (int)$row['urutan'],
            'saldoAwal'      => $saldo_awal,
            'totalDebit'     => $total_debit,
            'totalKredit'    => $total_kredit,
            'saldoAkhir'     => $saldo_akhir,
        ];
    }

    json_response([
        'entityId' => $entity_id,
        'year'     => $year,
        'akun'     => $result,
    ]);
}

error_response('Endpoint tidak ditemukan.', 404);
