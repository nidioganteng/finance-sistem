<?php
define('APP_ENTRY', true);
require __DIR__.'/../api/helpers/kas-helpers.php';
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$pdo->exec("CREATE TABLE Entity(id TEXT, `key` TEXT);
CREATE TABLE JenisInputTransaksi(id TEXT, `key` TEXT);
INSERT INTO JenisInputTransaksi VALUES ('bank','bankBuku'),('journal','jurnalTransaksi'),('cash','kasKecil');
CREATE TABLE CoaAccount(id TEXT, code TEXT, name TEXT);
CREATE TABLE Project(id TEXT, code TEXT, name TEXT);
CREATE TABLE SaldoAwal(entityId TEXT, coaAccountId TEXT, year INTEGER, nominal REAL);
CREATE TABLE `Transaction`(id TEXT, entityId TEXT, jenisInputId TEXT, tanggal TEXT, noBukti TEXT, keterangan TEXT, coaAccountId TEXT, debit REAL, kredit REAL, saldoSetelah REAL, extraFieldsJson TEXT, projectId TEXT, createdAt TEXT);");
$checks = 0;
function eq($a, $b, $label) { global $checks; if ($a !== $b) throw new Exception($label.': '.var_export($a,true)); $checks++; }
function add_tx($id, $entity, $jenis, $code, $debit, $credit, $extra=[], $proof='J1', $date='2026-10-10') {
    global $pdo;
    $pdo->prepare('INSERT INTO `Transaction` VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')->execute([$id,$entity,$jenis,$date.' 00:00:00',$proof,'Transfer bank',$code,$debit,$credit,0,json_encode($extra),null,$date]);
}
foreach (REKENING_BY_ENTITY as $entity=>$banks) $pdo->prepare('INSERT INTO Entity VALUES (?,?)')->execute([$entity,$entity]);
foreach (build_bank_coa_map() as $code=>$bank) {
    $code=(string)$code;
    $pdo->prepare('INSERT INTO CoaAccount VALUES (?,?,?)')->execute([$code,$code,$bank['rekeningNama']]);
    // Even a journal entered in another entity follows the designated bank account.
    add_tx('j'.$code,'kencana','journal',$code,1000,0,[],'IN-'.$code);
    add_tx('m'.$code,$bank['entityKey'],'bank',$code,1000,0,['isKasEntry'=>true,'autoPostedFromJurnal'=>true,'rekeningNama'=>$bank['rekeningNama']],'IN-'.$code);
    eq(count(bank_ledger_rows($pdo,$bank['entityKey'],'bank',$bank['rekeningNama'])),1,'original plus mirror counted once '.$code);
    eq(get_running_saldo($pdo,$bank['entityKey'],'bank',$bank['rekeningNama'],2026),1000.0,'bank balance '.$code);
}
// A historical journal without a mirror, and two banks sharing a voucher.
add_tx('transfer-out','gaharu','journal','21',0,300,[],'TRANSFER');
add_tx('transfer-in','gaharu','journal','22',300,0,[],'TRANSFER');
add_tx('second-line','gaharu','journal','22',200,0,[],'TRANSFER');
add_tx('manual','gaharu','bank','22',50,0,['isKasEntry'=>true,'rekeningNama'=>'BPD GS'],'DIRECT');
add_tx('old','gaharu','journal','22',999,0,[],'OLD','2025-10-10');
add_tx('future','gaharu','journal','22',999,0,[],'FUTURE','2027-10-10');
$pdo->exec("INSERT INTO SaldoAwal VALUES ('gaharu','22',2026,100)");
eq(get_running_saldo($pdo,'gaharu','bank','BPD GS',2026),1650.0,'current year includes opening plus original journal plus manual');
eq(get_saldo_sebelum($pdo,'gaharu','bank','2026-10-11','BPD GS',2026),1650.0,'opening period consistent');
eq(get_saldo_sebelum($pdo,'gaharu','bank','2026-01-01','BPD GS',2026),100.0,'previous years not counted twice');
eq(bank_ledger_rows($pdo,'gaharu','cash'),null,'cash ledger unaffected');
eq(bank_ledger_has_journal_source($pdo,['transfer-in']),true,'journal edits stay at source');
eq(bank_ledger_has_journal_source($pdo,['manual']),false,'manual entries remain editable');
// Exercise actual endpoint grouping, summaries, dates and account filtering.
function get_pdo() { global $pdo; return $pdo; }
function require_auth() { return ['id'=>'test']; }
class Response extends Exception { public function __construct(public array $data) {} }
function json_response($data) { throw new Response($data); }
function error_response($message,$status) { throw new Exception($message); }
function ledger($account) {
    $_GET=['entityId'=>'gaharu','jenisInputKey'=>'bankBuku','rekeningNama'=>$account,'dari'=>'2026-10-01','sampai'=>'2026-10-31'];
    $method='GET'; $segments=['kas','ledger'];
    try { include __DIR__.'/../api/routes/kas.php'; } catch (Response $r) { return $r->data; }
}
$count=(int)$pdo->query('SELECT COUNT(*) FROM `Transaction`')->fetchColumn();
$bpd=ledger('BPD GS'); $bri=ledger('BRI GS');
eq($bpd['totalMasuk'],1550.0,'BPD all receipts');
eq($bpd['totalKeluar'],0.0,'BPD no transfer withdrawal');
eq($bpd['saldoAkhir'],1650.0,'BPD closing balance');
eq($bpd['runningSaldo'],$bpd['saldoAkhir'],'summary matches list');
eq($bpd['totalCount'],3,'same account journal lines grouped');
eq($bri['totalKeluar'],300.0,'BRI transfer debit independent');
eq($bri['saldoAkhir'],700.0,'BRI balance');
eq($bpd['entries'][0]['sourceJurnal'],true,'journal marked for source editing');
eq((int)$pdo->query('SELECT COUNT(*) FROM `Transaction`')->fetchColumn(),$count,'reads never create another posting');
// Changing the original updates the bank without rebuilding stale mirror rows.
$pdo->exec("UPDATE `Transaction` SET debit=1200 WHERE id='j22'");
eq(ledger('BPD GS')['totalMasuk'],1750.0,'journal correction reflected immediately');
$pdo->exec("DELETE FROM `Transaction` WHERE id='j22'");
eq(ledger('BPD GS')['totalMasuk'],550.0,'deleted original does not leave mirror income');
echo "Bank ledger: $checks checks passed\n";
