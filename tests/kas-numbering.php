<?php
define('APP_ENTRY',true);
require __DIR__.'/../api/helpers/kas-helpers.php';
$pdo=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$pdo->exec('CREATE TABLE Entity(id TEXT,`key` TEXT); CREATE TABLE `Transaction`(entityId TEXT,noBukti TEXT);');
$checks=0;
function eq($a,$b) { global $checks; if($a!==$b) throw new Exception(var_export([$a,$b],true)); $checks++; }
foreach(['kencana'=>'UK','gaharu'=>'UG','tataring'=>'UT','ciptaAsri'=>'UC','umum'=>'UU'] as $entity=>$prefix) {
    $pdo->prepare('INSERT INTO Entity VALUES (?,?)')->execute([$entity,$entity]);
    eq(kas_next_voucher_number($pdo,$entity,'2026-09-28'),$prefix.'/09281');
    $pdo->prepare('INSERT INTO `Transaction` VALUES (?,?)')->execute([$entity,$prefix.'/09289']);
    eq(kas_next_voucher_number($pdo,$entity,'2026-09-28'),$prefix.'/092810');
    $pdo->prepare('INSERT INTO `Transaction` VALUES (?,?)')->execute([$entity,$prefix.'092812']);
    $pdo->prepare('INSERT INTO `Transaction` VALUES (?,?)')->execute([$entity,'KC/9999']);
    eq(kas_next_voucher_number($pdo,$entity,'2026-09-28'),$prefix.'/092813');
    eq(kas_next_voucher_number($pdo,$entity,'2026-09-29'),$prefix.'/09291');
}
try { kas_next_voucher_number($pdo,'gaharu','2026-02-30'); throw new Exception('Invalid date accepted'); } catch(InvalidArgumentException $e) { $checks++; }
echo "Cash voucher numbering: $checks checks passed\n";
