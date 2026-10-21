<?php
define('APP_ENTRY',true);
require __DIR__.'/../api/helpers/payroll-ptkp.php';
class PtkpTestPDO extends PDO {
    public function exec(string $statement): int|false {
        // Migration sudah direpresentasikan oleh skema SQLite di bawah.
        if (str_contains($statement,'ENGINE=InnoDB')) return 0;
        return parent::exec($statement);
    }
}
$pdo=new PtkpTestPDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->exec("CREATE TABLE PayrollPtkpSetting (entityId TEXT PRIMARY KEY,ratesJson TEXT,updatedAt TEXT);
CREATE TABLE Pegawai (id TEXT PRIMARY KEY,entityId TEXT,statusKeluarga TEXT,ptkp REAL,updatedAt TEXT);
CREATE TABLE Entity (id TEXT PRIMARY KEY);
CREATE TABLE UserEntityAccess (userId TEXT,entityId TEXT);
INSERT INTO Entity VALUES ('A'),('B');
INSERT INTO Pegawai VALUES ('p1','A','TK/0',54000000,NULL),('p2','A','K/1',63000000,NULL),('p3','B','TK/0',54000000,NULL);
INSERT INTO UserEntityAccess VALUES ('staff','A');");
$checks=0;
function check_ptkp($actual,$expected,string $label): void { global $checks; if ($actual!==$expected) throw new RuntimeException($label.': '.var_export($actual,true)); $checks++; }
function reject_ptkp(callable $fn,string $label): void { try { $fn(); } catch (InvalidArgumentException $e) { check_ptkp(true,true,$label); return; } throw new RuntimeException('Seharusnya ditolak: '.$label); }
check_ptkp(payroll_ptkp_rates($pdo,'A')['TK/0'],54000000.0,'nilai awal tanpa konfigurasi');
$rates=payroll_ptkp_defaults(); $rates['TK/0']=55000000; $rates['K/1']=64000000;
$pdo->beginTransaction(); payroll_save_ptkp_rates($pdo,'A',$rates); $pdo->commit();
check_ptkp(payroll_ptkp_rates($pdo,'A')['TK/0'],55000000.0,'konfigurasi tersimpan');
check_ptkp((float)$pdo->query("SELECT ptkp FROM Pegawai WHERE id='p1'")->fetchColumn(),55000000.0,'master pegawai sesuai status TK/0');
check_ptkp((float)$pdo->query("SELECT ptkp FROM Pegawai WHERE id='p2'")->fetchColumn(),64000000.0,'master pegawai sesuai status K/1');
check_ptkp((float)$pdo->query("SELECT ptkp FROM Pegawai WHERE id='p3'")->fetchColumn(),54000000.0,'entitas lain tidak berubah');
check_ptkp(payroll_ptkp_rates($pdo,'B')['TK/0'],54000000.0,'default pegawai baru entitas lain');
reject_ptkp(fn()=>payroll_validate_ptkp_rates([]),'seluruh status wajib diisi');
reject_ptkp(fn()=>payroll_validate_ptkp_rates(array_merge($rates,['TK/0'=>-1])),'negatif ditolak');
reject_ptkp(fn()=>payroll_validate_ptkp_rates(array_merge($rates,['K/0'=>'salah'])),'bukan angka ditolak');
reject_ptkp(fn()=>payroll_validate_ptkp_rates(array_merge($rates,['K/0'=>INF])),'angka tak terhingga ditolak');
check_ptkp(payroll_validate_ptkp_rates(array_merge($rates,['K/0'=>0]))['K/0'],0.0,'nol eksplisit diterima');
$pdo->exec("CREATE TRIGGER fail_ptkp BEFORE UPDATE ON Pegawai WHEN NEW.id='p2' BEGIN SELECT RAISE(ABORT,'fixture'); END;");
$pdo->beginTransaction();
try { payroll_save_ptkp_rates($pdo,'A',array_merge($rates,['TK/0'=>60000000])); throw new RuntimeException('Fixture harus gagal'); }
catch (PDOException $expected) { $pdo->rollBack(); }
check_ptkp(payroll_ptkp_rates($pdo,'A')['TK/0'],55000000.0,'konfigurasi rollback saat master gagal');
check_ptkp((float)$pdo->query("SELECT ptkp FROM Pegawai WHERE id='p1'")->fetchColumn(),55000000.0,'master rollback bersama konfigurasi');
$pdo->exec('DROP TRIGGER fail_ptkp');
class PtkpResponse extends RuntimeException { public function __construct(public int $status) { parent::__construct('Response'); } }
$actor=['id'=>'staff','role'=>'STAF_KEUANGAN'];
function require_auth(): array { global $actor; return $actor; }
function get_pdo(): PDO { global $pdo; return $pdo; }
function error_response(string $message,int $status=400): void { throw new PtkpResponse($status); }
function json_response(array $data): void { throw new PtkpResponse(200); }
function log_activity(...$args): void {}
function post_ptkp(array $body): int { try { require __DIR__.'/../api/routes/payroll-ptkp.php'; } catch (PtkpResponse $r) { return $r->status; } throw new RuntimeException('Response wajib ada'); }
check_ptkp(post_ptkp(['entityId'=>'A','rates'=>$rates]),200,'staf dapat mengatur entitas yang diizinkan');
check_ptkp(post_ptkp(['entityId'=>'B','rates'=>$rates]),403,'akses entitas lain ditolak');
$actor=['id'=>'read-only','role'=>'VIEWER'];
check_ptkp(post_ptkp(['entityId'=>'A','rates'=>$rates]),403,'pengguna read only ditolak');
echo "$checks pemeriksaan pengaturan PTKP lulus.\n";
