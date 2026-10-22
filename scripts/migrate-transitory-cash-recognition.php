<?php
// Preview default; --apply membukukan migrasi dengan backup dan transaksi atomik.
define('APP_ENTRY',true);
require __DIR__.'/../api/config/env.php';
require __DIR__.'/../api/config/db.php';
require __DIR__.'/../api/helpers/response.php';
require __DIR__.'/../api/helpers/kas-helpers.php';
require __DIR__.'/../api/helpers/kas-transitory.php';
$pdo=get_pdo(); transitory_ensure($pdo);
$apply=in_array('--apply',$argv,true);
$rows=$pdo->query('SELECT id FROM KasTransitory WHERE accountingVersion<>2')->fetchAll(PDO::FETCH_COLUMN);
if(!$apply) { echo count($rows)." data transitory perlu penyesuaian pembukuan. Gunakan --apply setelah backup.\n"; exit; }
$pdo->beginTransaction();
try {
    $snapshot=[];
    foreach(['KasTransitory','KasTransitoryEvent'] as $table) $snapshot[$table]=$pdo->query("SELECT * FROM `$table`".transitory_lock($pdo))->fetchAll();
    $snapshot['Transaction']=$pdo->query("SELECT * FROM `Transaction` WHERE extraFieldsJson LIKE '%transitory%'".transitory_lock($pdo))->fetchAll();
    $snapshot['Project']=$pdo->query('SELECT id,spend FROM Project'.transitory_lock($pdo))->fetchAll();
    $dir=sys_get_temp_dir().'/finance-transitory-recognition-backup-'.date('Ymd-His').'-'.bin2hex(random_bytes(4));
    if(!mkdir($dir,0700)) throw new RuntimeException('Gagal membuat direktori backup.');
    $backup=$dir.'/before.json';
    if(file_put_contents($backup,json_encode($snapshot,JSON_PRETTY_PRINT|JSON_THROW_ON_ERROR))===false) throw new RuntimeException('Gagal membuat backup.'); chmod($backup,0600);
    foreach($rows as $id) transitory_migrate_accounting($pdo,$id);
    $pdo->commit(); echo count($rows)." data transitory disesuaikan; riwayat penyerahan dipertahankan. Backup: $backup\n";
} catch(Throwable $e) { if($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
