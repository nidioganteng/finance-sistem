<?php
// Preview: php scripts/normalize-tenaga-ahli-payment-descriptions.php
// Apply: tambahkan --apply. Nominal, pajak, periode, dan tanggal tidak diubah.
define('APP_ENTRY',true);
require __DIR__.'/../api/config/env.php';
require __DIR__.'/../api/helpers/tenaga-ahli-gaji.php';
$pdo=new PDO(sprintf('mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',DB_HOST,DB_PORT,DB_NAME),DB_USER,DB_PASSWORD,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$apply=in_array('--apply',$argv,true);
$pdo->beginTransaction();
try {
    $changes=[];
    foreach ($pdo->query("SELECT id,rekananId,projectId,nama,bulan,tahun,uraian FROM HonorTenagaAhli WHERE id LIKE 'gaji-%'")->fetchAll() as $row) {
        if (!$row['rekananId'] || !$row['projectId'] || $row['id']!==tenaga_ahli_auto_payment_id($row['rekananId'],$row['projectId'],sprintf('%04d-%02d',$row['tahun'],$row['bulan']))) continue;
        $description=tenaga_ahli_honor_description($row['nama'],(int)$row['tahun'],(int)$row['bulan']);
        if ($description!==$row['uraian']) $changes[]=[$description,$row['id']];
    }
    if ($apply) {
        $stmt=$pdo->prepare('UPDATE HonorTenagaAhli SET uraian = ? WHERE id = ?');
        foreach ($changes as $change) $stmt->execute($change);
        $pdo->commit();
    } else $pdo->rollBack();
    echo ($apply?'Diperbarui: ':'Preview perubahan: ').count($changes)." uraian pembayaran otomatis.\n";
} catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
