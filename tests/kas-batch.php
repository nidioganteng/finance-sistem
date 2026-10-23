<?php
define('APP_ENTRY',true);
$pdo=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
@$pdo->sqliteCreateFunction('JSON_VALUE',function($json,$path) { $v=(json_decode($json??'{}',true)?:[])[substr($path,2)]??null; return is_bool($v)?($v?'true':'false'):$v; },2);
$pdo->exec("CREATE TABLE Entity(id TEXT,`key` TEXT); INSERT INTO Entity VALUES ('A','gaharu'),('B','kencana');
CREATE TABLE JenisInputTransaksi(id TEXT,`key` TEXT,nama TEXT); INSERT INTO JenisInputTransaksi VALUES ('small','kasKecil','Kas Kecil'),('large','kasBesar','Kas Besar'),('bank','bankBuku','Buku Bank');
CREATE TABLE CoaAccount(id TEXT,code TEXT,name TEXT); INSERT INTO CoaAccount VALUES ('small','1200','Kas Kecil'),('large','120','Kas Besar'),('bank','22','BPD GS'),('cost','511','Gaji'),('cost2','512','Transport');
CREATE TABLE Project(id TEXT,code TEXT,name TEXT,contractValue REAL,status TEXT); INSERT INTO Project VALUES ('P','GH-01','Proyek A',1000,'ACTIVE'),('Q','GH-02','Proyek B',1000,'ACTIVE');
CREATE TABLE Termin(id TEXT,projectId TEXT,name TEXT,percentage INTEGER,status TEXT,createdAt TEXT);
CREATE TABLE SaldoAwal(entityId TEXT,coaAccountId TEXT,year INTEGER,nominal REAL);
CREATE TABLE `Transaction`(id TEXT,entityId TEXT,jenisInputId TEXT,tanggal TEXT,noBukti TEXT,keterangan TEXT,coaAccountId TEXT,debit REAL,kredit REAL,saldoSetelah REAL,extraFieldsJson TEXT,staffId TEXT,projectId TEXT,fakturId TEXT,createdAt TEXT);
CREATE TABLE ActivityLog(action TEXT);");
function uuid4() { return bin2hex(random_bytes(16)); }
function get_pdo() { global $pdo; return $pdo; }
function require_auth() { return ['id'=>'tester','entityKeys'=>['gaharu']]; }
function log_activity($id,$action,$category,$detail) { get_pdo()->prepare('INSERT INTO ActivityLog VALUES (?)')->execute([$action]); }
class BatchResponse extends Exception { public function __construct(public array $data,public int $status=200) {} }
function json_response($data) { throw new BatchResponse($data); }
function error_response($message,$status) { throw new BatchResponse(['error'=>$message],$status); }
function endpoint($transactions,$single=false) {
    $body=$single?$transactions:['transactions'=>$transactions]; $method='POST'; $segments=['kas',$single?'transaksi':'batch'];
    try { include __DIR__.'/../api/routes/kas.php'; } catch(BatchResponse $r) { return $r; }
}
function draft($proof,$type='kasKecil',$project='P') {
    return ['entityKey'=>'gaharu','jenisInputKey'=>$type,'tanggal'=>'2026-10-23','noBukti'=>$proof,'keterangan'=>'Biaya '.$proof,'arah'=>'keluar','projectId'=>$project,'rekeningId'=>$type==='bankBuku'?'gs-bpd':null,'rows'=>[['coaAccountId'=>'cost','nominal'=>100],['coaAccountId'=>'cost2','nominal'=>50]]];
}
$checks=0;
function eq($a,$b,$label) { global $checks; if($a!==$b) throw new Exception($label.': '.var_export($a,true)); $checks++; }
function snapshot() { $p=get_pdo(); return [$p->query('SELECT COUNT(*) FROM `Transaction`')->fetchColumn(),$p->query('SELECT COUNT(*) FROM Termin')->fetchColumn(),$p->query('SELECT COUNT(*) FROM ActivityLog')->fetchColumn(),$p->query("SELECT status FROM Project WHERE id='P'")->fetchColumn()]; }
foreach(['kasKecil'=>'small','kasBesar'=>'large','bankBuku'=>'bank'] as $type=>$jenis) {
    $a=draft($type.'-1',$type); $b=draft($type.'-2',$type,'Q');
    eq(endpoint([$a,$b])->status,200,'batch '.$type);
    $s=$pdo->prepare('SELECT noBukti,projectId,SUM(debit) AS d,SUM(kredit) AS c FROM `Transaction` WHERE jenisInputId=? GROUP BY noBukti,projectId ORDER BY noBukti'); $s->execute([$jenis]); $rows=$s->fetchAll();
    eq(count($rows),2,'two voucher groups '.$type);
    eq($rows[0]['projectId'],'P','first project '.$type); eq($rows[1]['projectId'],'Q','second project '.$type);
    foreach($rows as $r) eq((float)$r['d'],(float)$r['c'],'balanced voucher '.$r['noBukti']);
    eq(get_running_saldo($pdo,'A',$jenis,$type==='bankBuku'?'BPD GS':null,2026),-300.0,'balance '.$type);
    $before=snapshot(); eq(endpoint([$a,$b])->status,409,'retry prevents duplicate '.$type); eq(snapshot(),$before,'retry unchanged '.$type);
}
$before=snapshot();
$good=draft('NEW'); $bad=draft('BAD'); $bad['rows'][1]['coaAccountId']='missing';
eq(endpoint([$good,$bad])->status,400,'late account failure'); eq(snapshot(),$before,'all vouchers rolled back');
$bad=draft('DUP'); eq(endpoint([$bad,$bad])->status,409,'duplicate within batch'); eq(snapshot(),$before,'same-batch duplicate rollback');
$income=draft('INCOME'); $income['arah']='masuk'; $income['rows'][0]['nominal']=1100;
eq(endpoint([$income,$bad,$bad])->status,409,'failure after termin posting'); eq(snapshot(),$before,'termin and project completion rolled back');
$bad=draft('ACCESS'); $bad['entityKey']='kencana'; eq(endpoint([$good,$bad])->status,403,'entity access'); eq(snapshot(),$before,'no partial access batch');
$bad=draft('WRONG-BANK','bankBuku'); $bad['rekeningId']='kak-bpd'; eq(endpoint([$good,$bad])->status,400,'bank entity mapping'); eq(snapshot(),$before,'wrong bank rollback');
$bad=draft('DATE'); $bad['tanggal']='2026-02-30'; eq(endpoint([$good,$bad])->status,400,'invalid date'); eq(snapshot(),$before,'date rollback');
$bad=draft('TRANSITORY'); $bad['rows'][0]['coaAccountId']='system-kas-transitory';
$pdo->exec("INSERT INTO CoaAccount VALUES ('system-kas-transitory','159-TR','Kas Transitory')");
eq(endpoint([$good,$bad])->status,409,'protected account'); eq(snapshot(),$before,'protected account rollback');
eq(endpoint([])->status,400,'empty batch'); eq(endpoint(array_fill(0,51,$good))->status,400,'batch limit');
eq(endpoint(draft('SINGLE'),true)->status,200,'single form uses same posting logic');
// Bank synchronization belongs to the same transaction, even if it fails late.
$before=snapshot(); $pdo->exec("DELETE FROM JenisInputTransaksi WHERE id='bank'");
$sync=draft('SYNC'); $sync['arah']='masuk'; $sync['syncBukuBankRekeningId']='gs-bpd';
eq(endpoint([$sync])->status,400,'missing bank setup'); eq(snapshot(),$before,'cash and termin rollback on sync failure');
echo "Kas batch: $checks checks passed\n";
