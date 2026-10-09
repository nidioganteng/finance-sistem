<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

$caller = require_auth();

// ── Helper: role yang boleh mengelola pengguna ───────────────────────────────
function can_manage_users(array $caller): bool {
    return in_array($caller['role'], ['SUPER_ADMIN', 'MANAJER_KEUANGAN'], true);
}

// Guard: SUPER_ADMIN targetnya tidak boleh diubah kecuali oleh SUPER_ADMIN
function guard_super_admin_target(string $target_id, array $caller): void {
    $pdo  = get_pdo();
    $stmt = $pdo->prepare('SELECT role FROM User WHERE id = ? LIMIT 1');
    $stmt->execute([$target_id]);
    $target = $stmt->fetch();
    if ($target && $target['role'] === 'SUPER_ADMIN' && $caller['role'] !== 'SUPER_ADMIN') {
        error_response('Tidak diizinkan mengubah akun SUPER_ADMIN.', 403);
    }
}

// ── Helper: set UserEntityAccess untuk satu user ─────────────────────────────
function set_entity_access(string $user_id, array $entity_ids): void {
    $pdo = get_pdo();
    $pdo->prepare('DELETE FROM UserEntityAccess WHERE userId = ?')->execute([$user_id]);
    if (empty($entity_ids)) return;
    $placeholders = implode(',', array_fill(0, count($entity_ids), '(?,?)'));
    $params = [];
    foreach ($entity_ids as $eid) {
        $params[] = $user_id;
        $params[] = $eid;
    }
    $pdo->prepare("INSERT INTO UserEntityAccess (userId, entityId) VALUES $placeholders")
        ->execute($params);
}

// ── Helper: ambil semua user dengan entityKeys ───────────────────────────────
function fetch_all_users(): array {
    $pdo  = get_pdo();
    $stmt = $pdo->query(
        'SELECT u.id, u.name, u.email, u.role, u.status, u.createdAt, u.updatedAt,
                GROUP_CONCAT(e.`key` ORDER BY e.createdAt SEPARATOR \',\') AS entityKeysCsv
           FROM User u
           LEFT JOIN UserEntityAccess uea ON uea.userId = u.id
           LEFT JOIN Entity e ON e.id = uea.entityId
          GROUP BY u.id
          ORDER BY u.createdAt DESC'
    );
    $rows = $stmt->fetchAll();
    return array_map(function ($row) {
        $row['entityKeys'] = $row['entityKeysCsv']
            ? explode(',', $row['entityKeysCsv'])
            : [];
        unset($row['entityKeysCsv']);
        return $row;
    }, $rows);
}

// ────────────────────────────────────────────────────────────────────────────
// GET /api/pengguna
// ────────────────────────────────────────────────────────────────────────────
if ($method === 'GET' && !isset($segments[1])) {
    if (!can_manage_users($caller)) error_response('Akses ditolak.', 403);
    json_response(fetch_all_users());
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/pengguna/approve
// ────────────────────────────────────────────────────────────────────────────
if ($method === 'POST' && ($segments[1] ?? '') === 'approve') {
    if (!can_manage_users($caller)) error_response('Akses ditolak.', 403);

    $user_id    = trim($body['userId']    ?? '');
    $role       = trim($body['role']      ?? '');
    $entity_ids = $body['entityIds']      ?? [];

    if ($user_id === '' || $role === '') {
        error_response('userId dan role wajib diisi.');
    }

    $valid_roles = ['SUPER_ADMIN', 'MANAJER_KEUANGAN', 'STAF_KEUANGAN', 'MANAGER_ADMIN', 'ADMIN_SIDAMON'];
    if (!in_array($role, $valid_roles, true)) {
        error_response('Role tidak valid.');
    }

    // Hanya SUPER_ADMIN boleh meng-assign role SUPER_ADMIN
    if ($role === 'SUPER_ADMIN' && $caller['role'] !== 'SUPER_ADMIN') {
        error_response('Hanya SUPER_ADMIN yang boleh meng-assign role SUPER_ADMIN.', 403);
    }

    guard_super_admin_target($user_id, $caller);

    $pdo = get_pdo();
    $pdo->prepare(
        "UPDATE User SET role = ?, status = 'ACTIVE', updatedAt = NOW() WHERE id = ?"
    )->execute([$role, $user_id]);

    set_entity_access($user_id, $entity_ids);

    log_activity($caller['id'], 'USER_APPROVE', 'USER_ACTIVITY', [
        'targetUserId' => $user_id,
        'role'         => $role,
        'entityIds'    => $entity_ids,
    ]);

    json_response(['message' => 'Pengguna berhasil disetujui.']);
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/pengguna/reject
// ────────────────────────────────────────────────────────────────────────────
if ($method === 'POST' && ($segments[1] ?? '') === 'reject') {
    if (!can_manage_users($caller)) error_response('Akses ditolak.', 403);

    $user_id = trim($body['userId'] ?? '');
    if ($user_id === '') error_response('userId wajib diisi.');

    guard_super_admin_target($user_id, $caller);

    $pdo = get_pdo();
    $pdo->prepare(
        "UPDATE User SET status = 'INACTIVE', updatedAt = NOW() WHERE id = ?"
    )->execute([$user_id]);

    log_activity($caller['id'], 'USER_REJECT', 'USER_ACTIVITY', ['targetUserId' => $user_id]);

    json_response(['message' => 'Pendaftaran pengguna ditolak.']);
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/pengguna/deactivate
// ────────────────────────────────────────────────────────────────────────────
if ($method === 'POST' && ($segments[1] ?? '') === 'deactivate') {
    if (!can_manage_users($caller)) error_response('Akses ditolak.', 403);

    $user_id = trim($body['userId'] ?? '');
    if ($user_id === '') error_response('userId wajib diisi.');
    if ($user_id === $caller['id']) error_response('Tidak bisa menonaktifkan akun sendiri.');

    guard_super_admin_target($user_id, $caller);

    $pdo = get_pdo();
    $pdo->prepare(
        "UPDATE User SET status = 'INACTIVE', updatedAt = NOW() WHERE id = ?"
    )->execute([$user_id]);

    log_activity($caller['id'], 'USER_DEACTIVATE', 'USER_ACTIVITY', ['targetUserId' => $user_id]);

    json_response(['message' => 'Pengguna berhasil dinonaktifkan.']);
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/pengguna/activate
// ────────────────────────────────────────────────────────────────────────────
if ($method === 'POST' && ($segments[1] ?? '') === 'activate') {
    if (!can_manage_users($caller)) error_response('Akses ditolak.', 403);

    $user_id = trim($body['userId'] ?? '');
    if ($user_id === '') error_response('userId wajib diisi.');

    $pdo = get_pdo();

    // Cek user punya role sebelum diaktifkan
    $stmt = $pdo->prepare('SELECT role FROM User WHERE id = ? LIMIT 1');
    $stmt->execute([$user_id]);
    $target = $stmt->fetch();
    if (!$target) error_response('User tidak ditemukan.', 404);
    if ($target['role'] === null) {
        error_response('User belum punya role. Gunakan endpoint approve terlebih dahulu.');
    }

    $pdo->prepare(
        "UPDATE User SET status = 'ACTIVE', updatedAt = NOW() WHERE id = ?"
    )->execute([$user_id]);

    log_activity($caller['id'], 'USER_ACTIVATE', 'USER_ACTIVITY', ['targetUserId' => $user_id]);

    json_response(['message' => 'Pengguna berhasil diaktifkan.']);
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/pengguna/entities
// ────────────────────────────────────────────────────────────────────────────
if ($method === 'POST' && ($segments[1] ?? '') === 'entities') {
    if (!can_manage_users($caller)) error_response('Akses ditolak.', 403);

    $user_id    = trim($body['userId']    ?? '');
    $entity_ids = $body['entityIds']      ?? [];

    if ($user_id === '') error_response('userId wajib diisi.');

    guard_super_admin_target($user_id, $caller);

    set_entity_access($user_id, $entity_ids);

    $pdo = get_pdo();
    $pdo->prepare("UPDATE User SET updatedAt = NOW() WHERE id = ?")->execute([$user_id]);

    log_activity($caller['id'], 'USER_ENTITIES_UPDATE', 'USER_ACTIVITY', [
        'targetUserId' => $user_id,
        'entityIds'    => $entity_ids,
    ]);

    json_response(['message' => 'Akses entitas berhasil diperbarui.']);
}

error_response('Endpoint tidak ditemukan.', 404);
