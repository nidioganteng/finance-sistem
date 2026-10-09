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
                      COUNT(tr.id)       AS termin_count
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

    $result = [];
    foreach ($projects as $p) {
        $contract_value = (float)$p['contractValue'];
        $spend          = (float)$p['spend'];
        $profit         = $contract_value - $spend;
        $margin         = $contract_value > 0 ? round($profit / $contract_value * 100, 2) : 0.0;

        $result[] = [
            'id'             => $p['id'],
            'code'           => $p['code'],
            'name'           => $p['name'],
            'contractValue'  => $contract_value,
            'spend'          => $spend,
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
