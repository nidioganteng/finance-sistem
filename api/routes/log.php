<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

$auth_user = require_auth();

// POST /api/log — tulis aktivitas (semua role yang sudah login boleh kirim log)
if ($method === 'POST') {
    $actor_id = $body['actorId']  ?? $auth_user['id'];
    $action   = trim($body['action']   ?? '');
    $category = trim($body['category'] ?? 'USER_ACTIVITY');
    $detail   = $body['detail'] ?? null;

    if (!$action) error_response('action wajib diisi.', 400);
    if (!in_array($category, ['USER_ACTIVITY', 'FINANCIAL_CHANGE'], true)) {
        error_response('category tidak valid.', 400);
    }

    log_activity($actor_id, $action, $category, $detail);
    json_response(['ok' => true]);
}

// Hanya SUPER_ADMIN dan MANAJER_KEUANGAN yang boleh baca log
$allowedRoles = ['SUPER_ADMIN', 'MANAJER_KEUANGAN'];
if (!in_array($auth_user['role'], $allowedRoles, true)) {
    error_response('Akses ditolak. Hanya Super Admin dan Manajer Keuangan yang dapat melihat log.', 403);
}

// GET /api/log?category=USER_ACTIVITY
if ($method === 'GET') {
    $pdo      = get_pdo();
    $category = $_GET['category'] ?? null; // USER_ACTIVITY | FINANCIAL_CHANGE | null = semua

    // Auto-hapus USER_ACTIVITY yang lebih dari 30 hari (hanya dijalankan oleh Super Admin)
    if ($auth_user['role'] === 'SUPER_ADMIN') {
        $pdo->exec(
            "DELETE FROM ActivityLog
             WHERE category = 'USER_ACTIVITY'
               AND createdAt < DATE_SUB(NOW(), INTERVAL 30 DAY)"
        );
    }

    $page   = max(1, (int)($_GET['page'] ?? 1));
    $limit  = (int)($_GET['limit'] ?? 50);
    $limit  = min(200, max(10, $limit));
    $offset = ($page - 1) * $limit;

    $whereClause = '';
    $params      = [];

    if ($category && in_array($category, ['USER_ACTIVITY', 'FINANCIAL_CHANGE'], true)) {
        $whereClause = 'WHERE al.category = ?';
        $params[]    = $category;
    }

    $stmtCount = $pdo->prepare(
        "SELECT COUNT(*) FROM ActivityLog al $whereClause"
    );
    $stmtCount->execute($params);
    $total = (int)$stmtCount->fetchColumn();

    $paramsWithPaging = $params;
    $stmt = $pdo->prepare(
        "SELECT al.id, al.actorId, al.action, al.category, al.detail, al.createdAt,
                u.name AS actorName, u.email AS actorEmail, u.role AS actorRole
         FROM ActivityLog al
         LEFT JOIN User u ON al.actorId = u.id
         $whereClause
         ORDER BY al.createdAt DESC
         LIMIT $limit OFFSET $offset"
    );
    $stmt->execute($paramsWithPaging);
    $rows = $stmt->fetchAll();

    foreach ($rows as &$row) {
        // Decode detail JSON jika berupa string
        if (isset($row['detail']) && is_string($row['detail'])) {
            $decoded = json_decode($row['detail'], true);
            $row['detail'] = $decoded !== null ? $decoded : $row['detail'];
        }
    }
    unset($row);

    json_response([
        'data'       => $rows,
        'pagination' => [
            'page'       => $page,
            'limit'      => $limit,
            'total'      => $total,
            'totalPages' => (int)ceil($total / $limit),
        ],
    ]);
}

error_response('Endpoint tidak ditemukan.', 404);
