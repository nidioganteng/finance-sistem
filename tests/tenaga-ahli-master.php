<?php
// Jalankan route master sesungguhnya pada SQLite in-memory, tanpa database aplikasi.
define('APP_ENTRY', true);
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$pdo->exec("PRAGMA foreign_keys=ON;
CREATE TABLE Entity (id TEXT PRIMARY KEY, name TEXT);
CREATE TABLE Project (id TEXT PRIMARY KEY, code TEXT, name TEXT, entityId TEXT);
CREATE TABLE Rekanan (id TEXT PRIMARY KEY, nama TEXT, nik TEXT, npwp TEXT, tipe TEXT, kategori TEXT, ptkp TEXT, entityId TEXT, projectId TEXT, tanggalMulaiTugas TEXT, tanggalSelesaiTugas TEXT, isTurunLapangan INTEGER, nominalHonorBulanan REAL, createdAt TEXT, updatedAt TEXT);
CREATE TABLE TenagaAhliProject (id TEXT PRIMARY KEY, rekananId TEXT, projectId TEXT REFERENCES Project(id), tanggalMulaiTugas TEXT, tanggalSelesaiTugas TEXT, isTurunLapangan INTEGER, nominalHonorBulanan REAL, createdAt TEXT, updatedAt TEXT, UNIQUE(rekananId, projectId));
CREATE TABLE TenagaAhliGajiKontrak (rekananId TEXT, projectId TEXT, gajiNegosiasi REAL);
CREATE TABLE HonorTenagaAhli (id TEXT PRIMARY KEY, rekananId TEXT, nik TEXT, nominalHonor REAL);
INSERT INTO Entity VALUES ('gaharu','Gaharu'),('kencana','Kencana');
INSERT INTO Project VALUES ('A','GH-001','Proyek Gaharu','gaharu'),('B','KN-001','Proyek Kencana','kencana');
INSERT INTO Rekanan (id,nama,nik,tipe,entityId,projectId) VALUES ('p1','Nama Lama','1111111111111111','TENAGA_AHLI','gaharu','A'),('p2','Orang Lain','3333333333333333','TENAGA_AHLI','kencana','B');
INSERT INTO TenagaAhliProject (id,rekananId,projectId) VALUES ('old-assignment','p1','A');
INSERT INTO TenagaAhliGajiKontrak VALUES ('p1','A',35000000);
INSERT INTO HonorTenagaAhli VALUES ('legacy',NULL,'1111111111111111',10000000);");
class MasterResponse extends RuntimeException {
    public function __construct(public array $payload, public int $status) { parent::__construct('Response'); }
}
function require_auth(): array { return ['id'=>'test-user','role'=>'SUPER_ADMIN']; }
function get_pdo(): PDO { global $pdo; return $pdo; }
function ensure_tenaga_ahli_tables(PDO $pdo): void {}
function ensure_tenaga_ahli_gaji_table(PDO $pdo): void {}
function parse_rupiah_num($value, float $fallback): float { return is_numeric($value) ? (float)$value : $fallback; }
function error_response(string $message, int $status=400): void { throw new MasterResponse(['error'=>$message],$status); }
function json_response(array $data): void { throw new MasterResponse($data,200); }
function log_activity(...$args): void {}
function uuid4(): string { static $number=0; return 'test-id-'.++$number; }
function fmt_rp_payroll($value): string { return (string)$value; }
function fmt_tanggal_id($value): string { return (string)$value; }
$source = file_get_contents(__DIR__.'/../api/routes/payroll.php');
$start = strpos($source, "elseif (\$method === 'POST' && \$sub === 'tenaga-ahli' && \$sub2 === '')");
$end = strpos($source, '// ─── DELETE /api/payroll/tenaga-ahli/', $start);
$master_route = preg_replace('/^elseif/', 'if', substr($source,$start,$end-$start));
function save_master(array $body): MasterResponse {
    global $master_route, $pdo;
    $method='POST'; $sub='tenaga-ahli'; $sub2='';
    try { eval($master_route); }
    catch (MasterResponse $response) {
        if ($pdo->inTransaction()) throw new RuntimeException('Transaksi dibiarkan terbuka');
        return $response;
    }
    throw new RuntimeException('Route tidak mengembalikan respons');
}
$checks=0;
function verify($actual,$expected,string $label): void {
    global $checks;
    if ($actual !== $expected) throw new RuntimeException($label.': '.var_export($actual,true));
    $checks++;
}
$assignment = fn($project) => ['projectId'=>$project,'tanggalMulaiTugas'=>'2026-02-01','tanggalSelesaiTugas'=>'2026-10-31','isTurunLapangan'=>true,'nominalHonorBulanan'=>50000000];
$body=['id'=>'p1','nama'=>'Nama Diperbaiki','nik'=>'2222222222222222','npwp'=>'NPWP-UJI','ptkp'=>'K/1','kategori'=>'Ahli Uji','entityId'=>'gaharu','proyekList'=>[$assignment('A'),$assignment('B')]];
verify(save_master($body)->status,200,'edit profil dan tambah proyek');
verify((int)$pdo->query('SELECT COUNT(*) FROM Rekanan')->fetchColumn(),2,'tidak membuat profil duplikat');
$person=$pdo->query("SELECT * FROM Rekanan WHERE id='p1'")->fetch();
verify([$person['nama'],$person['nik'],$person['npwp'],$person['ptkp'],$person['entityId']],['Nama Diperbaiki','2222222222222222','NPWP-UJI','K/1','gaharu'],'perbaikan data diri dan entitas profil');
verify($pdo->query("SELECT projectId FROM TenagaAhliProject WHERE rekananId='p1' ORDER BY projectId")->fetchAll(PDO::FETCH_COLUMN),['A','B'],'proyek lama dan baru tersimpan');
verify((float)$pdo->query('SELECT gajiNegosiasi FROM TenagaAhliGajiKontrak')->fetchColumn(),35000000.0,'negosiasi tidak berubah');
$history=$pdo->query("SELECT * FROM HonorTenagaAhli WHERE id='legacy'")->fetch();
verify([$history['rekananId'],$history['nik'],(float)$history['nominalHonor']],['p1','1111111111111111',10000000.0],'koreksi NIK menjaga tautan riwayat dan nominal pembayaran');
verify(save_master(array_merge($body,['nik'=>'3333333333333333']))->status,409,'NIK tenaga ahli lain ditolak');
verify(save_master(array_merge($body,['id'=>'missing']))->status,404,'ID tidak ditemukan ditolak');
verify(save_master(array_merge($body,['proyekList'=>[$assignment('A'),$assignment('A')]]))->status,400,'proyek duplikat ditolak');
verify(save_master(array_merge($body,['proyekList'=>[$assignment('A'),$assignment('missing')]]))->status,404,'proyek tidak ditemukan ditolak');
verify(save_master(array_merge($body,['proyekList'=>[$assignment('B')]]))->status,409,'proyek dengan negosiasi tidak boleh dihilangkan');
$pdo->exec("INSERT INTO HonorTenagaAhli VALUES ('legacy-second',NULL,'2222222222222222',100);
CREATE TRIGGER fail_project_insert BEFORE INSERT ON TenagaAhliProject WHEN NEW.projectId='B' BEGIN SELECT RAISE(ABORT,'fixture failure'); END");
try {
    save_master(array_merge($body,['nama'=>'Tidak Boleh Tersimpan','nik'=>'4444444444444444']));
    throw new RuntimeException('Kegagalan fixture tidak terjadi');
} catch (PDOException $expected) {}
verify($pdo->inTransaction(),false,'transaksi gagal ditutup');
verify($pdo->query("SELECT nama FROM Rekanan WHERE id='p1'")->fetchColumn(),'Nama Diperbaiki','profil rollback jika penugasan gagal');
verify($pdo->query("SELECT projectId FROM TenagaAhliProject WHERE rekananId='p1' ORDER BY projectId")->fetchAll(PDO::FETCH_COLUMN),['A','B'],'seluruh penugasan rollback jika satu insert gagal');
verify($pdo->query("SELECT rekananId FROM HonorTenagaAhli WHERE id='legacy-second'")->fetchColumn(),null,'tautan riwayat juga rollback jika penugasan gagal');
echo "$checks pemeriksaan edit master tenaga ahli lulus.\n";
