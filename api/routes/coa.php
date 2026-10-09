<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

$auth_user = require_auth();
$id_param  = $segments[1] ?? null;

// GET /api/coa
if ($method === 'GET' && !$id_param) {
    $pdo  = get_pdo();
    $rows = $pdo->query(
        "SELECT id, code, name, kategori, reportType, report_category AS reportCategory, urutan, createdAt
         FROM CoaAccount
         ORDER BY urutan ASC, code ASC"
    )->fetchAll();

    json_response(['data' => $rows]);
}

// POST /api/coa
if ($method === 'POST' && !$id_param) {
    $allowedRoles = ['SUPER_ADMIN', 'MANAJER_KEUANGAN', 'STAF_KEUANGAN'];
    if (!in_array($auth_user['role'], $allowedRoles, true)) {
        error_response('Akses ditolak.', 403);
    }

    $code           = trim($body['code']           ?? '');
    $name           = trim($body['name']           ?? '');
    $kategori       = trim($body['kategori']       ?? '');
    $reportType     = trim($body['reportType']     ?? '');
    $reportCategory = trim($body['reportCategory'] ?? 'SEMUA');

    if (!$code || !$name || !$kategori || !$reportType) {
        error_response('code, name, kategori, dan reportType wajib diisi.', 400);
    }

    $validKategori = ['PENDAPATAN', 'BEBAN', 'ASET', 'KEWAJIBAN', 'MODAL'];
    if (!in_array($kategori, $validKategori, true)) {
        error_response('kategori tidak valid.', 400);
    }

    $validReportType = ['NERACA', 'LABA_RUGI', 'ARUS_KAS'];
    if (!in_array($reportType, $validReportType, true)) {
        error_response('reportType tidak valid.', 400);
    }

    $validReportCategory = ['INTERNAL', 'UMUM', 'SEMUA'];
    if (!in_array($reportCategory, $validReportCategory, true)) {
        error_response('reportCategory tidak valid.', 400);
    }

    $pdo = get_pdo();

    // Cek duplikat code
    $stmtCheck = $pdo->prepare("SELECT id FROM CoaAccount WHERE code = ?");
    $stmtCheck->execute([$code]);
    if ($stmtCheck->fetch()) {
        error_response("Kode akun '$code' sudah digunakan.", 409);
    }

    // urutan = MAX(urutan) + 1
    $maxUrutan = (int)$pdo->query("SELECT COALESCE(MAX(urutan), 0) FROM CoaAccount")->fetchColumn();
    $urutan    = $maxUrutan + 1;

    $id  = uuid4();
    $now = date('Y-m-d H:i:s');

    $pdo->prepare(
        "INSERT INTO CoaAccount (id, code, name, kategori, reportType, report_category, urutan, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )->execute([$id, $code, $name, $kategori, $reportType, $reportCategory, $urutan, $now]);

    // Log aktivitas
    if (function_exists('log_activity')) {
        log_activity($auth_user['id'], "Tambah akun COA: $code - $name", 'FINANCIAL_CHANGE', [
            'coaId'   => $id,
            'code'    => $code,
            'name'    => $name,
        ]);
    }

    json_response(['message' => 'Akun COA berhasil ditambahkan.', 'id' => $id], 201);
}

// PUT /api/coa/:id
if ($method === 'PUT' && $id_param) {
    $allowedRoles = ['SUPER_ADMIN', 'MANAJER_KEUANGAN', 'STAF_KEUANGAN'];
    if (!in_array($auth_user['role'], $allowedRoles, true)) {
        error_response('Akses ditolak.', 403);
    }

    $code           = trim($body['code']           ?? '');
    $name           = trim($body['name']           ?? '');
    $kategori       = trim($body['kategori']       ?? '');
    $reportType     = trim($body['reportType']     ?? '');
    $reportCategory = trim($body['reportCategory'] ?? 'SEMUA');

    if (!$code || !$name || !$kategori || !$reportType) {
        error_response('code, name, kategori, dan reportType wajib diisi.', 400);
    }

    $validKategori       = ['PENDAPATAN', 'BEBAN', 'ASET', 'KEWAJIBAN', 'MODAL'];
    $validReportType     = ['NERACA', 'LABA_RUGI', 'ARUS_KAS'];
    $validReportCategory = ['INTERNAL', 'UMUM', 'SEMUA'];

    if (!in_array($kategori, $validKategori, true))             error_response('kategori tidak valid.', 400);
    if (!in_array($reportType, $validReportType, true))         error_response('reportType tidak valid.', 400);
    if (!in_array($reportCategory, $validReportCategory, true)) error_response('reportCategory tidak valid.', 400);

    $pdo = get_pdo();

    $stmtExist = $pdo->prepare("SELECT id FROM CoaAccount WHERE id = ?");
    $stmtExist->execute([$id_param]);
    if (!$stmtExist->fetch()) {
        error_response('Akun COA tidak ditemukan.', 404);
    }

    // Cek duplikat code (selain dirinya sendiri)
    $stmtDup = $pdo->prepare("SELECT id FROM CoaAccount WHERE code = ? AND id != ?");
    $stmtDup->execute([$code, $id_param]);
    if ($stmtDup->fetch()) {
        error_response("Kode akun '$code' sudah digunakan oleh akun lain.", 409);
    }

    $pdo->prepare(
        "UPDATE CoaAccount
         SET code = ?, name = ?, kategori = ?, reportType = ?, report_category = ?
         WHERE id = ?"
    )->execute([$code, $name, $kategori, $reportType, $reportCategory, $id_param]);

    json_response(['message' => 'Akun COA berhasil diperbarui.']);
}

// DELETE /api/coa/:id
if ($method === 'DELETE' && $id_param) {
    $allowedRoles = ['SUPER_ADMIN', 'MANAJER_KEUANGAN'];
    if (!in_array($auth_user['role'], $allowedRoles, true)) {
        error_response('Akses ditolak. Hanya Super Admin atau Manajer Keuangan.', 403);
    }

    $pdo = get_pdo();

    $stmtExist = $pdo->prepare("SELECT id, code, name FROM CoaAccount WHERE id = ?");
    $stmtExist->execute([$id_param]);
    $coa = $stmtExist->fetch();
    if (!$coa) {
        error_response('Akun COA tidak ditemukan.', 404);
    }

    // Cek apakah ada transaksi yang memakai COA ini
    $stmtUsed = $pdo->prepare("SELECT COUNT(*) FROM Transaction WHERE coaAccountId = ?");
    $stmtUsed->execute([$id_param]);
    $usedCount = (int)$stmtUsed->fetchColumn();

    if ($usedCount > 0) {
        error_response("Akun COA tidak dapat dihapus karena masih digunakan oleh $usedCount transaksi.", 409);
    }

    // Cek SaldoAwal
    $stmtSaldo = $pdo->prepare("SELECT COUNT(*) FROM SaldoAwal WHERE coaAccountId = ?");
    $stmtSaldo->execute([$id_param]);
    if ((int)$stmtSaldo->fetchColumn() > 0) {
        error_response('Akun COA tidak dapat dihapus karena memiliki saldo awal terdaftar.', 409);
    }

    $pdo->prepare("DELETE FROM CoaAccount WHERE id = ?")->execute([$id_param]);

    json_response(['message' => "Akun COA '{$coa['code']} - {$coa['name']}' berhasil dihapus."]);
}

error_response('Endpoint tidak ditemukan.', 404);
