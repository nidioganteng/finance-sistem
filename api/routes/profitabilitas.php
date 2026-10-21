<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

$user = require_auth();

// GET /api/profitabilitas?entityId=...&year=...
if ($method === 'GET') {
    $entity_id = $_GET['entityId'] ?? null;
    $year      = isset($_GET['year']) ? (int)$_GET['year'] : null;

    if (!$entity_id) error_response('entityId diperlukan.', 400);

    $pdo = get_pdo();

    $sql    = 'SELECT p.id, p.code, p.name, p.contractValue, p.spend, p.status,
                      p.deadline, p.createdAt,
                      MAX(tr.percentage) AS max_termin_pct,
                      COUNT(DISTINCT tr.id) AS termin_count
               FROM Project p
               LEFT JOIN Termin tr ON tr.projectId = p.id
               WHERE p.entityId = ?';
    $params = [$entity_id];

    if ($year !== null) {
        $sql    .= ' AND YEAR(p.createdAt) = ?';
        $params[] = $year;
    }

    $sql .= ' GROUP BY p.id, p.code, p.name, p.contractValue, p.spend, p.status, p.deadline, p.createdAt
              ORDER BY p.createdAt DESC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $projects = $stmt->fetchAll();

    // Hitung spend aktual dari COA BEBAN per proyek (lebih akurat dari Project.spend yang ter-cache)
    $spend_sql    = 'SELECT t.projectId, SUM(t.debit - t.kredit) AS coa_spend
                     FROM `Transaction` t
                     JOIN CoaAccount c ON c.id = t.coaAccountId AND c.kategori = \'BEBAN\'
                     WHERE t.entityId = ? AND t.projectId IS NOT NULL';
    $spend_params = [$entity_id];
    if ($year !== null) {
        $spend_sql    .= ' AND YEAR(t.tanggal) = ?';
        $spend_params[] = $year;
    }
    $spend_sql .= ' GROUP BY t.projectId';
    $stmt_spend = $pdo->prepare($spend_sql);
    $stmt_spend->execute($spend_params);
    $coa_spend_map = [];
    while ($sr = $stmt_spend->fetch()) {
        $coa_spend_map[$sr['projectId']] = (float)$sr['coa_spend'];
    }

    // Honor sudah merupakan biaya bruto proyek; tambahkan hanya yang belum dijurnal.
    $honor_sql = "SELECT h.projectId, SUM(h.nominalHonor) AS honor_spend
        FROM HonorTenagaAhli h JOIN Project p ON p.id = h.projectId
        WHERE p.entityId = ?";
    $honor_params = [$entity_id];
    if ($year !== null) { $honor_sql .= ' AND h.tahun = ?'; $honor_params[] = $year; }
    $honor_sql .= " AND NOT EXISTS (SELECT 1 FROM `Transaction` t JOIN CoaAccount c ON c.id = t.coaAccountId
        WHERE t.projectId = h.projectId AND t.entityId = p.entityId AND c.kategori = 'BEBAN'
        AND h.noBukti IS NOT NULL AND h.noBukti <> '' AND t.noBukti = h.noBukti";
    if ($year !== null) { $honor_sql .= ' AND YEAR(t.tanggal) = ?'; $honor_params[] = $year; }
    $honor_sql .= ') GROUP BY h.projectId';
    $stmt_honor = $pdo->prepare($honor_sql);
    $stmt_honor->execute($honor_params);
    $honor_spend_map = [];
    foreach ($stmt_honor->fetchAll(PDO::FETCH_ASSOC) as $honor) $honor_spend_map[$honor['projectId']] = (float)$honor['honor_spend'];

    $result = [];
    foreach ($projects as $p) {
        $contract_value = (float)$p['contractValue'];
        // Gunakan COA BEBAN sebagai sumber utama; fallback ke Project.spend
        $spend  = isset($coa_spend_map[$p['id']])
            ? max(0.0, $coa_spend_map[$p['id']]) + ($honor_spend_map[$p['id']] ?? 0.0)
            : (float)$p['spend'];
        $profit = $contract_value - $spend;
        $margin = $contract_value > 0 ? round($profit / $contract_value * 100, 2) : 0.0;

        $result[] = [
            'id'             => $p['id'],
            'code'           => $p['code'],
            'name'           => $p['name'],
            'contractValue'  => $contract_value,
            'spend'          => $spend,
            'spendSource'    => isset($coa_spend_map[$p['id']]) ? 'COA_BEBAN' : 'project_spend',
            'profit'         => $profit,
            'marginPersen'   => $margin,
            'status'         => $p['status'],
            'deadline'       => $p['deadline'],
            'createdAt'      => $p['createdAt'],
            'maxTerminPct'   => $p['max_termin_pct'] !== null ? (int)$p['max_termin_pct'] : null,
            'terminCount'    => (int)$p['termin_count'],
        ];
    }

    // Ringkasan agregat
    $total_contract = array_sum(array_column($result, 'contractValue'));
    $total_spend    = array_sum(array_column($result, 'spend'));
    $total_profit   = $total_contract - $total_spend;
    $avg_margin     = $total_contract > 0
        ? round($total_profit / $total_contract * 100, 2)
        : 0.0;

    $count_by_status = ['ACTIVE' => 0, 'COMPLETED' => 0, 'CANCELLED' => 0];
    foreach ($result as $r) {
        if (isset($count_by_status[$r['status']])) {
            $count_by_status[$r['status']]++;
        }
    }

    json_response([
        'entityId'      => $entity_id,
        'year'          => $year,
        'projects'      => $result,
        'summary'       => [
            'totalProyek'    => count($result),
            'countByStatus'  => $count_by_status,
            'totalContract'  => $total_contract,
            'totalSpend'     => $total_spend,
            'totalProfit'    => $total_profit,
            'avgMarginPersen'=> $avg_margin,
        ],
    ]);
}

error_response('Endpoint tidak ditemukan.', 404);
