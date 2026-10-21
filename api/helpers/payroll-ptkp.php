<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

function payroll_ptkp_defaults(): array {
    return ['TK/0'=>54000000.0,'TK/1'=>58500000.0,'TK/2'=>63000000.0,'TK/3'=>67500000.0,
        'K/0'=>58500000.0,'K/1'=>63000000.0,'K/2'=>67500000.0,'K/3'=>72000000.0];
}
function ensure_payroll_ptkp_table(PDO $pdo): void {
    static $done=false;
    if ($done) return;
    $pdo->exec(file_get_contents(__DIR__.'/../../database/migrations/2026-10-21-payroll-ptkp-settings.sql'));
    $done=true;
}
function payroll_validate_ptkp_rates($rates): array {
    if (!is_array($rates) || count($rates)!==count(payroll_ptkp_defaults())) throw new InvalidArgumentException('Isi nominal seluruh status PTKP.');
    $result=[];
    foreach (payroll_ptkp_defaults() as $status=>$default) {
        $value=$rates[$status] ?? null;
        if (!is_numeric($value) || !is_finite((float)$value) || (float)$value<0 || (float)$value>999999999999.99) throw new InvalidArgumentException("Nominal PTKP $status tidak valid.");
        $result[$status]=round((float)$value,2);
    }
    return $result;
}
function payroll_ptkp_rates(PDO $pdo,string $entity): array {
    $stmt=$pdo->prepare('SELECT ratesJson FROM PayrollPtkpSetting WHERE entityId = ?');
    $stmt->execute([$entity]);
    $json=$stmt->fetchColumn();
    return $json ? payroll_validate_ptkp_rates(json_decode($json,true,512,JSON_THROW_ON_ERROR)) : payroll_ptkp_defaults();
}
function payroll_save_ptkp_rates(PDO $pdo,string $entity,array $rates): int {
    if (!$pdo->inTransaction()) throw new LogicException('Pengaturan PTKP wajib disimpan dalam transaksi.');
    $rates=payroll_validate_ptkp_rates($rates);
    $stmt=$pdo->prepare('SELECT entityId FROM PayrollPtkpSetting WHERE entityId = ?');
    $stmt->execute([$entity]);
    $json=json_encode($rates,JSON_THROW_ON_ERROR);
    if ($stmt->fetchColumn()) $pdo->prepare('UPDATE PayrollPtkpSetting SET ratesJson = ?, updatedAt = CURRENT_TIMESTAMP WHERE entityId = ?')->execute([$json,$entity]);
    else $pdo->prepare('INSERT INTO PayrollPtkpSetting (entityId,ratesJson) VALUES (?,?)')->execute([$entity,$json]);
    $affected=0;
    $stmt=$pdo->prepare('UPDATE Pegawai SET ptkp = ?, updatedAt = CURRENT_TIMESTAMP WHERE entityId = ? AND statusKeluarga = ?');
    foreach ($rates as $status=>$amount) { $stmt->execute([$amount,$entity,$status]); $affected+=$stmt->rowCount(); }
    return $affected;
}
