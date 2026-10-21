<?php
// php tests/tenaga-ahli-gaji.php — hanya SQLite in-memory, tanpa database aplikasi/data pribadi.
define('APP_ENTRY', true);
require __DIR__ . '/../api/helpers/tenaga-ahli-gaji.php';

$checks = 0;
function check($actual, $expected, string $label): void {
    global $checks;
    if ($actual !== $expected) throw new RuntimeException($label . ': ' . var_export($actual, true));
    $checks++;
}
function rejects(callable $callback, string $label): void {
    try { $callback(); } catch (InvalidArgumentException $e) { check(true, true, $label); return; }
    throw new RuntimeException('Seharusnya ditolak: ' . $label);
}
check(tenaga_ahli_valid_date('2028-02-29'), '2028-02-29', 'tahun kabisat');
rejects(fn() => tenaga_ahli_valid_date('2026-02-29'), 'tanggal tidak nyata');
rejects(fn() => tenaga_ahli_valid_date('21/10/2026'), 'format tanggal');
check(tenaga_ahli_nominal(null), null, 'belum diisi tetap null');
check(tenaga_ahli_nominal(0), 0.0, 'nol eksplisit tetap nol');
rejects(fn() => tenaga_ahli_nominal(-1), 'negatif');
rejects(fn() => tenaga_ahli_nominal('lima juta'), 'nominal salah');
rejects(fn() => tenaga_ahli_nominal(INF), 'nominal tak terbatas');
rejects(fn() => tenaga_ahli_nominal(1000000000000), 'batas nominal');
$rows = tenaga_ahli_validate_jadwal([
    ['bulan' => '2027-01', 'nominal' => null, 'catatan' => ''],
    ['bulan' => '2026-12', 'nominal' => 5000000, 'catatan' => '  Pembayaran menunggu dokumen  '],
]);
check(array_column($rows, 'bulan'), ['2026-12', '2027-01'], 'urut lintas tahun');
check($rows[0]['catatan'], 'Pembayaran menunggu dokumen', 'catatan tersimpan');
check($rows[1]['nominal'], null, 'bulan awal kosong');
check(tenaga_ahli_validate_jadwal([['bulan' => '2026-10', 'nominal' => 0]])[0]['nominal'], 0.0, 'nol bulanan');
rejects(fn() => tenaga_ahli_validate_jadwal([['bulan' => '2026-10'], ['bulan' => '2026-10']]), 'duplikasi bulan');
rejects(fn() => tenaga_ahli_validate_jadwal([['bulan' => '2026-13']]), 'bulan tidak valid');
rejects(fn() => tenaga_ahli_validate_jadwal([['bulan' => '2026-10', 'catatan' => str_repeat('a', 4001)]]), 'catatan terlalu panjang');
rejects(fn() => tenaga_ahli_validate_jadwal([['bulan' => '2026-10', 'nominal' => -100]]), 'gaji negatif');
rejects(fn() => tenaga_ahli_validate_jadwal('[]'), 'payload bukan array');
$stored = tenaga_ahli_gaji_format(['revision' => '4', 'manMonth' => '3.00', 'gajiRab' => '7500000.00', 'gajiNegosiasi' => null, 'jadwalJson' => json_encode($rows)]);
check($stored['revision'], 4, 'revision integer');
check($stored['gajiRab'], 7500000.0, 'decimal menjadi angka');
check($stored['gajiNegosiasi'], null, 'negosiasi belum disimpan');
check(json_encode($stored['jadwal']), json_encode($rows), 'jadwal dan catatan tidak berubah saat decode');

// Regresi skema sebelum integrasi Sidamon: jalankan query route sesungguhnya
// pada Project yang tidak mempunyai kolom sidamon_start_date/sidamon_end_date.
$db = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
$db->exec("CREATE TABLE Project (id TEXT, code TEXT, name TEXT, entityId TEXT);
    CREATE TABLE Entity (id TEXT, name TEXT);
    CREATE TABLE Rekanan (id TEXT, nama TEXT, entityId TEXT, tipe TEXT, projectId TEXT);
    CREATE TABLE TenagaAhliProject (id TEXT, rekananId TEXT, projectId TEXT,
        tanggalMulaiTugas TEXT, tanggalSelesaiTugas TEXT, createdAt TEXT);
    INSERT INTO Project VALUES ('project-test', 'TEST', 'Proyek Uji', 'entity-test');
    INSERT INTO Entity VALUES ('entity-test', 'Entitas Uji');
    INSERT INTO Rekanan VALUES ('person-test', 'Tenaga Ahli Uji', 'entity-test', 'TENAGA_AHLI', 'project-test');
    INSERT INTO TenagaAhliProject VALUES ('tap-test', 'person-test', 'project-test', '2026-10-01', '2026-12-31', '2026-10-01');");
$route = file_get_contents(__DIR__ . '/../api/routes/payroll.php');
if (!preg_match('/"(SELECT tap\.\*.*?)"/s', $route, $match)) throw new RuntimeException('Query daftar penugasan tidak ditemukan.');
$query = $db->prepare(str_replace('$placeholders', '?', $match[1]));
$query->execute(['person-test']);
$assignment = $query->fetch(PDO::FETCH_ASSOC);
check($assignment['projectName'], 'Proyek Uji', 'daftar payroll tanpa kolom Sidamon');
check($assignment['tanggalMulaiTugas'], '2026-10-01', 'tanggal penugasan manual tersedia');
$route = file_get_contents(__DIR__ . '/../api/routes/payroll-gaji-kontrak.php');
if (!preg_match('/"(SELECT r\.nama.*?)"/s', $route, $match)) throw new RuntimeException('Query validasi penugasan tidak ditemukan.');
$query = $db->prepare($match[1]);
$query->execute(['project-test', 'person-test']);
check($query->fetch(PDO::FETCH_ASSOC)['projectEntityId'], 'entity-test', 'validasi penyimpanan negosiasi tanpa kolom Sidamon');
$query->execute(['project-lain', 'person-test']);
check($query->fetch(PDO::FETCH_ASSOC), false, 'proyek tanpa penugasan tidak diterima');
echo "$checks pemeriksaan validasi PHP lulus.\n";
