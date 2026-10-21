<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');
require_once __DIR__ . '/../helpers/kas-helpers.php';

$user = require_auth();
if (!in_array($user['role'] ?? '', ['SUPER_ADMIN', 'MANAJER_KEUANGAN', 'STAF_KEUANGAN'], true)) {
    error_response('Anda tidak memiliki akses mengubah gaji tenaga ahli.', 403);
}
$pdo = get_pdo();
ensure_tenaga_ahli_tables($pdo);
ensure_tenaga_ahli_gaji_table($pdo);
$rekanan_id = is_string($body['rekananId'] ?? null) ? $body['rekananId'] : '';
$project_id = is_string($body['projectId'] ?? null) ? $body['projectId'] : '';
$stmt = $pdo->prepare("SELECT r.nama, r.nik, r.npwp, r.entityId, p.name AS projectName, p.entityId AS projectEntityId
    FROM Rekanan r JOIN Project p ON p.id = ?
    LEFT JOIN TenagaAhliProject tap ON tap.rekananId = r.id AND tap.projectId = p.id
    WHERE r.id = ? AND r.tipe = 'TENAGA_AHLI' AND (tap.id IS NOT NULL OR r.projectId = p.id) LIMIT 1");
$stmt->execute([$project_id, $rekanan_id]);
$person = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$person) error_response('Penugasan tenaga ahli tidak ditemukan.', 404);
// Gunakan akses entitas terkini dari database, bukan hanya klaim token lama.
if (($user['role'] ?? '') === 'STAF_KEUANGAN') {
    $stmt = $pdo->prepare('SELECT 1 FROM UserEntityAccess WHERE userId = ? AND entityId IN (?, ?) LIMIT 1');
    $stmt->execute([$user['id'], $person['entityId'], $person['projectEntityId']]);
    if (!$stmt->fetchColumn()) error_response('Anda tidak memiliki akses ke entitas tenaga ahli atau proyek ini.', 403);
}
try {
    $nominal = tenaga_ahli_nominal($body['gajiNegosiasi'] ?? null, false);
    if ($nominal <= 0) throw new InvalidArgumentException('Gaji negosiasi wajib lebih dari nol.');
    $basis = $body['basisNegosiasi'] ?? 'BULAN';
    if (!in_array($basis, ['BULAN', 'KONTRAK'], true)) throw new InvalidArgumentException('Basis negosiasi tidak valid.');
    $basis = 'KONTRAK'; // Negosiasi menjadi plafon total kontrak, bukan tarif per bulan.
    $jadwal = tenaga_ahli_validate_jadwal($body['jadwal'] ?? null);
    if (empty($jadwal)) throw new InvalidArgumentException('Isi minimal satu bulan gaji.');
    $revision = $body['revision'] ?? 0;
    if (!is_int($revision) || $revision < 0) throw new InvalidArgumentException('Versi data tidak valid.');
} catch (InvalidArgumentException $e) {
    error_response($e->getMessage(), 400);
}

$pdo->beginTransaction();
try {
    // Buat placeholder tanpa menimpa referensi Sidamon atau negosiasi yang sudah ada.
    $pdo->prepare('INSERT INTO TenagaAhliGajiKontrak (id, rekananId, projectId) VALUES (?, ?, ?)
        ON DUPLICATE KEY UPDATE id = id')->execute([uuid4(), $rekanan_id, $project_id]);
    $stmt = $pdo->prepare('SELECT * FROM TenagaAhliGajiKontrak WHERE rekananId = ? AND projectId = ? FOR UPDATE');
    $stmt->execute([$rekanan_id, $project_id]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);
    if ((int)$existing['revision'] !== $revision) {
        $pdo->rollBack();
        error_response('Data sudah berubah. Muat ulang halaman sebelum menyimpan agar perubahan lain tidak tertimpa.', 409);
    }
    $old_rows = $existing['jadwalJson'] === null ? [] : json_decode($existing['jadwalJson'], true, 512, JSON_THROW_ON_ERROR);
    $removed = array_diff(array_column($old_rows, 'bulan'), array_column($jadwal, 'bulan'));
    if ($removed) {
        $paid = $pdo->prepare("SELECT id, tahun, bulan FROM HonorTenagaAhli WHERE rekananId = ? AND projectId = ?");
        $paid->execute([$rekanan_id, $project_id]);
        foreach ($paid->fetchAll(PDO::FETCH_ASSOC) as $row) {
            $period = sprintf('%04d-%02d', $row['tahun'], $row['bulan']);
            if (in_array($period, $removed, true) && $row['id'] !== tenaga_ahli_auto_payment_id($rekanan_id, $project_id, $period)) {
                $pdo->rollBack();
                error_response('Bulan yang memiliki riwayat pembayaran tidak dapat dihapus dari jadwal.', 409);
            }
        }
    }
    $pdo->prepare('UPDATE TenagaAhliGajiKontrak SET gajiNegosiasi = ?, basisNegosiasi = ?, jadwalJson = ?, revision = revision + 1 WHERE id = ?')
        ->execute([$nominal, $basis, json_encode($jadwal, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE), $existing['id']]);
    tenaga_ahli_sync_pembayaran($pdo, $person, $rekanan_id, $project_id, $jadwal, $old_rows, $nominal);
    sync_project_spend($pdo, $project_id);
    $stmt->execute([$rekanan_id, $project_id]);
    $saved = tenaga_ahli_gaji_format($stmt->fetch(PDO::FETCH_ASSOC));
    log_activity($user['id'], "Simpan negosiasi, gaji dan pembayaran otomatis tenaga ahli: {$person['nama']}", 'FINANCIAL_CHANGE', [
        'rekananId' => $rekanan_id, 'projectId' => $project_id,
        'sebelum' => tenaga_ahli_gaji_format($existing), 'sesudah' => $saved,
    ]);
    $pdo->commit();
    json_response(['success' => true, 'data' => $saved]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    if ($e instanceof InvalidArgumentException) error_response($e->getMessage(), 400);
    throw $e;
}
