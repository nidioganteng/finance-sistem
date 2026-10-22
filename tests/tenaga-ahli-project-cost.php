<?php
define('APP_ENTRY',true);
require __DIR__.'/../api/helpers/tenaga-ahli-gaji.php';
require __DIR__.'/../api/helpers/kas-helpers.php';
$sqliteClass=class_exists('Pdo\\Sqlite')?'Pdo\\Sqlite':'PDO';
$pdo=new $sqliteClass('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$registerFunction=method_exists($pdo,'createFunction')?'createFunction':'sqliteCreateFunction';
$pdo->$registerFunction('JSON_VALUE',fn($json,$path)=>json_decode($json??'{}',true)[substr($path,2)]??null,2);
$pdo->$registerFunction('YEAR',fn($date)=>substr($date,0,4),1);
$pdo->exec("CREATE TABLE Project (id TEXT PRIMARY KEY,entityId TEXT,code TEXT,name TEXT,contractValue REAL,spend REAL,status TEXT,deadline TEXT,createdAt TEXT);
CREATE TABLE Termin (id TEXT,projectId TEXT,percentage REAL);
CREATE TABLE CoaAccount (id TEXT,code TEXT,name TEXT,kategori TEXT);
CREATE TABLE `Transaction` (id TEXT,projectId TEXT,entityId TEXT,coaAccountId TEXT,noBukti TEXT,tanggal TEXT,debit REAL,kredit REAL,keterangan TEXT,extraFieldsJson TEXT);
CREATE TABLE HonorTenagaAhli (id TEXT PRIMARY KEY,entityId TEXT,rekananId TEXT,nik TEXT,nama TEXT,npwp TEXT,uraian TEXT,tanggal TEXT,bulan INTEGER,tahun INTEGER,nominalHonor REAL,tarifPph21Persen REAL,pph21 REAL,nominalBersih REAL,projectId TEXT,namaProyek TEXT,noBukti TEXT,createdAt TEXT,updatedAt TEXT);
INSERT INTO Project VALUES ('A','entityA','GH-001','Proyek Gaharu',100000000,0,'ACTIVE',NULL,'2026-01-01'),('B','entityB','KN-001','Proyek Kencana',100000000,0,'ACTIVE',NULL,'2026-01-01');
INSERT INTO CoaAccount VALUES ('cost','511','Beban Proyek','BEBAN');");
$checks=0;
function cost_check($actual,$expected,string $label): void { global $checks; if ($actual!==$expected) throw new RuntimeException($label.': '.var_export($actual,true)); $checks++; }
$person=['nama'=>'Ahli Uji','nik'=>'test-nik','entityId'=>'entityB','projectEntityId'=>'entityA','projectName'=>'Proyek Gaharu'];
$rows=[['bulan'=>'2026-03','nominal'=>10000000,'catatan'=>'','pph21'=>500000]];
$pdo->beginTransaction();
tenaga_ahli_sync_pembayaran($pdo,$person,'p1','A',$rows,[],35000000);
cost_check(sync_project_spend($pdo,'A'),10000000.0,'bruto menjadi pengeluaran proyek');
$payment=$pdo->query('SELECT * FROM HonorTenagaAhli')->fetch();
cost_check([$payment['entityId'],(float)$payment['pph21'],(float)$payment['nominalBersih']],['entityA',500000.0,10000000.0],'entitas proyek dan PPh manual/netto tepat');
cost_check($payment['uraian'],'Honorarium Tenaga Ahli: Ahli Uji - Bulan Maret 2026','uraian seragam');
tenaga_ahli_sync_pembayaran($pdo,$person,'p1','A',$rows,$rows,35000000);
cost_check(sync_project_spend($pdo,'A'),10000000.0,'simpan ulang tidak menggandakan pengeluaran');
$rows[0]['pph21']=1000000;
tenaga_ahli_sync_pembayaran($pdo,$person,'p1','A',$rows,$rows,35000000);
cost_check((float)$pdo->query('SELECT nominalBersih FROM HonorTenagaAhli')->fetchColumn(),10000000.0,'edit PPh pelaporan tidak mengurangi gaji diterima');
cost_check(sync_project_spend($pdo,'A'),10000000.0,'PPh tidak ditambah lagi ke biaya bruto');
$pdo->exec("INSERT INTO `Transaction` VALUES ('j1','A','entityA','cost','OTHER','2026-03-01',3000000,0,'Biaya lain',NULL);");
cost_check(sync_project_spend($pdo,'A'),13000000.0,'biaya jurnal dan honor dijumlahkan');
class CostResponse extends RuntimeException { public function __construct(public array $data) { parent::__construct('Response'); } }
function require_auth(): array { return ['id'=>'test-user','role'=>'SUPER_ADMIN']; }
function get_pdo(): PDO { global $pdo; return $pdo; }
function json_response(array $data): void { throw new CostResponse($data); }
function error_response(string $message,int $status=400): void { throw new RuntimeException($message); }
function profit_data(): array { $method='GET'; $_GET=['entityId'=>'entityA','year'=>2026]; try { require __DIR__.'/../api/routes/profitabilitas.php'; } catch (CostResponse $r) { return $r->data; } throw new RuntimeException('Response wajib ada'); }
cost_check(profit_data()['projects'][0]['spend'],13000000.0,'profitabilitas memasukkan honor ketika sudah ada jurnal beban');
$pdo->exec("UPDATE HonorTenagaAhli SET noBukti='MATCHED'; INSERT INTO `Transaction` VALUES ('j2','A','entityA','cost','MATCHED','2026-03-01',10000000,0,'Jurnal gaji',NULL)");
cost_check(sync_project_spend($pdo,'A'),13000000.0,'honor yang sudah dijurnal tidak dihitung dua kali');
cost_check(profit_data()['projects'][0]['spend'],13000000.0,'profitabilitas juga menduplikasi berdasarkan bukti hanya sekali');
cost_check((float)$pdo->query("SELECT spend FROM Project WHERE id='B'")->fetchColumn(),0.0,'proyek lain tidak berubah');
$pdo->rollBack();
cost_check((int)$pdo->query('SELECT COUNT(*) FROM HonorTenagaAhli')->fetchColumn(),0,'rollback menghapus fixture pembayaran');
echo "$checks pemeriksaan biaya proyek tenaga ahli lulus.\n";
