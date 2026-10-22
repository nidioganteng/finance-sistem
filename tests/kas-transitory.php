<?php
define('APP_ENTRY',true);
require __DIR__.'/../api/helpers/kas-transitory.php';
require __DIR__.'/../api/helpers/kas-helpers.php';
function uuid4(): string { return sprintf('%08s-%04s-%04s-%04s-%012s',bin2hex(random_bytes(4)),bin2hex(random_bytes(2)),bin2hex(random_bytes(2)),bin2hex(random_bytes(2)),bin2hex(random_bytes(6))); }
class TransitoryPDO extends PDO {
    public function exec(string $statement): int|false {
        if(str_contains($statement,'CREATE TABLE IF NOT EXISTS KasTransitory')) return 0;
        return parent::exec($statement);
    }
}
$pdo=new TransitoryPDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
// PDO subclass still needs the legacy SQLite registration on PHP 8.5.
@$pdo->sqliteCreateFunction('JSON_VALUE',fn($json,$path)=>(json_decode($json??'{}',true)?:[])[substr($path,2)]??null,2);
$pdo->exec("CREATE TABLE Entity(id TEXT PRIMARY KEY,`key` TEXT); INSERT INTO Entity VALUES ('A','gaharu'),('B','kencana');
CREATE TABLE UserEntityAccess(userId TEXT,entityId TEXT); INSERT INTO UserEntityAccess VALUES ('staff','A');
CREATE TABLE Project(id TEXT PRIMARY KEY,entityId TEXT,code TEXT,name TEXT,spend REAL); INSERT INTO Project VALUES ('P','A','GH-001','Proyek A',10000000);
CREATE TABLE CoaAccount(id TEXT PRIMARY KEY,code TEXT,name TEXT,kategori TEXT); INSERT INTO CoaAccount VALUES ('cost','612','Gaji tenaga ahli','BEBAN'),('bank','21','Bank BRI','ASET');
CREATE TABLE `Transaction`(id TEXT PRIMARY KEY,entityId TEXT,jenisInputId TEXT,tanggal TEXT,noBukti TEXT,keterangan TEXT,coaAccountId TEXT,debit REAL,kredit REAL,saldoSetelah REAL,extraFieldsJson TEXT,staffId TEXT,projectId TEXT,fakturId TEXT,createdAt TEXT);
CREATE TABLE HonorTenagaAhli(id TEXT PRIMARY KEY,entityId TEXT,nama TEXT,bulan INTEGER,tahun INTEGER,nominalHonor REAL,noBukti TEXT,projectId TEXT);
INSERT INTO HonorTenagaAhli VALUES ('honor','A','Ahli Uji',1,2001,10000000,'OUT-1','P');
CREATE TABLE Pegawai(id TEXT PRIMARY KEY,nama TEXT);
CREATE TABLE GajiPegawaiBulanan(id TEXT PRIMARY KEY,entityId TEXT,pegawaiId TEXT,bulan INTEGER,tahun INTEGER,totalGajiBersih REAL);
CREATE TABLE KasTransitory(id TEXT PRIMARY KEY,entityId TEXT,sourceTransactionId TEXT,sourceNoBukti TEXT,sourceDate TEXT,sourceSnapshot TEXT,projectId TEXT,category TEXT,recipient TEXT,amount REAL,location TEXT,reason TEXT,targetDate TEXT,payrollType TEXT,payrollId TEXT,revision INTEGER DEFAULT 1,createdBy TEXT,createdAt TEXT DEFAULT CURRENT_TIMESTAMP,updatedAt TEXT DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE KasTransitoryEvent(id TEXT PRIMARY KEY,transitoryId TEXT,kind TEXT,eventOrder INTEGER,amount REAL,eventDate TEXT,receipt TEXT,note TEXT,reversalNoBukti TEXT,requestId TEXT UNIQUE,actorId TEXT,createdAt TEXT DEFAULT CURRENT_TIMESTAMP);");
$insert=$pdo->prepare('INSERT INTO `Transaction` (id,entityId,jenisInputId,tanggal,noBukti,keterangan,coaAccountId,debit,kredit,saldoSetelah,extraFieldsJson,staffId,projectId,createdAt) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
$insert->execute(['cash','A','kas','2001-01-01 00:00:00','OUT-1','Gaji ditahan','bank',0,10000000,0,'{"isKasEntry":true}','staff','P','2001-01-01']);
$insert->execute(['expense','A','kas','2001-01-01 00:00:00','OUT-1','Gaji ditahan','cost',10000000,0,0,null,'staff','P','2001-01-01']);
$admin=['id'=>'admin','role'=>'SUPER_ADMIN']; $staff=['id'=>'staff','role'=>'STAF_KEUANGAN']; $checks=0;
function eq($actual,$expected,string $label): void { global $checks; if($actual!==$expected) throw new RuntimeException("$label: ".var_export($actual,true)); $checks++; }
function reject(callable $fn,string $label): void { global $checks; try { $fn(); } catch(InvalidArgumentException|RuntimeException $e) { $checks++; return; } throw new Exception('Diterima padahal tidak valid: '.$label); }
function atomic(callable $fn) { global $pdo; $pdo->beginTransaction(); try { $r=$fn(); $pdo->commit(); return $r; } catch(Throwable $e) { $pdo->rollBack(); throw $e; } }
$body=['sourceTransactionId'=>'cash','amount'=>10000000,'category'=>'GAJI_HOLD','recipient'=>'Ahli <Uji>','location'=>'Brankas keuangan','reason'=>'Menunggu LPJ foto','targetDate'=>'2001-01-05','payrollType'=>'HONOR','payrollId'=>'honor','requestId'=>uuid4()];
transitory_access($pdo,$staff,'A'); $checks++;
reject(fn()=>transitory_access($pdo,$staff,'B'),'akses entitas lain');
reject(fn()=>transitory_access($pdo,['role'=>'MANAGER_ADMIN'],'A'),'role non-finance');
foreach(['location','reason','recipient'] as $field) { $bad=$body; $bad[$field]=' '; reject(fn()=>atomic(fn()=>transitory_create($pdo,$admin,$bad)),"wajib $field"); }
foreach([-1,'NaN',0,10000001,1.001] as $amount) { $bad=$body; $bad['amount']=$amount; reject(fn()=>atomic(fn()=>transitory_create($pdo,$admin,$bad)),'nominal invalid'); }
$bad=$body; $bad['targetDate']='2001-02-30'; reject(fn()=>atomic(fn()=>transitory_create($pdo,$admin,$bad)),'tanggal nyata');
$bad=$body; $bad['sourceTransactionId']='expense'; reject(fn()=>atomic(fn()=>transitory_create($pdo,$admin,$bad)),'bukan cash out');
$bad=$body; $bad['payrollId']='missing'; reject(fn()=>atomic(fn()=>transitory_create($pdo,$admin,$bad)),'payroll hilang');
$id=atomic(fn()=>transitory_create($pdo,$staff,$body)); eq($id,$body['requestId'],'hold tersimpan');
eq(atomic(fn()=>transitory_create($pdo,$staff,$body)),$id,'retry hold idempotent');
eq((int)$pdo->query('SELECT COUNT(*) FROM KasTransitory')->fetchColumn(),1,'tidak ada duplikasi hold');
eq((int)$pdo->query('SELECT COUNT(*) FROM `Transaction`')->fetchColumn(),2,'hold tidak mencatat biaya lagi');
$bad=$body; $bad['requestId']=uuid4(); reject(fn()=>atomic(fn()=>transitory_create($pdo,$admin,$bad)),'source dialokasi ganda');
$row=$pdo->query('SELECT * FROM KasTransitory')->fetch();
eq(transitory_totals($row,[],'2001-01-06')['status'],'OVERDUE','target lewat');
eq(transitory_totals($row,[],'2001-01-05')['status'],'HELD','target tepat belum overdue');
reject(fn()=>transitory_guard_transactions($pdo,['expense']),'kunci baris pendamping');
reject(fn()=>transitory_guard_transactions($pdo,['cash']),'kunci cash out');
$release=['amount'=>6000000,'eventDate'=>'2001-01-06','receipt'=>'TRF-1','note'=>'LPJ diterima, sebagian diserahkan','revision'=>1,'requestId'=>uuid4()];
$eventId=atomic(fn()=>transitory_record_event($pdo,$staff,$id,'RELEASE',$release));
eq(atomic(fn()=>transitory_record_event($pdo,$staff,$id,'RELEASE',$release)),$eventId,'retry release tidak duplikat');
eq(transitory_totals($row,transitory_events($pdo,$id),'2001-01-06')['remaining'],4000000,'sisa hold setelah parsial');
eq((int)$pdo->query('SELECT COUNT(*) FROM `Transaction`')->fetchColumn(),2,'release tidak memotong kas utama lagi');
$bad=$release; $bad['amount']=1; reject(fn()=>atomic(fn()=>transitory_record_event($pdo,$admin,$id,'RELEASE',$bad)),'requestId payload berbeda');
$bad=$release; $bad['requestId']=uuid4(); reject(fn()=>atomic(fn()=>transitory_record_event($pdo,$admin,$id,'RELEASE',$bad)),'revisi lama');
$bad['revision']=2; $bad['amount']=4000001; reject(fn()=>atomic(fn()=>transitory_record_event($pdo,$admin,$id,'RELEASE',$bad)),'release melebihi saldo');
$bad['amount']=1; $bad['eventDate']='2199-01-01'; reject(fn()=>atomic(fn()=>transitory_record_event($pdo,$admin,$id,'RELEASE',$bad)),'tanggal masa depan');
$pdo->exec("UPDATE `Transaction` SET debit=9999999 WHERE id='expense'");
$bad['eventDate']='2001-01-06'; reject(fn()=>atomic(fn()=>transitory_record_event($pdo,$admin,$id,'RELEASE',$bad)),'sumber berubah');
$pdo->exec("UPDATE `Transaction` SET debit=10000000 WHERE id='expense'");
$reverse=['amount'=>4000000,'eventDate'=>'2001-01-07','receipt'=>'APPROVAL-1','note'=>'Pembatalan sisa disetujui direktur','revision'=>2,'requestId'=>uuid4()];
reject(fn()=>atomic(fn()=>transitory_record_event($pdo,$staff,$id,'REVERSAL',$reverse)),'staf tidak boleh reversal');
atomic(fn()=>transitory_record_event($pdo,$admin,$id,'REVERSAL',$reverse));
eq(transitory_totals($row,transitory_events($pdo,$id),'2001-01-08')['remaining'],0,'reversal menghabiskan sisa');
eq(transitory_totals($row,transitory_events($pdo,$id),'2001-01-08')['status'],'REVERSED','status reversal');
eq((float)$pdo->query("SELECT SUM(debit-kredit) FROM `Transaction` WHERE coaAccountId='bank'")->fetchColumn(),-6000000.0,'kas utama kembali sebesar reversal');
eq((float)$pdo->query("SELECT SUM(debit-kredit) FROM `Transaction` WHERE coaAccountId='cost'")->fetchColumn(),6000000.0,'biaya dikoreksi satu kali');
eq((float)$pdo->query("SELECT spend FROM Project WHERE id='P'")->fetchColumn(),6000000.0,'cache biaya proyek ikut koreksi');
eq(transitory_allocated($pdo,'cash'),1000000000,'dana dibatalkan tidak dapat ditahan ulang dari bukti lama');
$bad=$body; $bad['requestId']=uuid4(); $bad['amount']=1; reject(fn()=>atomic(fn()=>transitory_create($pdo,$admin,$bad)),'reversal tidak membebaskan bukti untuk dipakai lagi');
$reverseIds=$pdo->query("SELECT id FROM `Transaction` WHERE noBukti LIKE 'KTR-%'")->fetchAll(PDO::FETCH_COLUMN);
reject(fn()=>transitory_guard_transactions($pdo,$reverseIds),'bukti reversal dikunci');
eq((int)$pdo->query('SELECT COUNT(*) FROM KasTransitoryEvent')->fetchColumn(),2,'semua aksi ditelusuri');
// Kegagalan di tengah pencatatan event harus membatalkan seluruh baris koreksi.
$pdo->beginTransaction(); $pdo->exec("DELETE FROM KasTransitoryEvent WHERE kind='REVERSAL'; UPDATE KasTransitory SET revision=2");
$pdo->exec("CREATE TRIGGER fail_event BEFORE INSERT ON KasTransitoryEvent BEGIN SELECT RAISE(ABORT,'fixture failure'); END");
$count=(int)$pdo->query('SELECT COUNT(*) FROM `Transaction`')->fetchColumn();
try { transitory_record_event($pdo,$admin,$id,'REVERSAL',array_merge($reverse,['requestId'=>uuid4()])); } catch(Throwable $e) { $pdo->rollBack(); }
eq((int)$pdo->query('SELECT COUNT(*) FROM `Transaction`')->fetchColumn(),$count,'rollback membatalkan jurnal reversal yang gagal');
class TransitoryResponse extends Exception { public function __construct(public array $payload,public int $status=200) { parent::__construct('response'); } }
$routeUser=$admin;
function require_auth(): array { global $routeUser; return $routeUser; }
function get_pdo(): PDO { global $pdo; return $pdo; }
function json_response(array $data,int $status=200): void { throw new TransitoryResponse($data,$status); }
function error_response(string $message,int $status=400): void { throw new TransitoryResponse(['message'=>$message],$status); }
function log_activity(...$args): void {}
function endpoint(array $user,string $entity): TransitoryResponse {
    global $routeUser; $routeUser=$user; $method='GET'; $_GET=['entityId'=>$entity]; $segments=['kas-transitory'];
    try { require __DIR__.'/../api/routes/kas-transitory.php'; } catch(TransitoryResponse $r) { return $r; }
    throw new RuntimeException('Response wajib ada.');
}
$response=endpoint($admin,'A');
eq($response->status,200,'GET API sesungguhnya');
eq(count($response->payload['items']),1,'item mengikuti entitas');
eq($response->payload['summary']['held'],0,'saldo API sesuai riwayat');
eq($response->payload['summary']['unbalanced'],0,'balance API sesuai sumber');
eq(count($response->payload['sources']),0,'bukti penuh/reversal tidak ditawarkan ulang');
eq(endpoint($staff,'B')->status,403,'API menolak entitas lain');
eq(endpoint(['id'=>'reader','role'=>'MANAGER_ADMIN'],'A')->status,403,'API menolak role non-finance');
$pdo->exec("UPDATE HonorTenagaAhli SET nominalHonor=5000000 WHERE id='honor'");
eq(endpoint($admin,'A')->payload['summary']['unbalanced'],1,'perubahan nominal payroll tampil sebagai selisih');
$pdo->exec("UPDATE HonorTenagaAhli SET nominalHonor=10000000 WHERE id='honor'");
// Cash out jurnal + mirror: reversal tidak menggandakan beban.
$insert->execute(['journal-cash','A','jurnal','2001-01-01 00:00:00','OUT-2','Jurnal','bank',0,10000,0,null,'staff','P','2001-01-01']);
$insert->execute(['journal-cost','A','jurnal','2001-01-01 00:00:00','OUT-2','Jurnal','cost',10000,0,0,null,'staff','P','2001-01-01']);
$insert->execute(['mirror-cash','A','kas','2001-01-01 00:00:00','OUT-2','Mirror','bank',0,10000,0,'{"isKasEntry":true,"autoPostedFromJurnal":true}','staff','P','2001-01-01']);
$insert->execute(['mirror-cost','A','kas','2001-01-01 00:00:00','OUT-2','Mirror','cost',10000,0,0,'{"autoPostedFromJurnal":true}','staff','P','2001-01-01']);
$mirrorBody=array_merge($body,['sourceTransactionId'=>'mirror-cash','amount'=>10000,'payrollId'=>null,'payrollType'=>null,'requestId'=>uuid4()]);
$mirrorId=atomic(fn()=>transitory_create($pdo,$admin,$mirrorBody));
$mirrorEvent=array_merge($reverse,['amount'=>10000,'revision'=>1,'requestId'=>uuid4()]);
atomic(fn()=>transitory_record_event($pdo,$admin,$mirrorId,'REVERSAL',$mirrorEvent));
eq(sync_project_spend($pdo,'P'),6000000.0,'mirror jurnal dan reversal tidak menggandakan biaya proyek');
eq((float)$pdo->query("SELECT SUM(debit-kredit) FROM `Transaction` WHERE jenisInputId='jurnal' AND coaAccountId='cost'")->fetchColumn(),0.0,'reversal jurnal membalik beban asli');
$tinyRows=[['id'=>'cash','debit'=>0,'kredit'=>1],['id'=>'cost1','debit'=>0.33,'kredit'=>0],['id'=>'cost2','debit'=>0.33,'kredit'=>0],['id'=>'cost3','debit'=>0.34,'kredit'=>0]];
$tiny=transitory_scaled_legs($tinyRows,0.01);
eq(array_sum(array_column($tiny,'debit')),1,'pembulatan reversal satu sen sisi kas');
eq(array_sum(array_column($tiny,'credit')),1,'distribusi biaya satu sen tetap balance');
eq(count(array_filter($tiny,fn($leg)=>$leg['debit']>0 && $leg['credit']>0)),0,'pembulatan tidak membuat leg debit-kredit campuran');
echo "$checks pemeriksaan Kas Transitory lulus.\n";
