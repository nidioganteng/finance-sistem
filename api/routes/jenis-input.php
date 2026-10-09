<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

$auth_user = require_auth();
$id_param  = $segments[1] ?? null;
$sub       = $segments[2] ?? null; // 'toggle'

// Kunci sistem yang tidak boleh dihapus/toggle
const SYSTEM_KEYS = ['kasKecil', 'kasBesar', 'bankBuku'];

// Helper: slugify nama ke key unik
function slugify_key(string $nama): string {
    // Ubah ke camelCase dari kata-kata
    $nama = trim($nama);
    $words = preg_split('/[\s\-_]+/', $nama);
    $key = '';
    foreach ($words as $i => $word) {
        $word = mb_strtolower($word);
        if ($i === 0) {
            $key .= $word;
        } else {
            $key .= mb_strtoupper(mb_substr($word, 0, 1)) . mb_substr($word, 1);
        }
    }
    // Hapus karakter non-alphanumeric
    $key = preg_replace('/[^a-zA-Z0-9]/', '', $key);
    return $key ?: 'jenisInput' . rand(1000, 9999);
}

// GET /api/jenis-input
if ($method === 'GET' && !$id_param) {
    $pdo  = get_pdo();
    $rows = $pdo->query(
        "SELECT j.id, j.`key`, j.nama, j.extraFieldsJson, j.active, j.createdById, j.createdAt,
                u.name AS createdByName
         FROM JenisInputTransaksi j
         LEFT JOIN User u ON j.createdById = u.id
         ORDER BY j.createdAt ASC"
    )->fetchAll();

    foreach ($rows as &$row) {
        $row['active'] = (bool)$row['active'];
        if (isset($row['extraFieldsJson']) && is_string($row['extraFieldsJson'])) {
            $decoded = json_decode($row['extraFieldsJson'], true);
            $row['extraFieldsJson'] = $decoded ?? null;
        }
    }
    unset($row);

    json_response(['data' => $rows]);
}

// POST /api/jenis-input
if ($method === 'POST' && !$id_param) {
    $allowedRoles = ['STAF_KEUANGAN', 'MANAJER_KEUANGAN', 'SUPER_ADMIN'];
    if (!in_array($auth_user['role'], $allowedRoles, true)) {
        error_response('Akses ditolak.', 403);
    }

    $nama          = trim($body['nama'] ?? '');
    $arahLaporan   = $body['arahLaporan'] ?? [];   // array string
    $entityKeysArr = $body['entityKeys']  ?? [];   // array string (untuk konteks, disimpan di extraFieldsJson)

    if (!$nama) {
        error_response('nama wajib diisi.', 400);
    }

    $pdo = get_pdo();

    // Buat key dari slugify, pastikan unik
    $baseKey = slugify_key($nama);
    $key     = $baseKey;
    $counter = 1;
    while (true) {
        $stmtK = $pdo->prepare("SELECT id FROM JenisInputTransaksi WHERE `key` = ?");
        $stmtK->execute([$key]);
        if (!$stmtK->fetch()) break;
        $key = $baseKey . $counter;
        $counter++;
    }

    $extraFields = [];
    if (!empty($arahLaporan)) {
        $extraFields['arahLaporan'] = $arahLaporan;
    }
    if (!empty($entityKeysArr)) {
        $extraFields['entityKeys'] = $entityKeysArr;
    }
    $extraFieldsJson = !empty($extraFields) ? json_encode($extraFields) : null;

    $id  = uuid4();
    $now = date('Y-m-d H:i:s');

    $pdo->prepare(
        "INSERT INTO JenisInputTransaksi (id, `key`, nama, extraFieldsJson, active, createdById, createdAt)
         VALUES (?, ?, ?, ?, 1, ?, ?)"
    )->execute([$id, $key, $nama, $extraFieldsJson, $auth_user['id'], $now]);

    // Buat notifikasi ke SUPER_ADMIN
    $notifText = "Jenis input transaksi baru ditambahkan: \"{$nama}\" oleh {$auth_user['name']}.";
    $pdo->prepare(
        "INSERT INTO Notifikasi (id, type, targetRole, text, `read`, createdAt)
         VALUES (?, 'JENIS_INPUT_BARU', 'SUPER_ADMIN', ?, 0, ?)"
    )->execute([uuid4(), $notifText, $now]);

    // Jika pembuat adalah STAF_KEUANGAN, juga notifikasi ke MANAJER_KEUANGAN
    if ($auth_user['role'] === 'STAF_KEUANGAN') {
        $pdo->prepare(
            "INSERT INTO Notifikasi (id, type, targetRole, text, `read`, createdAt)
             VALUES (?, 'JENIS_INPUT_BARU', 'MANAJER_KEUANGAN', ?, 0, ?)"
        )->execute([uuid4(), $notifText, $now]);
    }

    // Log aktivitas
    if (function_exists('log_activity')) {
        log_activity($auth_user['id'], "Tambah jenis input: $nama", 'FINANCIAL_CHANGE', [
            'jenisInputId' => $id,
            'key'          => $key,
            'nama'         => $nama,
        ]);
    }

    json_response(['message' => 'Jenis input transaksi berhasil ditambahkan.', 'id' => $id, 'key' => $key], 201);
}

// POST /api/jenis-input/:id/toggle
if ($method === 'POST' && $id_param && $sub === 'toggle') {
    $allowedRoles = ['SUPER_ADMIN', 'MANAJER_KEUANGAN', 'STAF_KEUANGAN'];
    if (!in_array($auth_user['role'], $allowedRoles, true)) {
        error_response('Akses ditolak.', 403);
    }

    $pdo = get_pdo();

    $stmt = $pdo->prepare("SELECT id, `key`, nama, active FROM JenisInputTransaksi WHERE id = ?");
    $stmt->execute([$id_param]);
    $ji = $stmt->fetch();
    if (!$ji) {
        error_response('Jenis input tidak ditemukan.', 404);
    }

    // System keys tidak boleh di-toggle
    if (in_array($ji['key'], SYSTEM_KEYS, true)) {
        error_response("Jenis input sistem '{$ji['key']}' tidak dapat dinonaktifkan.", 400);
    }

    $newActive = $ji['active'] ? 0 : 1;
    $pdo->prepare("UPDATE JenisInputTransaksi SET active = ? WHERE id = ?")->execute([$newActive, $id_param]);

    $statusLabel = $newActive ? 'diaktifkan' : 'dinonaktifkan';
    json_response(['message' => "Jenis input '{$ji['nama']}' berhasil $statusLabel.", 'active' => (bool)$newActive]);
}

// DELETE /api/jenis-input/:id
if ($method === 'DELETE' && $id_param && !$sub) {
    $allowedRoles = ['SUPER_ADMIN', 'MANAJER_KEUANGAN'];
    if (!in_array($auth_user['role'], $allowedRoles, true)) {
        error_response('Akses ditolak. Hanya Super Admin atau Manajer Keuangan.', 403);
    }

    $pdo = get_pdo();

    $stmt = $pdo->prepare("SELECT id, `key`, nama FROM JenisInputTransaksi WHERE id = ?");
    $stmt->execute([$id_param]);
    $ji = $stmt->fetch();
    if (!$ji) {
        error_response('Jenis input tidak ditemukan.', 404);
    }

    // Cek system keys
    if (in_array($ji['key'], SYSTEM_KEYS, true)) {
        error_response("Jenis input sistem '{$ji['key']}' tidak dapat dihapus.", 400);
    }

    // Cek apakah ada transaksi yang memakai jenis input ini
    $stmtUsed = $pdo->prepare("SELECT COUNT(*) FROM Transaction WHERE jenisInputId = ?");
    $stmtUsed->execute([$id_param]);
    $usedCount = (int)$stmtUsed->fetchColumn();

    if ($usedCount > 0) {
        error_response("Jenis input tidak dapat dihapus karena masih digunakan oleh $usedCount transaksi.", 409);
    }

    $pdo->prepare("DELETE FROM JenisInputTransaksi WHERE id = ?")->execute([$id_param]);

    json_response(['message' => "Jenis input '{$ji['nama']}' berhasil dihapus."]);
}

error_response('Endpoint tidak ditemukan.', 404);
