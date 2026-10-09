<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

// ── Helper: ambil entityKeys milik satu user ─────────────────────────────────
function get_entity_keys(string $user_id): array {
    $pdo  = get_pdo();
    $stmt = $pdo->prepare(
        'SELECT e.`key`
           FROM UserEntityAccess uea
           JOIN Entity e ON e.id = uea.entityId
          WHERE uea.userId = ?
          ORDER BY e.createdAt ASC'
    );
    $stmt->execute([$user_id]);
    return array_column($stmt->fetchAll(), 'key');
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// ────────────────────────────────────────────────────────────────────────────
if ($method === 'POST' && ($segments[1] ?? '') === 'register') {
    $name     = trim($body['name']     ?? '');
    $email    = trim($body['email']    ?? '');
    $password = trim($body['password'] ?? '');

    if ($name === '' || $email === '' || $password === '') {
        error_response('name, email, dan password wajib diisi.');
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        error_response('Format email tidak valid.');
    }
    if (strlen($password) < 8) {
        error_response('Password minimal 8 karakter.');
    }

    $pdo = get_pdo();

    // Cek duplikat email
    $check = $pdo->prepare('SELECT id FROM User WHERE email = ? LIMIT 1');
    $check->execute([$email]);
    if ($check->fetch()) {
        error_response('Email sudah terdaftar.', 409);
    }

    $id           = cuid();
    $passwordHash = password_hash($password, PASSWORD_BCRYPT, ['cost' => 12]);

    $pdo->prepare(
        'INSERT INTO User (id, name, email, passwordHash, role, status, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, NULL, \'PENDING\', NOW(), NOW())'
    )->execute([$id, $name, $email, $passwordHash]);

    log_activity($id, 'USER_REGISTER', 'USER_ACTIVITY', ['email' => $email]);

    json_response([
        'message' => 'Registrasi berhasil. Akun Anda menunggu persetujuan Manajer Keuangan.',
        'id'      => $id,
    ], 201);
}

// ────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ────────────────────────────────────────────────────────────────────────────
if ($method === 'POST' && ($segments[1] ?? '') === 'login') {
    $email    = trim($body['email']    ?? '');
    $password = trim($body['password'] ?? '');

    if ($email === '' || $password === '') {
        error_response('Email dan password wajib diisi.');
    }

    $pdo  = get_pdo();
    $stmt = $pdo->prepare(
        'SELECT id, name, email, passwordHash, role, status FROM User WHERE email = ? LIMIT 1'
    );
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if (!$user || !password_verify($password, $user['passwordHash'])) {
        error_response('Email atau password salah.', 401);
    }
    if ($user['status'] !== 'ACTIVE') {
        $msg = match ($user['status']) {
            'PENDING'   => 'Akun Anda belum disetujui oleh Manajer Keuangan.',
            'INACTIVE'  => 'Akun Anda telah dinonaktifkan. Hubungi administrator.',
            default     => 'Akun tidak dapat login saat ini.',
        };
        error_response($msg, 403);
    }
    if ($user['role'] === null) {
        error_response('Akun Anda belum diberi role. Hubungi administrator.', 403);
    }

    $entityKeys = get_entity_keys($user['id']);

    $payload = [
        'id'         => $user['id'],
        'name'       => $user['name'],
        'email'      => $user['email'],
        'role'       => $user['role'],
        'entityKeys' => $entityKeys,
    ];

    $token = jwt_sign($payload, JWT_SECRET, JWT_EXPIRES_IN);

    log_activity($user['id'], 'USER_LOGIN', 'USER_ACTIVITY', ['email' => $email]);

    json_response([
        'token' => $token,
        'user'  => $payload,
    ]);
}

// ────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// ────────────────────────────────────────────────────────────────────────────
if ($method === 'GET' && ($segments[1] ?? '') === 'me') {
    $caller = require_auth();

    $pdo  = get_pdo();
    $stmt = $pdo->prepare(
        'SELECT id, name, email, role, status, createdAt FROM User WHERE id = ? LIMIT 1'
    );
    $stmt->execute([$caller['id']]);
    $user = $stmt->fetch();

    if (!$user) error_response('User tidak ditemukan.', 404);

    $entityKeys = get_entity_keys($user['id']);

    json_response(array_merge($user, ['entityKeys' => $entityKeys]));
}

error_response('Endpoint tidak ditemukan.', 404);
