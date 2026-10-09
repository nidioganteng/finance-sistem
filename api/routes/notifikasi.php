<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

$auth_user = require_auth();
$sub       = $segments[1] ?? null; // 'read' | 'read-all' | 'count' | null

// GET /api/notifikasi/count?role=SUPER_ADMIN  — jumlah notifikasi belum dibaca untuk role
if ($method === 'GET' && $sub === 'count') {
    $role = $_GET['role'] ?? $auth_user['role'];

    $pdo  = get_pdo();
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM Notifikasi WHERE targetRole = ? AND `read` = 0");
    $stmt->execute([$role]);
    $count = (int)$stmt->fetchColumn();

    json_response(['count' => $count]);
}

// GET /api/notifikasi?filter=all|unread|<TYPE>&page=1
if ($method === 'GET' && !$sub) {
    $filter = $_GET['filter'] ?? 'all'; // all | unread | <NotifikasiType>
    $page   = max(1, (int)($_GET['page'] ?? 1));
    $limit  = 20;
    $offset = ($page - 1) * $limit;

    $pdo  = get_pdo();
    $role = $auth_user['role'];

    $params      = [$role];
    $whereExtra  = '';

    if ($filter === 'unread') {
        $whereExtra = "AND n.`read` = 0";
    } elseif ($filter !== 'all' && $filter !== 'semua' && $filter !== '') {
        // Filter by notification type (e.g. TERMIN_BARU, PENDAFTARAN, ...)
        $whereExtra = "AND n.type = ?";
        $params[]   = $filter;
    }

    $stmtCount = $pdo->prepare(
        "SELECT COUNT(*) FROM Notifikasi n WHERE n.targetRole = ? $whereExtra"
    );
    $stmtCount->execute($params);
    $total = (int)$stmtCount->fetchColumn();

    $stmt = $pdo->prepare(
        "SELECT n.id, n.type, n.targetRole, n.text, n.`read`, n.createdAt
         FROM Notifikasi n
         WHERE n.targetRole = ? $whereExtra
         ORDER BY n.createdAt DESC
         LIMIT $limit OFFSET $offset"
    );
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    foreach ($rows as &$row) {
        $row['read'] = (bool)$row['read'];
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

// POST /api/notifikasi/read   body: {id}
if ($method === 'POST' && $sub === 'read') {
    $id   = $body['id'] ?? null;
    $role = $auth_user['role'];

    if (!$id) {
        error_response('id wajib diisi.', 400);
    }

    $pdo = get_pdo();

    // Pastikan notifikasi ini memang milik role ini
    $stmtCheck = $pdo->prepare(
        "SELECT id FROM Notifikasi WHERE id = ? AND targetRole = ?"
    );
    $stmtCheck->execute([$id, $role]);
    if (!$stmtCheck->fetch()) {
        error_response('Notifikasi tidak ditemukan.', 404);
    }

    $pdo->prepare("UPDATE Notifikasi SET `read` = 1 WHERE id = ? AND targetRole = ?")
        ->execute([$id, $role]);

    json_response(['message' => 'Notifikasi ditandai sudah dibaca.']);
}

// POST /api/notifikasi/read-all
if ($method === 'POST' && $sub === 'read-all') {
    $role = $auth_user['role'];

    get_pdo()
        ->prepare("UPDATE Notifikasi SET `read` = 1 WHERE targetRole = ? AND `read` = 0")
        ->execute([$role]);

    json_response(['message' => 'Semua notifikasi ditandai sudah dibaca.']);
}

error_response('Endpoint tidak ditemukan.', 404);
