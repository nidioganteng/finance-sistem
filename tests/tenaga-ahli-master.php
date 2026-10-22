<?php
// Jalankan route master sesungguhnya pada SQLite in-memory, tanpa database aplikasi.
define('APP_ENTRY', true);
require __DIR__.'/../api/helpers/tenaga-ahli-periode.php';
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$pdo->exec("PRAGMA foreign_keys=ON;
CREATE TABLE Entity (id TEXT PRIMARY KEY, name TEXT);
CREATE TABLE Project (id TEXT PRIMARY KEY, code TEXT, name TEXT, entityId TEXT);
CREATE TABLE Rekanan (id TEXT PRIMARY KEY, nama TEXT, nik TEXT, npwp TEXT, tipe TEXT, kategori TEXT, ptkp TEXT, entityId TEXT, projectId TEXT, tanggalMulaiTugas TEXT, tanggalSelesaiTugas TEXT, isTurunLapangan INTEGER, nominalHonorBulanan REAL, createdAt TEXT, updatedAt TEXT);
CREATE TABLE TenagaAhliProject (id TEXT PRIMARY KEY, rekananId TEXT, projectId TEXT REFERENCES Project(id), tanggalMulaiTugas TEXT, tanggalSelesaiTugas TEXT, isTurunLapangan INTEGER, nominalHonorBulanan REAL, createdAt TEXT, updatedAt TEXT, UNIQUE(rekananId, projectId));
CREATE TABLE TenagaAhliGajiKontrak (id TEXT PRIMARY KEY, rekananId TEXT, projectId TEXT, sumber TEXT DEFAULT 'MANUAL', namaPekerjaan TEXT, manMonth REAL, gajiRab REAL, spmkMulai TEXT, spmkSelesai TEXT, gajiNegosiasi REAL, revision INTEGER DEFAULT 0, jadwalJson TEXT);
CREATE TABLE HonorTenagaAhli (id TEXT PRIMARY KEY, rekananId TEXT, nik TEXT, nominalHonor REAL);
INSERT INTO Entity VALUES ('gaharu','Gaharu'),('kencana','Kencana');
INSERT INTO Project VALUES ('A','GH-001','Proyek Gaharu','gaharu'),('B','KN-001','Proyek Kencana','kencana');
INSERT INTO Rekanan (id,nama,nik,tipe,entityId,projectId) VALUES ('p1','Nama Lama','1111111111111111','TENAGA_AHLI','gaharu','A'),('p2','Orang Lain','3333333333333333','TENAGA_AHLI','kencana','B');
INSERT INTO TenagaAhliProject (id,rekananId,projectId) VALUES ('old-assignment','p1','A');
INSERT INTO TenagaAhliGajiKontrak (id,rekananId,projectId,gajiNegosiasi,namaPekerjaan,manMonth,jadwalJson) VALUES ('c1','p1','A',35000000,'Pekerjaan Tersimpan',8,'[]');
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
verify((float)$pdo->query('SELECT gajiNegosiasi FROM TenagaAhliGajiKontrak WHERE id=\'c1\'')->fetchColumn(),35000000.0,'negosiasi tidak berubah');
$history=$pdo->query("SELECT * FROM HonorTenagaAhli WHERE id='legacy'")->fetch();
verify([$history['rekananId'],$history['nik'],(float)$history['nominalHonor']],['p1','1111111111111111',10000000.0],'koreksi NIK menjaga tautan riwayat dan nominal pembayaran');
verify(save_master(array_merge($body,['nik'=>'3333333333333333']))->status,409,'NIK tenaga ahli lain ditolak');
verify(save_master(array_merge($body,['id'=>'missing']))->status,404,'ID tidak ditemukan ditolak');
verify(save_master(array_merge($body,['proyekList'=>[$assignment('A'),$assignment('A')]]))->status,400,'proyek duplikat ditolak');
verify(save_master(array_merge($body,['proyekList'=>[$assignment('A'),$assignment('missing')]]))->status,404,'proyek tidak ditemukan ditolak');
verify(save_master(array_merge($body,['proyekList'=>[$assignment('B')]]))->status,409,'proyek dengan negosiasi tidak boleh dihilangkan');
$reference_body = $body;
$reference_body['proyekList'][0]['namaPekerjaan'] = 'Pekerjaan Diperbaiki';
$reference_body['proyekList'][0]['manMonth'] = 4;
$reference_body['proyekList'][0]['nominalHonorBulanan'] = 45000000;
verify(save_master($reference_body)->status,200,'referensi kontrak diedit dari master');
$reference=$pdo->query("SELECT * FROM TenagaAhliGajiKontrak WHERE id='c1'")->fetch();
verify([$reference['namaPekerjaan'],(float)$reference['manMonth'],(float)$reference['gajiRab'],$reference['spmkMulai'],$reference['spmkSelesai']],['Pekerjaan Diperbaiki',4.0,45000000.0,'2026-02-01','2026-10-31'],'nama pekerjaan, menman, RAB dan SPMK tersinkron');
verify([(float)$reference['gajiNegosiasi'],$reference['jadwalJson']],[35000000.0,'[]'],'referensi tidak mengubah negosiasi atau jadwal');
verify(save_master(array_replace_recursive($reference_body,['proyekList'=>[0=>['manMonth'=>-1]]]))->status,400,'menman negatif ditolak');
$pdo->exec("UPDATE TenagaAhliGajiKontrak SET sumber='SIDAMON' WHERE id='c1'");
verify(save_master($body)->status,200,'profil Sidamon tetap dapat diedit tanpa menimpa referensi');
verify((float)$pdo->query("SELECT gajiRab FROM TenagaAhliGajiKontrak WHERE id='c1'")->fetchColumn(),45000000.0,'referensi Sidamon tidak ditimpa master');
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
$pdo->exec("DROP TRIGGER fail_project_insert; UPDATE TenagaAhliGajiKontrak SET sumber='MANUAL',spmkMulai='2026-02-01',spmkSelesai='2026-03-31',jadwalJson='[{\"bulan\":\"2026-02\",\"nominal\":10000000,\"pph21\":300000,\"catatan\":\"\"},{\"bulan\":\"2026-03\",\"nominal\":null,\"catatan\":\"\"}]' WHERE id='c1'");
$extended_body=$reference_body;
$extended_body['proyekList'][0]['tanggalSelesaiTugas']='2026-05-31';
verify(save_master($extended_body)->status,200,'extend tanggal akhir melalui database tenaga ahli');
$schedule=json_decode($pdo->query("SELECT jadwalJson FROM TenagaAhliGajiKontrak WHERE id='c1'")->fetchColumn(),true);
verify(array_column($schedule,'bulan'),['2026-02','2026-03','2026-04','2026-05'],'extend menambahkan bulan kosong baru');
verify([$schedule[0]['nominal'],$schedule[0]['pph21']],[10000000,300000],'extend tidak mengubah gaji dan PPh tersimpan');
$extended_body['proyekList'][0]['tanggalSelesaiTugas']='2026-02-28';
verify(save_master($extended_body)->status,200,'tanggal selesai dapat dipercepat');
$schedule=json_decode($pdo->query("SELECT jadwalJson FROM TenagaAhliGajiKontrak WHERE id='c1'")->fetchColumn(),true);
verify(array_column($schedule,'bulan'),['2026-02'],'bulan kosong di luar masa kerja dihapus dari jadwal');
verify((float)$pdo->query("SELECT nominalHonor FROM HonorTenagaAhli WHERE id='legacy'")->fetchColumn(),10000000.0,'riwayat pembayaran tetap utuh');
$kept=tenaga_ahli_jadwal_masa_tugas(['spmkMulai'=>'2026-02-01','spmkSelesai'=>'2026-03-31','jadwalJson'=>'[{"bulan":"2026-03","nominal":100,"pph21":5,"catatan":"LPJ"},{"bulan":"2026-04","nominal":null,"catatan":""}]'],'2026-02-01','2026-02-28');
verify(array_column(json_decode($kept,true),'bulan'),['2026-03','2026-04'],'gaji/catatan dan perpanjangan eksplisit dipertahankan saat masa kerja berubah');
echo "$checks pemeriksaan edit master tenaga ahli lulus.\n";
