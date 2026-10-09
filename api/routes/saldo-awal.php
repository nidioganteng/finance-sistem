<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

$auth_user = require_auth();

// POST /api/saldo-awal   body: {entityId, coaAccountId, year, nominal}
if ($method === 'POST') {
    $entityId    = trim($body['entityId']    ?? '');
    $coaId       = trim($body['coaAccountId'] ?? '');
    $year        = isset($body['year']) ? (int)$body['year'] : null;
    $nominal     = isset($body['nominal'])   ? $body['nominal'] : null;

    if (!$entityId || !$coaId || !$year || $nominal === null) {
        error_response('entityId, coaAccountId, year, dan nominal wajib diisi.', 400);
    }

    if ($year < 2000 || $year > 2100) {
        error_response('Tahun tidak valid.', 400);
    }

    if (!is_numeric($nominal) || (float)$nominal < 0) {
        error_response('nominal harus berupa angka non-negatif.', 400);
    }

    $pdo = get_pdo();

    // Validasi entity ada
    $stmtEnt = $pdo->prepare("SELECT id FROM Entity WHERE id = ?");
    $stmtEnt->execute([$entityId]);
    if (!$stmtEnt->fetch()) {
        error_response('Entity tidak ditemukan.', 404);
    }

    // Cek akses user ke entity (lewat UserEntityAccess)
    $stmtAccess = $pdo->prepare(
        "SELECT 1 FROM UserEntityAccess WHERE userId = ? AND entityId = ?"
    );
    $stmtAccess->execute([$auth_user['id'], $entityId]);
    if (!$stmtAccess->fetch()) {
        // SUPER_ADMIN boleh akses semua entity
        if ($auth_user['role'] !== 'SUPER_ADMIN') {
            error_response('Anda tidak memiliki akses ke entity ini.', 403);
        }
    }

    // Validasi COA ada
    $stmtCoa = $pdo->prepare("SELECT id, code, name FROM CoaAccount WHERE id = ?");
    $stmtCoa->execute([$coaId]);
    $coa = $stmtCoa->fetch();
    if (!$coa) {
        error_response('Akun COA tidak ditemukan.', 404);
    }

    // UPSERT: INSERT ... ON DUPLICATE KEY UPDATE
    $now = date('Y-m-d H:i:s');

    // Cek apakah sudah ada
    $stmtCheck = $pdo->prepare(
        "SELECT id FROM SaldoAwal WHERE entityId = ? AND coaAccountId = ? AND year = ?"
    );
    $stmtCheck->execute([$entityId, $coaId, $year]);
    $existing = $stmtCheck->fetch();

    if ($existing) {
        $pdo->prepare(
            "UPDATE SaldoAwal SET nominal = ?, updatedAt = ? WHERE entityId = ? AND coaAccountId = ? AND year = ?"
        )->execute([(float)$nominal, $now, $entityId, $coaId, $year]);

        // Log aktivitas
        if (function_exists('log_activity')) {
            log_activity($auth_user['id'], "Update saldo awal: {$coa['code']} - {$coa['name']} tahun $year", 'FINANCIAL_CHANGE', [
                'entityId'    => $entityId,
                'coaId'       => $coaId,
                'coaCode'     => $coa['code'],
                'coaName'     => $coa['name'],
                'year'        => $year,
                'nominal'     => (float)$nominal,
            ]);
        }

        json_response(['message' => 'Saldo awal berhasil diperbarui.']);
    } else {
        $id = uuid4();
        $pdo->prepare(
            "INSERT INTO SaldoAwal (id, entityId, coaAccountId, year, nominal, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?)"
        )->execute([$id, $entityId, $coaId, $year, (float)$nominal, $now]);

        // Log aktivitas
        if (function_exists('log_activity')) {
            log_activity($auth_user['id'], "Set saldo awal: {$coa['code']} - {$coa['name']} tahun $year", 'FINANCIAL_CHANGE', [
                'entityId'    => $entityId,
                'coaId'       => $coaId,
                'coaCode'     => $coa['code'],
                'coaName'     => $coa['name'],
                'year'        => $year,
                'nominal'     => (float)$nominal,
            ]);
        }

        json_response(['message' => 'Saldo awal berhasil disimpan.', 'id' => $id], 201);
    }
}

error_response('Endpoint tidak ditemukan.', 404);
