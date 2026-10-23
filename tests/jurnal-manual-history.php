<?php
define('APP_ENTRY', true);
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$pdo->exec("CREATE TABLE JenisInputTransaksi(id TEXT, `key` TEXT);
INSERT INTO JenisInputTransaksi VALUES ('journal','jurnalTransaksi');
CREATE TABLE CoaAccount(id TEXT, code TEXT, name TEXT);
CREATE TABLE Project(id TEXT, code TEXT, name TEXT);
CREATE TABLE `Transaction`(id TEXT, entityId TEXT, jenisInputId TEXT, tanggal TEXT, noBukti TEXT, keterangan TEXT, debit REAL, kredit REAL, projectId TEXT, fakturId TEXT, extraFieldsJson TEXT, coaAccountId TEXT, createdAt TEXT);");
$insert=$pdo->prepare('INSERT INTO `Transaction` VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)');
function add_entry($proof,$extra) {
    global $insert;
    $insert->execute([$proof,'entity','journal','2026-10-22 00:00:00',$proof,'Gaji',100,0,null,null,$extra,null,'2026-10-22']);
}
// More than one page of automatic entries must not create empty manual pages.
for($i=0;$i<30;$i++) add_entry('KTH-'.$i,json_encode(['transitoryAccounting'=>true,'transitoryPhase'=>$i%2?'HOLD':'RELEASE']));
add_entry('KTB-legacy',json_encode(['transitoryReversalId'=>'legacy']));
add_entry('CROSSING',json_encode(['isCrossingEntry'=>true]));
add_entry('MANUAL',null);
add_entry('MANUAL-EMPTY','{}');
add_entry('MANUAL-LEGACY','invalid-json');
// A user-entered description/prefix is not a reliable indicator of source.
add_entry('KTH-MANUAL',null);
function require_auth() { return ['id'=>'test']; }
function get_pdo() { global $pdo; return $pdo; }
class HistoryResponse extends Exception { public function __construct(public array $data) {} }
function json_response($data) { throw new HistoryResponse($data); }
function error_response($message,$status) { throw new Exception($message); }
$_GET=['entityId'=>'entity','dari'=>'2026-10-01','sampai'=>'2026-10-31'];
$method='GET'; $segments=['jurnal-transaksi'];
$before=$pdo->query('SELECT COUNT(*) FROM `Transaction`')->fetchColumn();
try { require __DIR__.'/../api/routes/jurnal-transaksi.php'; } catch(HistoryResponse $r) { $data=$r->data; }
if(count($data['groups'])!==4 || $data['totalPages']!==1) throw new Exception('Manual history or pagination includes automatic postings');
$proofs=array_column($data['groups'],'noBukti');
sort($proofs);
if($proofs!==['KTH-MANUAL','MANUAL','MANUAL-EMPTY','MANUAL-LEGACY']) throw new Exception('Manual journal lost');
if($pdo->query('SELECT COUNT(*) FROM `Transaction`')->fetchColumn()!==$before) throw new Exception('Accounting entries must remain available to Jurnal Umum');
echo "Manual journal history: filtering, pagination and retained accounting entries passed\n";
