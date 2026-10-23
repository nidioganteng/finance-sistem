<?php
define('APP_ENTRY',true);
require __DIR__.'/../api/helpers/faktur-rekanan.php';
$pdo=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);
$pdo->exec("CREATE TABLE Entity(id TEXT); INSERT INTO Entity VALUES ('A'),('B');
CREATE TABLE Rekanan(id TEXT PRIMARY KEY,entityId TEXT,nama TEXT,npwp TEXT,tipe TEXT,createdAt TEXT,updatedAt TEXT);
CREATE TABLE FakturPendapatan(id TEXT PRIMARY KEY);");
function uuid4() { return bin2hex(random_bytes(16)); }
$checks=0;
function eq($a,$b,$label) { global $checks; if($a!==$b) throw new Exception($label.': '.var_export($a,true)); $checks++; }
function register($entity,$name,$npwp) {
    global $pdo; $pdo->beginTransaction();
    try { $id=faktur_ensure_rekanan($pdo,$entity,$name,$npwp); $pdo->commit(); return $id; }
    catch(Throwable $e) { $pdo->rollBack(); throw $e; }
}
$id=register('A',' PT   Rekanan Baru ','01.234.567.8-901.000');
$row=$pdo->query("SELECT * FROM Rekanan WHERE id='$id'")->fetch(PDO::FETCH_ASSOC);
eq($row['nama'],'PT Rekanan Baru','normalized name'); eq($row['npwp'],'012345678901000','normalized NPWP');
eq($row['tipe'],'KLIEN','invoice partner category'); eq($row['entityId'],'A','available in current entity');
eq(register('A','pt rekanan baru','012345678901000'),$id,'reused next invoice');
eq(register('A','Different invoice spelling','01.234.567.8-901.000'),$id,'NPWP identifies existing partner');
$blank=register('A','Dinas Contoh','-');
eq(register('A','DINAS   CONTOH','000123'),$blank,'fill missing NPWP without duplicate');
eq($pdo->query("SELECT npwp FROM Rekanan WHERE id='$blank'")->fetchColumn(),'000123','leading zeros retained');
$distinct=register('A','PT Rekanan Baru','99999');
eq($distinct!==$id,true,'different known NPWP not merged by name');
$pdo->exec("INSERT INTO Rekanan VALUES ('shared',NULL,'Vendor Bersama','888','VENDOR','2026-01-01','2026-01-01')");
eq(register('A','Vendor Bersama','888'),'shared','reuse visible global vendor');
eq(register('B','Vendor Bersama','888'),'shared','global partner available across entities');
eq($pdo->query("SELECT tipe FROM Rekanan WHERE id='shared'")->fetchColumn(),'VENDOR','existing category preserved');
$other=register('B','PT Rekanan Baru','012345678901000');
eq($other!==$id,true,'private partner remains scoped to its entity');
$before=(int)$pdo->query('SELECT COUNT(*) FROM Rekanan')->fetchColumn();
$pdo->exec("INSERT INTO FakturPendapatan VALUES ('existing')");
$pdo->beginTransaction();
try {
    faktur_ensure_rekanan($pdo,'A','Must Roll Back','777');
    $pdo->exec("INSERT INTO FakturPendapatan VALUES ('existing')");
    throw new Exception('Expected invoice failure');
} catch(PDOException $e) { $pdo->rollBack(); }
eq((int)$pdo->query('SELECT COUNT(*) FROM Rekanan')->fetchColumn(),$before,'failed invoice does not leave orphan partner');
// Exercise the real create/update route, including the master registration call.
$pdo->exec("DROP TABLE FakturPendapatan;
CREATE TABLE FakturPendapatan(id TEXT PRIMARY KEY,entityId TEXT,npwp TEXT,noFaktur TEXT,masaPajak INTEGER,tahunPajak INTEGER,namaRekanan TEXT,namaJkp TEXT,dpp REAL,dppNilaiLain REAL,tarifPpnPersen REAL,tarifPphPersen REAL,ppn REAL,pph REAL,nilaiProyek REAL,labaSetelahPajak REAL,kodeJenisProyek INTEGER,pekerjaanPerusahaan REAL,pekerjaanYangDipinjam REAL,tanggalTerima TEXT,bank TEXT,nominalDiterima REAL,projectId TEXT,bankTransactionId TEXT,createdById TEXT,createdAt TEXT,updatedAt TEXT);
CREATE TABLE TarifPajak(tarifPersen REAL,active INTEGER,jenis TEXT,tanggalMulai TEXT);");
function get_pdo() { global $pdo; return $pdo; }
function require_auth() { return ['id'=>'tester']; }
function log_activity(...$args) {}
class PartnerResponse extends Exception { public function __construct(public array $data,public int $status=200) {} }
function json_response($data,$status=200) { throw new PartnerResponse($data,$status); }
function error_response($message,$status) { throw new PartnerResponse(['error'=>$message],$status); }
$method=$argv[1]??'POST';
$body=['entityId'=>'A','npwp'=>'123000999','noFaktur'=>'F-001','masaPajak'=>10,'tahunPajak'=>2026,'namaRekanan'=>'Rekanan Dari Form','namaJkp'=>'Jasa','dpp'=>1000,'dppNilaiLain'=>917,'tarifPpnPersen'=>12,'tarifPphPersen'=>3.5];
$segments=['pendapatan','faktur'];
if($method==='PUT') {
    $pdo->exec("INSERT INTO FakturPendapatan(id,entityId,namaRekanan,npwp,tarifPpnPersen,tarifPphPersen) VALUES ('edit-me','A','Lama','123',12,3.5)");
    $segments[]='edit-me';
}
try { require __DIR__.'/../api/routes/pendapatan.php'; } catch(PartnerResponse $r) { $response=$r; }
eq($response->status,$method==='POST'?201:200,'invoice route success');
eq((int)$pdo->query("SELECT COUNT(*) FROM Rekanan WHERE entityId='A' AND npwp='123000999'")->fetchColumn(),1,'manual partner registered by actual route');
eq((int)$pdo->query("SELECT COUNT(*) FROM FakturPendapatan WHERE namaRekanan='Rekanan Dari Form'")->fetchColumn(),1,'invoice saved with partner');
echo "Invoice partner registration: $checks checks passed\n";
