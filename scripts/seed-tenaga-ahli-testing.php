<?php
// Fixture manual yang diminta untuk testing lokal. Default hanya preview.
// php scripts/seed-tenaga-ahli-testing.php --apply
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
define('APP_ENTRY', true);
require __DIR__ . '/../api/config/env.php';
require __DIR__ . '/../api/config/db.php';
require __DIR__ . '/../api/helpers/response.php';
require __DIR__ . '/../api/helpers/tenaga-ahli-gaji.php';
if (!in_array(DB_HOST, ['127.0.0.1', 'localhost', '::1'], true)) {
    fwrite(STDERR, "Fixture ini hanya boleh dijalankan pada database lokal.\n"); exit(1);
}
$pdo = get_pdo();
$stmt = $pdo->prepare("SELECT DISTINCT r.id AS rekananId, r.nama, r.entityId, e.name AS entityName,
    p.id AS projectId, p.code, p.name AS projectName
    FROM Rekanan r
    JOIN Entity e ON e.id = r.entityId
    JOIN Project p ON p.code = ?
    LEFT JOIN TenagaAhliProject tap ON tap.rekananId = r.id AND tap.projectId = p.id
    WHERE r.tipe = 'TENAGA_AHLI' AND r.nama = ? AND (tap.id IS NOT NULL OR r.projectId = p.id)");
$stmt->execute(['CAD-001', 'kevinnn']);
$people = $stmt->fetchAll(PDO::FETCH_ASSOC);
if (count($people) !== 1) {
    fwrite(STDERR, "Diperlukan tepat satu profil kevinnn dengan penugasan CAD-001. Tidak ada profil atau pembayaran baru yang dibuat.\n"); exit(1);
}
$person = $people[0];
$fixture = ['namaPekerjaan' => 'Landscape Taman Kota Palangka Raya', 'manMonth' => 8,
    'gajiRab' => 50000000, 'spmkMulai' => '2026-02-21', 'spmkSelesai' => '2026-10-21'];
echo json_encode(['nama' => $person['nama'], 'entitas' => $person['entityName'], 'proyek' => $person['code'],
    'referensiTesting' => $fixture], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . PHP_EOL;
if (!in_array('--apply', $argv, true)) { echo "Preview saja. Gunakan --apply untuk melengkapi referensi kosong pada profil yang sudah ada.\n"; exit; }
ensure_tenaga_ahli_gaji_table($pdo);
$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare('SELECT * FROM TenagaAhliGajiKontrak WHERE rekananId = ? AND projectId = ? FOR UPDATE');
    $stmt->execute([$person['rekananId'], $person['projectId']]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($existing && $existing['sumber'] === 'SIDAMON') {
        $pdo->rollBack(); echo "Referensi sudah berasal dari Sidamon; tidak diubah.\n"; exit;
    }
    $missing = !$existing;
    foreach ($fixture as $field => $value) {
        if ($existing && ($existing[$field] === null || $existing[$field] === '')) $missing = true;
    }
    if (!$missing) { $pdo->rollBack(); echo "Referensi sudah lengkap; tidak ada perubahan.\n"; exit; }
    $pdo->prepare("INSERT INTO TenagaAhliGajiKontrak
        (id, rekananId, projectId, sumber, namaPekerjaan, manMonth, gajiRab, spmkMulai, spmkSelesai, revision)
        VALUES (?, ?, ?, 'MANUAL', ?, ?, ?, ?, ?, 1)
        ON DUPLICATE KEY UPDATE
            namaPekerjaan = COALESCE(NULLIF(namaPekerjaan, ''), VALUES(namaPekerjaan)),
            manMonth = COALESCE(manMonth, VALUES(manMonth)), gajiRab = COALESCE(gajiRab, VALUES(gajiRab)),
            spmkMulai = COALESCE(spmkMulai, VALUES(spmkMulai)), spmkSelesai = COALESCE(spmkSelesai, VALUES(spmkSelesai)),
            revision = revision + 1")
        ->execute([uuid4(), $person['rekananId'], $person['projectId'], ...array_values($fixture)]);
    $pdo->commit();
    echo "Referensi testing tersimpan. Profil, negosiasi, jadwal, dan riwayat pembayaran yang sudah ada tetap dipertahankan.\n";
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
}
