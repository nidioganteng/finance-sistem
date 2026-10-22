<?php
define('APP_ENTRY',true);
require __DIR__.'/../api/config/env.php';
require __DIR__.'/../api/config/db.php';
require __DIR__.'/../api/helpers/kas-transitory.php';
$pdo=get_pdo(); transitory_ensure($pdo);
if(!in_array('--apply',$argv,true)) { echo "Gunakan --apply untuk menyingkat nomor bukti transitory lama; ID transaksi dan nominal tidak berubah. Backup dibuat sebelum penyesuaian.\n"; exit; }
$pdo->beginTransaction();
try {
    $backup=[];
    foreach(['KasTransitory','KasTransitoryEvent','KasTransitoryVoucher'] as $table) $backup[$table]=$pdo->query("SELECT * FROM `$table`".transitory_lock($pdo))->fetchAll(PDO::FETCH_ASSOC);
    $backup['Transaction']=$pdo->query("SELECT * FROM `Transaction` WHERE extraFieldsJson LIKE '%transitory%'".transitory_lock($pdo))->fetchAll(PDO::FETCH_ASSOC);
    $dir=sys_get_temp_dir().'/finance-transitory-voucher-backup-'.date('Ymd-His').'-'.bin2hex(random_bytes(4));
    if(!mkdir($dir,0700) || file_put_contents($dir.'/before.json',json_encode($backup,JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR))===false) throw new RuntimeException('Backup gagal; penyesuaian dibatalkan.');
    chmod($dir.'/before.json',0600);
    $count=transitory_shorten_vouchers($pdo);
    $pdo->commit(); echo "$count nomor bukti disingkat. Backup: $dir/before.json\n";
} catch(Throwable $e) { if($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
