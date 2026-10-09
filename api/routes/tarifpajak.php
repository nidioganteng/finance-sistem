<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

$user = require_auth();

// GET /api/tarifpajak
if ($method === 'GET') {
    $pdo  = get_pdo();
    $stmt = $pdo->query(
        'SELECT id, nama, jenis, tarifPersen, tanggalMulai, tanggalSelesai, active, createdAt
         FROM TarifPajak
         WHERE active = 1
         ORDER BY jenis ASC, tanggalMulai DESC'
    );
    $rows = $stmt->fetchAll();

    foreach ($rows as &$r) {
        $r['tarifPersen'] = (float)$r['tarifPersen'];
        $r['active']      = (bool)$r['active'];
    }
    unset($r);

    json_response($rows);
}

error_response('Endpoint tidak ditemukan.', 404);
