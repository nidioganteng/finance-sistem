<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

$user = require_auth();
if (!in_array($user['role'] ?? '', ['SUPER_ADMIN', 'MANAJER_KEUANGAN', 'STAF_KEUANGAN'], true)) {
    error_response('Anda tidak memiliki akses mengubah gaji tenaga ahli.', 403);
}
$pdo = get_pdo();
ensure_tenaga_ahli_tables($pdo);
ensure_tenaga_ahli_gaji_table($pdo);
$rekanan_id = is_string($body['rekananId'] ?? null) ? $body['rekananId'] : '';
$project_id = is_string($body['projectId'] ?? null) ? $body['projectId'] : '';
$stmt = $pdo->prepare("SELECT r.nama, r.entityId, p.entityId AS projectEntityId
    FROM Rekanan r JOIN Project p ON p.id = ?
    LEFT JOIN TenagaAhliProject tap ON tap.rekananId = r.id AND tap.projectId = p.id
    WHERE r.id = ? AND r.tipe = 'TENAGA_AHLI' AND (tap.id IS NOT NULL OR r.projectId = p.id) LIMIT 1");
$stmt->execute([$project_id, $rekanan_id]);
$person = $stmt->fetch(PDO::FETCH_ASSOC);
if (!$person) error_response('Penugasan tenaga ahli tidak ditemukan.', 404);
// Gunakan akses entitas terkini dari database, bukan hanya klaim token lama.
if (($user['role'] ?? '') === 'STAF_KEUANGAN') {
    $stmt = $pdo->prepare('SELECT 1 FROM UserEntityAccess WHERE userId = ? AND entityId = ? LIMIT 1');
    $stmt->execute([$user['id'], $person['projectEntityId']]);
    if (!$stmt->fetchColumn()) error_response('Anda tidak memiliki akses ke entitas proyek ini.', 403);
}
try {
    $nominal = tenaga_ahli_nominal($body['gajiNegosiasi'] ?? null, false);
    if ($nominal <= 0) throw new InvalidArgumentException('Gaji negosiasi wajib lebih dari nol.');
    $basis = $body['basisNegosiasi'] ?? 'BULAN';
    if (!in_array($basis, ['BULAN', 'KONTRAK'], true)) throw new InvalidArgumentException('Basis negosiasi tidak valid.');
    $jadwal = tenaga_ahli_validate_jadwal($body['jadwal'] ?? null);
    if (empty($jadwal)) throw new InvalidArgumentException('Isi minimal satu bulan gaji.');
    $revision = $body['revision'] ?? 0;
    if (!is_int($revision) || $revision < 0) throw new InvalidArgumentException('Versi data tidak valid.');
    $ref = $body['referensi'] ?? [];
    if (!is_array($ref)) throw new InvalidArgumentException('Data referensi tidak valid.');
    $nama_pekerjaan = $ref['namaPekerjaan'] ?? null;
    if ($nama_pekerjaan !== null && (!is_string($nama_pekerjaan) || strlen($nama_pekerjaan) > 255)) {
        throw new InvalidArgumentException('Nama pekerjaan maksimal 255 byte.');
    }
    $mm = tenaga_ahli_nominal($ref['manMonth'] ?? null);
    if ($mm !== null && $mm > 99999999.99) throw new InvalidArgumentException('Menman terlalu besar.');
    $rab = tenaga_ahli_nominal($ref['gajiRab'] ?? null);
    $mulai = tenaga_ahli_valid_date($ref['spmkMulai'] ?? null);
    $selesai = tenaga_ahli_valid_date($ref['spmkSelesai'] ?? null);
    if (($mulai === null) !== ($selesai === null) || ($mulai && $selesai < $mulai)) {
        throw new InvalidArgumentException('Isi tanggal mulai dan selesai SPMK dengan urutan yang benar.');
    }
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
        $paid = $pdo->prepare("SELECT DISTINCT tahun, bulan FROM HonorTenagaAhli WHERE rekananId = ? AND projectId = ?");
        $paid->execute([$rekanan_id, $project_id]);
        foreach ($paid->fetchAll(PDO::FETCH_ASSOC) as $row) {
            if (in_array(sprintf('%04d-%02d', $row['tahun'], $row['bulan']), $removed, true)) {
                $pdo->rollBack();
                error_response('Bulan yang memiliki riwayat pembayaran tidak dapat dihapus dari jadwal.', 409);
            }
        }
    }
    $pdo->prepare('UPDATE TenagaAhliGajiKontrak SET gajiNegosiasi = ?, basisNegosiasi = ?, jadwalJson = ?, revision = revision + 1 WHERE id = ?')
        ->execute([$nominal, $basis, json_encode($jadwal, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE), $existing['id']]);
    if ($existing['sumber'] === 'MANUAL') {
        $pdo->prepare('UPDATE TenagaAhliGajiKontrak SET namaPekerjaan = ?, manMonth = ?, gajiRab = ?, spmkMulai = ?, spmkSelesai = ? WHERE id = ?')
            ->execute([$nama_pekerjaan, $mm, $rab, $mulai, $selesai, $existing['id']]);
    }
    $stmt->execute([$rekanan_id, $project_id]);
    $saved = tenaga_ahli_gaji_format($stmt->fetch(PDO::FETCH_ASSOC));
    log_activity($user['id'], "Simpan negosiasi dan gaji bulanan tenaga ahli: {$person['nama']}", 'FINANCIAL_CHANGE', [
        'rekananId' => $rekanan_id, 'projectId' => $project_id,
        'sebelum' => tenaga_ahli_gaji_format($existing), 'sesudah' => $saved,
    ]);
    $pdo->commit();
    json_response(['success' => true, 'data' => $saved]);
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
}
