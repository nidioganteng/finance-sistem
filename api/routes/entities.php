<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

// ────────────────────────────────────────────────────────────────────────────
// GET /api/entities
// ────────────────────────────────────────────────────────────────────────────
if ($method === 'GET' && !isset($segments[1])) {
    require_auth(); // endpoint butuh login

    $pdo = get_pdo();

    // Optional ?key=xxx filter untuk lookup satu entity
    $key_filter = $_GET['key'] ?? null;
    if ($key_filter) {
        $stmt = $pdo->prepare(
            'SELECT id, `key`, name, legalName, colorHex, isUmum, createdAt
               FROM Entity WHERE `key` = ? LIMIT 1'
        );
        $stmt->execute([trim($key_filter)]);
        $row = $stmt->fetch();
        if (!$row) error_response('Entity tidak ditemukan.', 404);
        $row['isUmum'] = (bool) $row['isUmum'];
        json_response($row);
    }

    $stmt = $pdo->query(
        'SELECT id, `key`, name, legalName, colorHex, isUmum, createdAt
           FROM Entity
          ORDER BY createdAt ASC'
    );
    $rows = $stmt->fetchAll();

    foreach ($rows as &$row) {
        $row['isUmum'] = (bool) $row['isUmum'];
    }
    unset($row);

    json_response($rows);
}

error_response('Endpoint tidak ditemukan.', 404);
