<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');
$user=require_auth();
if (!in_array($user['role']??'', ['SUPER_ADMIN','MANAJER_KEUANGAN','STAF_KEUANGAN'],true)) return error_response('Anda tidak memiliki akses mengubah nominal PTKP.',403);
$pdo=get_pdo();
$entity=is_string($body['entityId']??null)?trim($body['entityId']):'';
if (!$entity) return error_response('Entitas wajib dipilih.',400);
$stmt=$pdo->prepare('SELECT id FROM Entity WHERE id = ?'); $stmt->execute([$entity]);
if (!$stmt->fetchColumn()) return error_response('Entitas tidak ditemukan.',404);
if (($user['role']??'')==='STAF_KEUANGAN') {
    $stmt=$pdo->prepare('SELECT 1 FROM UserEntityAccess WHERE userId = ? AND entityId = ?'); $stmt->execute([$user['id'],$entity]);
    if (!$stmt->fetchColumn()) return error_response('Anda tidak memiliki akses ke entitas ini.',403);
}
try { $rates=payroll_validate_ptkp_rates($body['rates']??null); }
catch (InvalidArgumentException $e) { return error_response($e->getMessage(),400); }
ensure_payroll_ptkp_table($pdo);
$before=payroll_ptkp_rates($pdo,$entity);
$pdo->beginTransaction();
try {
    $affected=payroll_save_ptkp_rates($pdo,$entity,$rates);
    log_activity($user['id'],'Ubah nominal PTKP seluruh status untuk entitas','FINANCIAL_CHANGE',['entityId'=>$entity,'sebelum'=>$before,'sesudah'=>$rates,'affected'=>$affected]);
    $pdo->commit();
} catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
json_response(['success'=>true,'rates'=>$rates,'message'=>'Nominal PTKP berhasil disimpan dan diterapkan ke master pegawai sesuai status.']);
