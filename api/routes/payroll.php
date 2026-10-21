<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');
require_once __DIR__ . '/../helpers/tenaga-ahli-gaji.php';

// ─── Router ───────────────────────────────────────────────────────────────────
// $segments[0] = 'payroll'
// $segments[1] = '' | 'pegawai' | 'gaji' | 'honor' | 'copy-gaji' | 'tenaga-ahli'
// $segments[2] = {id}  (for PUT/DELETE sub-resources)

$sub  = $segments[1] ?? '';
$sub2 = $segments[2] ?? '';

// ── Format helper ─────────────────────────────────────────────────────────────
function fmt_rp_payroll(float $val): string {
    return 'Rp ' . number_format((int)$val, 0, ',', '.');
}

function fmt_tanggal_id(string $iso): string {
    // Format: "1 Jan 2025"
    $ts = strtotime($iso);
    if (!$ts) return $iso;
    $months = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
    $d = (int)date('j', $ts);
    $m = (int)date('n', $ts) - 1;
    $y = date('Y', $ts);
    return "$d {$months[$m]} $y";
}

function hitung_masa_kerja_id(?string $tgl_masuk): ?string {
    if (!$tgl_masuk) return null;
    $ts = strtotime($tgl_masuk);
    if (!$ts) return null;
    $now = time();
    $y1 = (int)date('Y', $ts);
    $m1 = (int)date('n', $ts);
    $d1 = (int)date('j', $ts);
    $y2 = (int)date('Y', $now);
    $m2 = (int)date('n', $now);
    $d2 = (int)date('j', $now);

    $thn = $y2 - $y1;
    $bln = $m2 - $m1;
    if ($d2 < $d1) $bln--;
    if ($bln < 0) { $thn--; $bln += 12; }
    if ($thn < 0) return "0 bulan";
    if ($thn === 0 && $bln === 0) return "< 1 bulan";
    if ($thn === 0) return "{$bln} bulan";
    if ($bln === 0) return "{$thn} tahun";
    return "{$thn} tahun {$bln} bulan";
}

function parse_rupiah_num($val, float $fallback = 0.0): float {
    if ($val === null || $val === '') return $fallback;
    if (is_int($val) || is_float($val)) return (float)$val;
    $str = trim((string)$val);
    if ($str === '') return $fallback;
    $clean = preg_replace('/[^0-9,-]/', '', $str);
    $clean = str_replace(',', '.', $clean);
    return is_numeric($clean) ? (float)$clean : $fallback;
}


/**
 * Menentukan apakah pegawai berhak muncul di daftar penggajian bulan & tahun tertentu.
 * Aturan:
 * 1. Jika sudah ada data gaji di bulan ini (historis/arsip yang sudah diinput), SELALU TAMPILKAN
 *    agar rekam jejak gaji dan pelaporan pajak masa lalu tidak hilang.
 * 2. Karyawan yang berstatus RESIGN atau PENSIUN langsung dihilangkan dari daftar penggajian bulanan
 *    jika belum ada data gaji di bulan tersebut.
 * 3. Karyawan aktif otomatis muncul setiap bulan (sejak tanggal masuk).
 */
function is_pegawai_eligible_for_month(array $p, int $year, int $month, bool $has_gaji_this_month): bool {
    // 1. Jika sudah ada data gaji di bulan ini (historis/arsip), SELALU TAMPILKAN
    if ($has_gaji_this_month) return true;

    $status = !empty($p['status']) ? strtoupper(trim($p['status'])) : (!empty($p['isActive']) ? 'AKTIF' : 'RESIGN');

    // 2. Karyawan resign / pensiun / tidak aktif langsung tidak muncul di daftar gaji bulanan jika belum digaji
    if ($status === 'RESIGN' || $status === 'PENSIUN' || empty($p['isActive'])) {
        return false;
    }

    // 3. Cek tanggal masuk (sebelum mulai kerja belum berhak muncul tanpa data gaji)
    if (!empty($p['tanggalMasuk'])) {
        $masuk_ts = strtotime($p['tanggalMasuk']);
        if ($masuk_ts) {
            $masuk_y = (int)date('Y', $masuk_ts);
            $masuk_m = (int)date('n', $masuk_ts);
            if ($year < $masuk_y || ($year === $masuk_y && $month < $masuk_m)) {
                return false;
            }
        }
    }

    return true;
}

/**
 * Pastikan tabel TenagaAhliProject sudah terbuat untuk relasi penugasan multi-proyek
 */
function ensure_tenaga_ahli_tables(PDO $pdo): void {
    static $done = false;
    if ($done) return;
    $pdo->exec(
        "CREATE TABLE IF NOT EXISTS `TenagaAhliProject` (
          `id` VARCHAR(36) NOT NULL PRIMARY KEY,
          `rekananId` VARCHAR(36) NOT NULL,
          `projectId` VARCHAR(36) NOT NULL,
          `tanggalMulaiTugas` DATE NULL,
          `tanggalSelesaiTugas` DATE NULL,
          `isTurunLapangan` TINYINT(1) NOT NULL DEFAULT 1,
          `nominalHonorBulanan` DECIMAL(18,2) NOT NULL DEFAULT 0.00,
          `createdAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          `updatedAt` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX `idx_tap_rekanan` (`rekananId`),
          INDEX `idx_tap_project` (`projectId`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
    $done = true;
}

/**
 * Cari apakah seseorang terdaftar sebagai Pegawai Tetap di salah satu entitas holding.
 */
function get_pegawai_tetap_info(array $person, array $pegawai_by_nik, array $pegawai_by_name): ?array {
    $nik = trim($person['nik'] ?? '');
    if ($nik !== '' && isset($pegawai_by_nik[$nik])) {
        return $pegawai_by_nik[$nik];
    }
    $name = strtolower(trim($person['nama'] ?? ''));
    if ($name !== '' && isset($pegawai_by_name[$name])) {
        return $pegawai_by_name[$name];
    }
    $name_stripped = preg_replace('/^(ir\.|dr\.|drs\.|drg\.|prof\.)\s+/i', '', $name);
    $name_stripped = trim(preg_replace('/,.*$/', '', $name_stripped));
    if ($name_stripped !== '' && isset($pegawai_by_name[$name_stripped])) {
        return $pegawai_by_name[$name_stripped];
    }
    return null;
}

/**
 * Menentukan apakah Tenaga Ahli / Freelance berhak muncul di daftar penggajian bulanan riil.
 * Aturan:
 * 1. Jika sudah ada data transaksi honor di bulan ini (arsip historis), SELALU TAMPILKAN
 *    agar rekam jejak honor masa lalu tidak hilang.
 * 2. Jika tenaga ahli ini adalah Pegawai Tetap di entitas lain (misal pegawai tetap Kencana
 *    yang ditugaskan sebagai tenaga ahli di Gaharu atau entitas lain), HANYA muncul
 *    di bulan ketika mereka digaji/dibayarkan honor. Tidak muncul setiap bulan sebagai pending.
 * 3. Status "Turun Lapangan": Khusus freelance / tenaga ahli, hanya yang berstatus
 *    "turun ke lapangan" yang dimunculkan pada daftar pembayaran gaji riil bulanan.
 *    Tenaga ahli yang berstatus kelengkapan administrasi/sertifikasi (SKA) TIDAK dimunculkan.
 * 4. Masa Tugas / Masa Kontrak: Selama dalam rentang tanggal penugasan (mulai s.d. selesai),
 *    nama freelance otomatis muncul di daftar penggajian bulanan dan hilang setelah masa tugas berakhir.
 */
function is_tenaga_ahli_eligible_for_month(array $ta, int $year, int $month, bool $has_honor_this_month, bool $is_pegawai_tetap_lain = false): bool {
    // 1. Jika sudah ada pembayaran honor di bulan ini, selalu tampilkan
    if ($has_honor_this_month) return true;

    // 2. Jika tenaga ahli ini adalah Pegawai Tetap di entitas lain, HANYA muncul ketika digaji di bulan tersebut.
    //    Tidak dimunculkan sebagai baris tagihan rutin / pending bulanan.
    if ($is_pegawai_tetap_lain) {
        return false;
    }

    // 3. Status "Turun Lapangan": hanya yang bernilai true (1) yang muncul di daftar gaji riil
    $is_turun = isset($ta['isTurunLapangan']) ? ((int)$ta['isTurunLapangan'] === 1 || $ta['isTurunLapangan'] === true) : true;
    if (!$is_turun) {
        return false;
    }

    if (isset($ta['gajiKontrak']['jadwal'])) {
        $period = sprintf('%04d-%02d', $year, $month);
        foreach ($ta['gajiKontrak']['jadwal'] as $row) {
            if ($row['bulan'] === $period && $row['nominal'] !== null) return true;
        }
        return false;
    }
    $period = sprintf('%04d-%02d', $year, $month);
    if (!empty($ta['tanggalMulaiTugas']) && $period < substr($ta['tanggalMulaiTugas'], 0, 7)) return false;
    if (!empty($ta['tanggalSelesaiTugas']) && $period > substr($ta['tanggalSelesaiTugas'], 0, 7)) return false;

    // Tenaga ahli yang berstatus turun lapangan selalu dimunculkan di daftar gaji bulanan
    // entitas proyeknya (walau belum dibayar), agar dapat diproses pembayarannya oleh bagian keuangan.
    return true;
}

/**
 * Kalkulasi PPh 21 bulanan berdasarkan Tarif Efektif Rata-rata (TER) PP 58/2023 & PMK 168/2023.
 */
function hitung_pph21_ter(float $bruto, string $status_keluarga = 'TK/0'): array {
    $norm = strtoupper(trim($status_keluarga));
    $kategori = 'A';
    if (in_array($norm, ['TK/0', 'TK/1', 'K/0'], true)) {
        $kategori = 'A';
    } elseif (in_array($norm, ['TK/2', 'TK/3', 'K/1', 'K/2'], true)) {
        $kategori = 'B';
    } elseif ($norm === 'K/3') {
        $kategori = 'C';
    }

    $safe_bruto = max(0.0, round($bruto));
    $tarif = 0.0;

    if ($kategori === 'A') {
        $brackets = [
            [5400000, 0], [5650000, 0.25], [5950000, 0.5], [6300000, 0.75], [6750000, 1.0],
            [7500000, 1.25], [8550000, 1.5], [9650000, 1.75], [10050000, 2.0], [10350000, 2.25],
            [10700000, 2.5], [11050000, 3.0], [11600000, 3.5], [12500000, 4.0], [13750000, 5.0],
            [15100000, 6.0], [16950000, 7.0], [19750000, 8.0], [24150000, 9.0], [26450000, 10.0],
            [28000000, 11.0], [30050000, 12.0], [32400000, 13.0], [35400000, 14.0], [39100000, 15.0],
            [43850000, 16.0], [47800000, 17.0], [51400000, 18.0], [56300000, 19.0], [62200000, 20.0],
            [68600000, 21.0], [77500000, 22.0], [89000000, 23.0], [103000000, 24.0], [125000000, 25.0],
            [157000000, 26.0], [206000000, 27.0], [337000000, 28.0], [454000000, 29.0], [550000000, 30.0],
            [695000000, 31.0], [910000000, 32.0], [1400000000, 33.0], [INF, 34.0],
        ];
    } elseif ($kategori === 'B') {
        $brackets = [
            [6200000, 0], [6500000, 0.25], [6850000, 0.5], [7300000, 0.75], [9200000, 1.0],
            [10750000, 1.5], [11250000, 2.0], [11600000, 2.5], [12600000, 3.0], [13600000, 4.0],
            [14950000, 5.0], [16400000, 6.0], [18450000, 7.0], [21850000, 8.0], [26000000, 9.0],
            [27700000, 10.0], [29350000, 11.0], [31450000, 12.0], [33950000, 13.0], [37100000, 14.0],
            [41100000, 15.0], [45800000, 16.0], [49500000, 17.0], [53800000, 18.0], [58500000, 19.0],
            [64000000, 20.0], [71000000, 21.0], [80000000, 22.0], [93000000, 23.0], [109000000, 24.0],
            [129000000, 25.0], [163000000, 26.0], [211000000, 27.0], [374000000, 28.0], [459000000, 29.0],
            [555000000, 30.0], [704000000, 31.0], [957000000, 32.0], [1405000000, 33.0], [INF, 34.0],
        ];
    } else {
        $brackets = [
            [6600000, 0], [6950000, 0.25], [7350000, 0.5], [7800000, 0.75], [8850000, 1.0],
            [9800000, 1.25], [10950000, 1.5], [11200000, 1.75], [12050000, 2.0], [12950000, 3.0],
            [14150000, 4.0], [15550000, 5.0], [17050000, 6.0], [19500000, 7.0], [22700000, 8.0],
            [26600000, 9.0], [28100000, 10.0], [30100000, 11.0], [32600000, 12.0], [35400000, 13.0],
            [38900000, 14.0], [43000000, 15.0], [47400000, 16.0], [51200000, 17.0], [55800000, 18.0],
            [60800000, 19.0], [66700000, 20.0], [74500000, 21.0], [83200000, 22.0], [95600000, 23.0],
            [110000000, 24.0], [134000000, 25.0], [169500000, 26.0], [221000000, 27.0], [390000000, 28.0],
            [463000000, 29.0], [561000000, 30.0], [709000000, 31.0], [965000000, 32.0], [1419000000, 33.0],
            [INF, 34.0],
        ];
    }

    foreach ($brackets as [$limit, $rate]) {
        if ($safe_bruto <= $limit) {
            $tarif = (float)$rate;
            break;
        }
    }

    $nominal = round(($safe_bruto * $tarif) / 100);

    return [
        'kategori'    => $kategori,
        'tarifPersen' => $tarif,
        'nominal'     => $nominal,
    ];
}

// ─── GET /api/payroll?entityId=...&year=...&month=... ─────────────────────────
// Logika: 1:1 dengan getPayrollData() di src/lib/payroll.ts
if ($method === 'GET' && $sub === '') {
    require_auth();
    $pdo       = get_pdo();
    $entity_id = trim($_GET['entityId'] ?? '');
    $year      = isset($_GET['year'])  ? (int)$_GET['year']  : (int)date('Y');
    $month     = isset($_GET['month']) ? (int)$_GET['month'] : (int)date('n');

    if (!$entity_id) return error_response('entityId wajib diisi.', 400);

    // 1. Entity info
    $stmt = $pdo->prepare("SELECT id, `key`, name FROM Entity WHERE id = ?");
    $stmt->execute([$entity_id]);
    $entity = $stmt->fetch(PDO::FETCH_ASSOC) ?: null;

    // 2. All entities
    $stmt = $pdo->prepare("SELECT id, `key`, name FROM Entity ORDER BY name ASC");
    $stmt->execute();
    $all_entities = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 3. Projects for entity & all projects across holding
    $stmt = $pdo->prepare("SELECT id, code, name FROM Project WHERE entityId = ? ORDER BY code ASC");
    $stmt->execute([$entity_id]);
    $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $stmt = $pdo->prepare(
        "SELECT p.id, p.code, p.name, p.entityId, COALESCE(e.name, 'Holding / Lainnya') AS entityName
         FROM Project p
         LEFT JOIN Entity e ON p.entityId = e.id
         ORDER BY e.name ASC, p.code ASC"
    );
    $stmt->execute();
    $all_projects = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 3b. Master seluruh pegawai tetap lintas entitas (holding)
    $stmt_all_pgw = $pdo->prepare(
        "SELECT p.id, p.entityId, p.nik, p.nama, p.jabatan, p.statusKeluarga, p.ptkp,
                e.name AS entityName, e.`key` AS entityKey
         FROM Pegawai p
         JOIN Entity e ON p.entityId = e.id
         WHERE p.isActive = 1
         ORDER BY e.name ASC, p.nama ASC"
    );
    $stmt_all_pgw->execute();
    $all_holding_pegawai = $stmt_all_pgw->fetchAll(PDO::FETCH_ASSOC);

    $pegawai_by_nik  = [];
    $pegawai_by_name = [];
    foreach ($all_holding_pegawai as $pgw) {
        $nik_clean = trim($pgw['nik'] ?? '');
        if ($nik_clean !== '') {
            $pegawai_by_nik[$nik_clean] = $pgw;
        }
        $name_clean = strtolower(trim($pgw['nama'] ?? ''));
        if ($name_clean !== '') {
            $pegawai_by_name[$name_clean] = $pgw;
            $name_stripped = preg_replace('/^(ir\.|dr\.|drs\.|drg\.|prof\.)\s+/i', '', $name_clean);
            $name_stripped = trim(preg_replace('/,.*$/', '', $name_stripped));
            if ($name_stripped !== '' && $name_stripped !== $name_clean) {
                $pegawai_by_name[$name_stripped] = $pgw;
            }
        }
    }

    // 4. Tenaga Ahli master (rekanan tipe TENAGA_AHLI)
    ensure_tenaga_ahli_tables($pdo);
    ensure_tenaga_ahli_gaji_table($pdo);
    $gaji_kontrak_map = [];
    foreach ($pdo->query('SELECT * FROM TenagaAhliGajiKontrak')->fetchAll(PDO::FETCH_ASSOC) as $kontrak) {
        $gaji_kontrak_map[$kontrak['rekananId']][$kontrak['projectId']] = tenaga_ahli_gaji_format($kontrak);
    }
    $stmt = $pdo->prepare(
        "SELECT r.id, r.nama, r.nik, r.npwp, r.kategori, r.ptkp, r.entityId,
                r.tanggalMulaiTugas, r.tanggalSelesaiTugas, r.projectId,
                r.isTurunLapangan, r.nominalHonorBulanan,
                p.code AS projectCode, p.name AS projectName, p.entityId AS projectEntityId,
                COALESCE(pe.name, re.name, 'Holding / Lainnya') AS projectEntityName,
                re.name AS entityName
         FROM Rekanan r
         LEFT JOIN Entity re ON r.entityId = re.id
         LEFT JOIN Project p ON r.projectId = p.id
         LEFT JOIN Entity pe ON p.entityId = pe.id
         WHERE r.tipe = 'TENAGA_AHLI'
         ORDER BY r.nama ASC"
    );
    $stmt->execute();
    $rekanan_tenaga_ahli_raw = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Ambil seluruh penugasan multi-proyek dari TenagaAhliProject
    $tap_map = [];
    if (!empty($rekanan_tenaga_ahli_raw)) {
        $rekanan_ids = array_column($rekanan_tenaga_ahli_raw, 'id');
        $placeholders = implode(',', array_fill(0, count($rekanan_ids), '?'));
        $stmt_tap = $pdo->prepare(
            "SELECT tap.*, p.code AS projectCode, p.name AS projectName, p.entityId AS projectEntityId,
                    COALESCE(e.name, 'Holding / Lainnya') AS projectEntityName
             FROM TenagaAhliProject tap
             JOIN Project p ON tap.projectId = p.id
             LEFT JOIN Entity e ON p.entityId = e.id
             WHERE tap.rekananId IN ($placeholders)
             ORDER BY tap.createdAt ASC"
        );
        $stmt_tap->execute($rekanan_ids);
        foreach ($stmt_tap->fetchAll(PDO::FETCH_ASSOC) as $tap_row) {
            $tap_row['isTurunLapangan'] = ((int)($tap_row['isTurunLapangan'] ?? 1) === 1);
            $tap_row['nominalHonorBulanan'] = (float)($tap_row['nominalHonorBulanan'] ?? 0);
            $tap_row['nominalHonorBulananFmt'] = fmt_rp_payroll($tap_row['nominalHonorBulanan']);
            $tap_row['tanggalMulaiTugasFmt'] = !empty($tap_row['tanggalMulaiTugas']) ? fmt_tanggal_id($tap_row['tanggalMulaiTugas']) : null;
            $tap_row['tanggalSelesaiTugasFmt'] = !empty($tap_row['tanggalSelesaiTugas']) ? fmt_tanggal_id($tap_row['tanggalSelesaiTugas']) : null;
            $tap_map[$tap_row['rekananId']][] = $tap_row;
        }
    }

    $rekanan_tenaga_ahli = [];
    foreach ($rekanan_tenaga_ahli_raw as $r) {
        $r['isTurunLapangan']       = isset($r['isTurunLapangan']) ? ((int)$r['isTurunLapangan'] === 1) : true;
        $r['nominalHonorBulanan']    = (float)($r['nominalHonorBulanan'] ?? 0.0);
        $r['nominalHonorBulananFmt'] = fmt_rp_payroll($r['nominalHonorBulanan']);
        $r['tanggalMulaiTugasFmt']   = !empty($r['tanggalMulaiTugas']) ? fmt_tanggal_id($r['tanggalMulaiTugas']) : null;
        $r['tanggalSelesaiTugasFmt'] = !empty($r['tanggalSelesaiTugas']) ? fmt_tanggal_id($r['tanggalSelesaiTugas']) : null;

        // Ambil dari TenagaAhliProject jika ada, jika tidak ada fallback ke kolom di Rekanan
        if (!empty($tap_map[$r['id']])) {
            $r['proyekList'] = $tap_map[$r['id']];
        } elseif (!empty($r['projectId'])) {
            $r['proyekList'] = [[
                'id'                    => null,
                'projectId'             => $r['projectId'],
                'projectCode'           => $r['projectCode'] ?? null,
                'projectName'           => $r['projectName'] ?? null,
                'projectEntityId'       => $r['projectEntityId'] ?? $r['entityId'],
                'projectEntityName'     => $r['projectEntityName'] ?? ($r['entityName'] ?? 'Holding / Lainnya'),
                'tanggalMulaiTugas'     => $r['tanggalMulaiTugas'] ?? null,
                'tanggalSelesaiTugas'   => $r['tanggalSelesaiTugas'] ?? null,
                'tanggalMulaiTugasFmt'  => $r['tanggalMulaiTugasFmt'] ?? null,
                'tanggalSelesaiTugasFmt'=> $r['tanggalSelesaiTugasFmt'] ?? null,
                'isTurunLapangan'       => $r['isTurunLapangan'],
                'nominalHonorBulanan'   => $r['nominalHonorBulanan'],
                'nominalHonorBulananFmt'=> $r['nominalHonorBulananFmt'],
            ]];
        } else {
            $r['proyekList'] = [];
        }

        foreach ($r['proyekList'] as &$pl_gaji) {
            $pl_gaji['gajiKontrak'] = $gaji_kontrak_map[$r['id']][$pl_gaji['projectId']] ?? null;
        }
        unset($pl_gaji);

        // Cek status apakah personil ini adalah Pegawai Tetap di entitas tertentu
        $pgw_info = get_pegawai_tetap_info($r, $pegawai_by_nik, $pegawai_by_name);
        $r['isPegawaiTetap']        = ($pgw_info !== null);
        $r['pegawaiHomeEntityId']   = $pgw_info ? $pgw_info['entityId'] : null;
        $r['pegawaiHomeEntityName'] = $pgw_info ? $pgw_info['entityName'] : null;
        $r['pegawaiHomeEntityKey']  = $pgw_info ? $pgw_info['entityKey'] : null;

        $rekanan_tenaga_ahli[] = $r;
    }

    // 5. Master Pegawai untuk entitas (query mandiri tanpa tertimpa kolom gaji bulanan)
    $stmt = $pdo->prepare(
        "SELECT * FROM Pegawai WHERE entityId = ? ORDER BY isActive DESC, nama ASC"
    );
    $stmt->execute([$entity_id]);
    $pegawai_map = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 6. Seluruh data gaji bulanan pegawai tahun terpilih
    $stmt = $pdo->prepare(
        "SELECT * FROM GajiPegawaiBulanan WHERE entityId = ? AND tahun = ?"
    );
    $stmt->execute([$entity_id, $year]);
    $gaji_rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $pegawai_gaji_map = []; // pegawaiId => [bulan => gaji_row]
    foreach ($gaji_rows as $grow) {
        $pegawai_gaji_map[$grow['pegawaiId']][(int)$grow['bulan']] = $grow;
    }

    $pegawai_list       = [];
    $all_pegawai_master = [];
    $gaji_bulan_ini     = [];
    $summary_bulan_ini  = [
        'totalPegawaiAktif'         => 0,
        'totalPegawaiInput'         => 0,
        'totalGajiPokok'            => 0.0,
        'totalTunjanganJabatan'     => 0.0,
        'totalTunjanganTransport'   => 0.0,
        'totalInsentif'             => 0.0,
        'totalThr'                  => 0.0,
        'totalTunjanganBpjs'        => 0.0,
        'totalTunjanganPph'         => 0.0,
        'totalBpjsKesehatan'        => 0.0,
        'totalBpjsKetenagakerjaan'  => 0.0,
        'totalPotonganBpjs'         => 0.0,
        'totalPotonganLain'         => 0.0,
        'totalPph21'                => 0.0,
        'totalGajiKotor'            => 0.0,
        'totalGajiTerlaporPajak'    => 0.0,
        'totalGajiBersih'           => 0.0,
    ];

    foreach ($pegawai_map as $p) {
        $pid            = $p['id'];
        $gaji_months    = $pegawai_gaji_map[$pid] ?? [];
        $ptkp_num       = (float)$p['ptkp'];
        $gaji_pokok_num = (float)$p['gajiPokok'];
        $status_val     = !empty($p['status']) ? strtoupper(trim($p['status'])) : (!empty($p['isActive']) ? 'AKTIF' : 'RESIGN');
        $is_active      = ($status_val === 'AKTIF');
        $tgl_resign     = !empty($p['tanggalResign']) ? substr($p['tanggalResign'], 0, 10) : null;
        $tgl_masuk      = !empty($p['tanggalMasuk']) ? substr($p['tanggalMasuk'], 0, 10) : null;
        $masa_kerja     = hitung_masa_kerja_id($tgl_masuk);

        // Current month gaji
        $current_gaji = null;
        if (isset($gaji_months[$month])) {
            $g = $gaji_months[$month];
            $gp    = (float)($g['gajiPokok'] ?? 0);
            $tj    = (float)($g['tunjanganJabatan'] ?? 0);
            $tt    = (float)($g['tunjanganTransport'] ?? 0);
            $ins   = (float)($g['insentif'] ?? 0);
            $bkes  = (float)($g['bpjsKesehatan'] ?? 0);
            $btk   = (float)($g['bpjsKetenagakerjaan'] ?? 0);
            $pot   = (float)($g['potonganLain'] ?? 0);
            $pph   = (float)($g['pph21'] ?? 0);
            $kotor = (float)($g['totalGajiKotor'] ?? 0);
            $brsih = (float)($g['totalGajiBersih'] ?? 0);
            $hk    = (int)($g['hariKerja'] ?? 0);
            $tarif = (float)($g['tarifTransportHarian'] ?? 15000);
            $thr   = (float)($g['thr'] ?? 0);
            $tbkes = (float)($g['tunjanganBpjsKes'] ?? 0);
            $tbtk  = (float)($g['tunjanganBpjsTk'] ?? 0);
            $tb    = (float)($g['tunjanganBpjs'] ?? ($tbkes + $tbtk));
            $tpph  = (float)($g['tunjanganPph'] ?? 0);
            $tlain = (float)($g['tunjanganLainnya'] ?? $ins);
            $pb    = (float)($g['potonganBpjs'] ?? ($bkes + $btk));
            $gtp   = (float)($g['totalGajiTerlaporPajak'] ?? $kotor);

            $current_gaji = [
                'id'                       => $g['id'],
                'pegawaiId'                => $pid,
                'pegawaiNama'              => $p['nama'],
                'pegawaiNik'               => $p['nik'],
                'pegawaiJabatan'           => $p['jabatan'],
                'pegawaiTanggalMasuk'      => $tgl_masuk,
                'pegawaiMasaKerja'         => $masa_kerja,
                'bulan'                    => (int)$g['bulan'],
                'tahun'                    => (int)$g['tahun'],
                'gajiPokok'                => $gp,
                'gajiPokokFmt'             => fmt_rp_payroll($gp),
                'tunjanganJabatan'         => $tj,
                'tunjanganJabatanFmt'      => fmt_rp_payroll($tj),
                'hariKerja'                => $hk,
                'tarifTransportHarian'     => $tarif,
                'tarifTransportHarianFmt'  => fmt_rp_payroll($tarif),
                'tunjanganTransport'       => $tt,
                'tunjanganTransportFmt'    => fmt_rp_payroll($tt),
                'insentif'                 => $ins,
                'insentifFmt'              => fmt_rp_payroll($ins),
                'tunjanganLainnya'         => $tlain,
                'tunjanganLainnyaFmt'      => fmt_rp_payroll($tlain),
                'thr'                      => $thr,
                'thrFmt'                   => fmt_rp_payroll($thr),
                'tunjanganBpjs'            => $tb,
                'tunjanganBpjsFmt'         => fmt_rp_payroll($tb),
                'tunjanganBpjsKes'         => $tbkes,
                'tunjanganBpjsKesFmt'      => fmt_rp_payroll($tbkes),
                'tunjanganBpjsTk'          => $tbtk,
                'tunjanganBpjsTkFmt'       => fmt_rp_payroll($tbtk),
                'tunjanganPph'             => $tpph,
                'tunjanganPphFmt'          => fmt_rp_payroll($tpph),
                'bpjsKesehatan'            => $bkes,
                'bpjsKesehatanFmt'         => fmt_rp_payroll($bkes),
                'bpjsKetenagakerjaan'      => $btk,
                'bpjsKetenagakerjaanFmt'   => fmt_rp_payroll($btk),
                'potonganBpjs'             => $pb,
                'potonganBpjsFmt'          => fmt_rp_payroll($pb),
                'potonganLain'             => $pot,
                'potonganLainFmt'          => fmt_rp_payroll($pot),
                'pph21'                    => $pph,
                'pph21Fmt'                 => fmt_rp_payroll($pph),
                'totalGajiKotor'           => $kotor,
                'totalGajiKotorFmt'        => fmt_rp_payroll($kotor),
                'totalGajiTerlaporPajak'   => $gtp,
                'totalGajiTerlaporPajakFmt'=> fmt_rp_payroll($gtp),
                'totalGajiBersih'          => $brsih,
                'totalGajiBersihFmt'       => fmt_rp_payroll($brsih),
                'catatan'                  => $g['catatan'] ?? '',
            ];

            $gaji_bulan_ini[] = $current_gaji;

            $summary_bulan_ini['totalGajiPokok']           += $gp;
            $summary_bulan_ini['totalTunjanganJabatan']    += $tj;
            $summary_bulan_ini['totalTunjanganTransport']  += $tt;
            $summary_bulan_ini['totalInsentif']            += $ins;
            $summary_bulan_ini['totalThr']                 += $thr;
            $summary_bulan_ini['totalTunjanganBpjs']        += $tb;
            $summary_bulan_ini['totalTunjanganPph']         += $tpph;
            $summary_bulan_ini['totalBpjsKesehatan']       += $bkes;
            $summary_bulan_ini['totalBpjsKetenagakerjaan'] += $btk;
            $summary_bulan_ini['totalPotonganBpjs']        += $pb;
            $summary_bulan_ini['totalPotonganLain']        += $pot;
            $summary_bulan_ini['totalPph21']               += $pph;
            $summary_bulan_ini['totalGajiKotor']           += $kotor;
            $summary_bulan_ini['totalGajiTerlaporPajak']   += $gtp;
            $summary_bulan_ini['totalGajiBersih']          += $brsih;
            $summary_bulan_ini['totalPegawaiInput']++;
        }

        // Akumulasi tahunan dan rekam riwayat per bulan
        $total_gaji_kotor_thn  = 0.0;
        $total_gaji_bersih_thn = 0.0;
        $total_pph21_thn       = 0.0;
        $riwayat_gaji_bulan    = [];
        foreach ($gaji_months as $gm) {
            $total_gaji_kotor_thn  += (float)($gm['totalGajiKotor'] ?? 0);
            $total_gaji_bersih_thn += (float)($gm['totalGajiBersih'] ?? 0);
            $total_pph21_thn       += (float)($gm['pph21'] ?? 0);

            $gp_m    = (float)($gm['gajiPokok'] ?? 0);
            $tj_m    = (float)($gm['tunjanganJabatan'] ?? 0);
            $tt_m    = (float)($gm['tunjanganTransport'] ?? 0);
            $ins_m   = (float)($gm['insentif'] ?? 0);
            $bkes_m  = (float)($gm['bpjsKesehatan'] ?? 0);
            $btk_m   = (float)($gm['bpjsKetenagakerjaan'] ?? 0);
            $pot_m   = (float)($gm['potonganLain'] ?? 0);
            $pph_m   = (float)($gm['pph21'] ?? 0);
            $kotor_m = (float)($gm['totalGajiKotor'] ?? 0);
            $brsih_m = (float)($gm['totalGajiBersih'] ?? 0);
            $hk_m    = (int)($gm['hariKerja'] ?? 0);
            $tarif_m = (float)($gm['tarifTransportHarian'] ?? 15000);
            $thr_m   = (float)($gm['thr'] ?? 0);
            $tbkes_m = (float)($gm['tunjanganBpjsKes'] ?? 0);
            $tbtk_m  = (float)($gm['tunjanganBpjsTk'] ?? 0);
            $tb_m    = (float)($gm['tunjanganBpjs'] ?? ($tbkes_m + $tbtk_m));
            $tpph_m  = (float)($gm['tunjanganPph'] ?? 0);
            $tlain_m = (float)($gm['tunjanganLainnya'] ?? $ins_m);
            $pb_m    = (float)($gm['potonganBpjs'] ?? ($bkes_m + $btk_m));
            $gtp_m   = (float)($gm['totalGajiTerlaporPajak'] ?? $kotor_m);

            $riwayat_gaji_bulan[(int)$gm['bulan']] = [
                'id'                       => $gm['id'],
                'pegawaiId'                => $pid,
                'pegawaiNama'              => $p['nama'],
                'pegawaiNik'               => $p['nik'],
                'pegawaiJabatan'           => $p['jabatan'],
                'pegawaiTanggalMasuk'      => $tgl_masuk,
                'pegawaiMasaKerja'         => $masa_kerja,
                'bulan'                    => (int)$gm['bulan'],
                'tahun'                    => (int)$gm['tahun'],
                'gajiPokok'                => $gp_m,
                'gajiPokokFmt'             => fmt_rp_payroll($gp_m),
                'tunjanganJabatan'         => $tj_m,
                'tunjanganJabatanFmt'      => fmt_rp_payroll($tj_m),
                'hariKerja'                => $hk_m,
                'tarifTransportHarian'     => $tarif_m,
                'tarifTransportHarianFmt'  => fmt_rp_payroll($tarif_m),
                'tunjanganTransport'       => $tt_m,
                'tunjanganTransportFmt'    => fmt_rp_payroll($tt_m),
                'insentif'                 => $ins_m,
                'insentifFmt'              => fmt_rp_payroll($ins_m),
                'tunjanganLainnya'         => $tlain_m,
                'tunjanganLainnyaFmt'      => fmt_rp_payroll($tlain_m),
                'thr'                      => $thr_m,
                'thrFmt'                   => fmt_rp_payroll($thr_m),
                'tunjanganBpjs'            => $tb_m,
                'tunjanganBpjsFmt'         => fmt_rp_payroll($tb_m),
                'tunjanganBpjsKes'         => $tbkes_m,
                'tunjanganBpjsKesFmt'      => fmt_rp_payroll($tbkes_m),
                'tunjanganBpjsTk'          => $tbtk_m,
                'tunjanganBpjsTkFmt'       => fmt_rp_payroll($tbtk_m),
                'tunjanganPph'             => $tpph_m,
                'tunjanganPphFmt'          => fmt_rp_payroll($tpph_m),
                'bpjsKesehatan'            => $bkes_m,
                'bpjsKesehatanFmt'         => fmt_rp_payroll($bkes_m),
                'bpjsKetenagakerjaan'      => $btk_m,
                'bpjsKetenagakerjaanFmt'   => fmt_rp_payroll($btk_m),
                'potonganBpjs'             => $pb_m,
                'potonganBpjsFmt'          => fmt_rp_payroll($pb_m),
                'potonganLain'             => $pot_m,
                'potonganLainFmt'          => fmt_rp_payroll($pot_m),
                'pph21'                    => $pph_m,
                'pph21Fmt'                 => fmt_rp_payroll($pph_m),
                'totalGajiKotor'           => $kotor_m,
                'totalGajiKotorFmt'        => fmt_rp_payroll($kotor_m),
                'totalGajiTerlaporPajak'   => $gtp_m,
                'totalGajiTerlaporPajakFmt'=> fmt_rp_payroll($gtp_m),
                'totalGajiBersih'          => $brsih_m,
                'totalGajiBersihFmt'       => fmt_rp_payroll($brsih_m),
                'catatan'                  => $gm['catatan'] ?? '',
            ];
        }

        $tj_master    = (float)($p['tunjanganJabatan'] ?? 0);
        $tbkes_master = (float)($p['tunjanganBpjsKes'] ?? 0);
        $tbtk_master  = (float)($p['tunjanganBpjsTk'] ?? 0);
        $tb_master    = $tbkes_master + $tbtk_master;
        $bkes_master  = (float)($p['bpjsKesehatan'] ?? 0);
        $btk_master   = (float)($p['bpjsKetenagakerjaan'] ?? 0);
        $pb_master    = (float)($p['potonganBpjs'] ?? ($bkes_master + $btk_master));
        if ($pb_master <= 0 && ($bkes_master > 0 || $btk_master > 0)) {
            $pb_master = $bkes_master + $btk_master;
        }
        $tot_tetap    = $gaji_pokok_num + $tj_master;
        $tarif_master = (float)($p['tarifTransportHarian'] ?? 15000.0);
        if ($tarif_master <= 0) {
            $tarif_master = 15000.0;
        }

        $p_item = [
            'id'                     => $pid,
            'entityId'               => $p['entityId'],
            'nik'                    => $p['nik'],
            'nama'                   => $p['nama'],
            'jabatan'                => $p['jabatan'],
            'statusKeluarga'         => $p['statusKeluarga'],
            'ptkp'                   => $ptkp_num,
            'ptkpFmt'                => fmt_rp_payroll($ptkp_num),
            'gajiPokok'              => $gaji_pokok_num,
            'gajiPokokFmt'           => fmt_rp_payroll($gaji_pokok_num),
            'tunjanganJabatan'       => $tj_master,
            'tunjanganJabatanFmt'    => fmt_rp_payroll($tj_master),
            'tarifTransportHarian'   => $tarif_master,
            'tarifTransportHarianFmt'=> fmt_rp_payroll($tarif_master),
            'tunjanganBpjsKes'       => $tbkes_master,
            'tunjanganBpjsKesFmt'    => fmt_rp_payroll($tbkes_master),
            'tunjanganBpjsTk'        => $tbtk_master,
            'tunjanganBpjsTkFmt'     => fmt_rp_payroll($tbtk_master),
            'tunjanganBpjs'          => $tb_master,
            'tunjanganBpjsFmt'       => fmt_rp_payroll($tb_master),
            'bpjsKesehatan'          => $bkes_master,
            'bpjsKesehatanFmt'       => fmt_rp_payroll($bkes_master),
            'bpjsKetenagakerjaan'    => $btk_master,
            'bpjsKetenagakerjaanFmt' => fmt_rp_payroll($btk_master),
            'potonganBpjs'           => $pb_master,
            'potonganBpjsFmt'        => fmt_rp_payroll($pb_master),
            'totalGajiTetap'         => $tot_tetap,
            'totalGajiTetapFmt'      => fmt_rp_payroll($tot_tetap),
            'tanggalMasuk'          => $tgl_masuk,
            'tanggalMasukFmt'       => $tgl_masuk ? fmt_tanggal_id($tgl_masuk) : null,
            'masaKerja'             => $masa_kerja,
            'status'                => $status_val,
            'tanggalResign'         => $tgl_resign,
            'tanggalResignFmt'      => $tgl_resign ? fmt_tanggal_id($tgl_resign) : null,
            'isActive'              => $is_active,
            'currentGaji'           => $current_gaji,
            'riwayatGajiBulan'      => $riwayat_gaji_bulan,
            'akumulasiTahun'        => [
                'totalGajiKotor'         => $total_gaji_kotor_thn,
                'totalGajiTerlaporPajak' => $total_gaji_kotor_thn,
                'totalGajiBersih'        => $total_gaji_bersih_thn,
                'totalPph21'             => $total_pph21_thn,
                'bulanTerbayar'          => count($gaji_months),
            ],
        ];

        // 1. Masukkan ke profil master seluruh pegawai
        $all_pegawai_master[] = $p_item;

        // 2. Cek apakah karyawan berhak muncul di daftar penggajian bulan $month/$year ini
        $is_eligible = is_pegawai_eligible_for_month($p, $year, $month, ($current_gaji !== null));
        if ($is_eligible) {
            $pegawai_list[] = $p_item;
            if ($is_active || ($current_gaji !== null)) {
                $summary_bulan_ini['totalPegawaiAktif']++;
            }
        }
    }

    // 6. Honor list for entity+year+month
    $stmt = $pdo->prepare(
        "SELECT h.*, e.`key` AS entityKey, e.name AS entityName,
                p.code AS projCode, p.name AS projName,
                r.ptkp, r.isTurunLapangan, r.tanggalMulaiTugas, r.tanggalSelesaiTugas
         FROM HonorTenagaAhli h
         JOIN Entity e ON h.entityId = e.id
         LEFT JOIN Project p ON h.projectId = p.id
         LEFT JOIN Rekanan r ON h.rekananId = r.id
         WHERE h.entityId = ? AND h.tahun = ? AND h.bulan = ?
         ORDER BY h.tanggal DESC"
    );
    $stmt->execute([$entity_id, $year, $month]);
    $honor_raw = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $honor_list = [];
    $summary_honor_bulan_ini = [
        'totalTransaksi'  => 0,
        'totalHonorBruto' => 0.0,
        'totalPph21'      => 0.0,
        'totalHonorBersih'=> 0.0,
    ];
    $paid_rekanan_ids  = [];
    $paid_rekanan_niks = [];

    foreach ($honor_raw as $h) {
        $bruto  = (float)$h['nominalHonor'];
        $pph    = (float)$h['pph21'];
        $bersih = (float)$h['nominalBersih'];
        $resolved_proj = $h['namaProyek']
            ?: ($h['projCode'] ? "{$h['projCode']} - {$h['projName']}" : null);
        $tgl_str = substr($h['tanggal'], 0, 10); // YYYY-MM-DD

        if (!empty($h['rekananId'])) {
            $paid_rekanan_ids[$h['rekananId']] = true;
        }
        if (!empty($h['nik'])) {
            $paid_rekanan_niks[$h['nik']] = true;
        }

        $pgw_info = get_pegawai_tetap_info($h, $pegawai_by_nik, $pegawai_by_name);
        $is_pegawai_tetap_lain = ($pgw_info && $pgw_info['entityId'] !== $h['entityId']);

        $honor_list[] = [
            'id'                  => $h['id'],
            'entityId'            => $h['entityId'],
            'entityName'          => $h['entityName'],
            'entityKey'           => $h['entityKey'],
            'rekananId'           => $h['rekananId'] ?? null,
            'nik'                 => $h['nik'],
            'nama'                => $h['nama'],
            'npwp'                => $h['npwp'] ?? null,
            'ptkp'                => $h['ptkp'] ?? 'TK/0',
            'uraian'              => $h['uraian'],
            'tanggal'             => $tgl_str,
            'tanggalFmt'          => fmt_tanggal_id($tgl_str),
            'bulan'               => (int)$h['bulan'],
            'tahun'               => (int)$h['tahun'],
            'nominalHonor'        => $bruto,
            'nominalHonorFmt'     => fmt_rp_payroll($bruto),
            'tarifPph21Persen'    => (float)$h['tarifPph21Persen'],
            'pph21'               => $pph,
            'pph21Fmt'            => fmt_rp_payroll($pph),
            'nominalBersih'       => $bersih,
            'nominalBersihFmt'    => fmt_rp_payroll($bersih),
            'projectId'           => $h['projectId'] ?? null,
            'projectCode'         => $h['projCode'] ?? null,
            'projectName'         => $h['projName'] ?? null,
            'namaProyek'          => $resolved_proj,
            'noBukti'             => $h['noBukti'] ?? null,
            'isPendingPayment'    => false,
            'statusPembayaran'    => 'DIBAYAR',
            'isTurunLapangan'     => isset($h['isTurunLapangan']) ? ((int)$h['isTurunLapangan'] === 1) : true,
            'tanggalMulaiTugas'   => $h['tanggalMulaiTugas'] ?? null,
            'tanggalSelesaiTugas' => $h['tanggalSelesaiTugas'] ?? null,
            'isPegawaiTetap'        => ($pgw_info !== null),
            'isPegawaiTetapLain'    => $is_pegawai_tetap_lain,
            'pegawaiHomeEntityId'   => $pgw_info ? $pgw_info['entityId'] : null,
            'pegawaiHomeEntityName' => $pgw_info ? $pgw_info['entityName'] : null,
            'pegawaiHomeEntityKey'  => $pgw_info ? $pgw_info['entityKey'] : null,
        ];

        $summary_honor_bulan_ini['totalTransaksi']++;
        $summary_honor_bulan_ini['totalHonorBruto']  += $bruto;
        $summary_honor_bulan_ini['totalPph21']        += $pph;
        $summary_honor_bulan_ini['totalHonorBersih']  += $bersih;
    }

    // Auto-populasikan tenaga ahli / freelance yang aktif dalam masa tugas & berstatus turun ke lapangan
    // khusus untuk penugasan proyek pada entitas yang sedang aktif dipilih ($entity_id)
    foreach ($rekanan_tenaga_ahli as $ta) {
        $p_assignments = !empty($ta['proyekList']) ? $ta['proyekList'] : [];
        if (empty($p_assignments) && !empty($ta['projectId'])) {
            $p_assignments = [[
                'id'                  => null,
                'projectId'           => $ta['projectId'],
                'projectCode'         => $ta['projectCode'] ?? null,
                'projectName'         => $ta['projectName'] ?? null,
                'projectEntityId'     => $ta['projectEntityId'] ?? $ta['entityId'],
                'projectEntityName'   => $ta['projectEntityName'] ?? ($ta['entityName'] ?? ''),
                'tanggalMulaiTugas'   => $ta['tanggalMulaiTugas'] ?? null,
                'tanggalSelesaiTugas' => $ta['tanggalSelesaiTugas'] ?? null,
                'isTurunLapangan'     => $ta['isTurunLapangan'] ?? true,
                'nominalHonorBulanan' => $ta['nominalHonorBulanan'] ?? 0.0,
            ]];
        }

        foreach ($p_assignments as $pl) {
            $assignment_entity_id = $pl['projectEntityId'] ?? $ta['entityId'];
            // HANYA muncul jika penugasan proyek ini adalah milik entitas aktif saat ini!
            if ($assignment_entity_id !== $entity_id) {
                continue;
            }

            // Cek status turun lapangan penugasan proyek ini
            $is_turun = isset($pl['isTurunLapangan']) ? ((bool)$pl['isTurunLapangan']) : true;
            if (!$is_turun) {
                continue;
            }

            // ATURAN KHUSUS: Jika tenaga ahli ini adalah Pegawai Tetap di entitas lain (misal Pegawai Tetap Kencana
            // yang ditugaskan sebagai Tenaga Ahli di Gaharu), HANYA muncul jika sudah digaji (ada transaksi honor).
            // Jangan dimunculkan sebagai baris pending / siap dibayar setiap bulan di entitas lain.
            $pgw_info = get_pegawai_tetap_info($ta, $pegawai_by_nik, $pegawai_by_name);
            $is_pegawai_tetap_lain = ($pgw_info && $pgw_info['entityId'] !== $assignment_entity_id);

            // Cek masa tugas penugasan proyek ini & status pegawai tetap entitas lain
            if (!is_tenaga_ahli_eligible_for_month($pl, $year, $month, false, $is_pegawai_tetap_lain)) {
                continue;
            }

            // Cek apakah penugasan ini sudah dibayarkan di entitas ini pada bulan ini untuk proyek ini
            $p_id = $pl['projectId'] ?? '';
            $already_paid = false;
            foreach ($honor_list as $hl) {
                if ($hl['statusPembayaran'] === 'DIBAYAR' && $hl['entityId'] === $entity_id) {
                    $match_person = (!empty($ta['id']) && $hl['rekananId'] === $ta['id'])
                        || (!empty($ta['nik']) && $hl['nik'] === $ta['nik']);
                    if ($match_person) {
                        if (!empty($p_id) && !empty($hl['projectId'])) {
                            if ($hl['projectId'] === $p_id) {
                                $already_paid = true;
                                break;
                            }
                        } else {
                            $already_paid = true;
                            break;
                        }
                    }
                }
            }
            if ($already_paid) {
                continue;
            }

            $nominal_honor = (float)($pl['nominalHonorBulanan'] ?? 0.0);
            foreach ($pl['gajiKontrak']['jadwal'] ?? [] as $salary_row) {
                if ($salary_row['bulan'] === sprintf('%04d-%02d', $year, $month)) $nominal_honor = (float)($salary_row['nominal'] ?? 0);
            }
            $has_npwp      = !empty($ta['npwp']);
            $tarif_pph     = $has_npwp ? 2.5 : 3.0; // Standar PPh 21 Bukan Pegawai (50% x 5% = 2.5%, non-NPWP 120% = 3%)
            $pph21         = $nominal_honor > 0 ? round(($nominal_honor * $tarif_pph) / 100) : 0.0;
            $bersih        = max(0, $nominal_honor - $pph21);
            $resolved_proj = $pl['projectCode'] ? "{$pl['projectCode']} - {$pl['projectName']}" : ($pl['projectName'] ?? null);
            $tgl_default   = sprintf('%04d-%02d-01', $year, $month);
            $unique_pending_id = 'pending_' . $ta['id'] . ($p_id ? '_' . $p_id : '');

            $honor_list[] = [
                'id'                  => $unique_pending_id,
                'entityId'            => $entity_id,
                'entityName'          => $entity['name'] ?? '',
                'entityKey'           => $entity['key'] ?? '',
                'rekananId'           => $ta['id'],
                'nik'                 => $ta['nik'] ?? '',
                'nama'                => $ta['nama'],
                'npwp'                => $ta['npwp'] ?? null,
                'ptkp'                => $ta['ptkp'] ?? 'TK/0',
                'uraian'              => "Honorarium Tenaga Ahli: {$ta['nama']}" . ($resolved_proj ? " ({$resolved_proj})" : ""),
                'tanggal'             => $tgl_default,
                'tanggalFmt'          => fmt_tanggal_id($tgl_default),
                'bulan'               => $month,
                'tahun'               => $year,
                'nominalHonor'        => $nominal_honor,
                'nominalHonorFmt'     => fmt_rp_payroll($nominal_honor),
                'tarifPph21Persen'    => $tarif_pph,
                'pph21'               => $pph21,
                'pph21Fmt'            => fmt_rp_payroll($pph21),
                'nominalBersih'       => $bersih,
                'nominalBersihFmt'    => fmt_rp_payroll($bersih),
                'projectId'           => $pl['projectId'] ?? null,
                'projectCode'         => $pl['projectCode'] ?? null,
                'projectName'         => $pl['projectName'] ?? null,
                'namaProyek'          => $resolved_proj,
                'noBukti'             => null,
                'isPendingPayment'    => true,
                'statusPembayaran'    => 'BELUM_DIBAYAR',
                'isTurunLapangan'     => true,
                'tanggalMulaiTugas'   => $pl['tanggalMulaiTugas'] ?? null,
                'tanggalSelesaiTugas' => $pl['tanggalSelesaiTugas'] ?? null,
            ];
        }
    }

    // 7. All gaji for entity+year (for rekap bulanan)
    $stmt = $pdo->prepare(
        "SELECT bulan, gajiPokok, tunjanganJabatan, tunjanganTransport, insentif,
                bpjsKesehatan, bpjsKetenagakerjaan, potonganLain, pph21,
                totalGajiKotor, totalGajiBersih
         FROM GajiPegawaiBulanan
         WHERE entityId = ? AND tahun = ?
         ORDER BY bulan ASC"
    );
    $stmt->execute([$entity_id, $year]);
    $all_gaji_tahun = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $bulan_names = ['Januari','Februari','Maret','April','Mei','Juni',
                    'Juli','Agustus','September','Oktober','November','Desember'];
    $rekap_bulanan_pegawai = [];
    for ($m = 1; $m <= 12; $m++) {
        $g_list = array_filter($all_gaji_tahun, fn($g) => (int)$g['bulan'] === $m);
        $g_list = array_values($g_list);
        $tot_gp    = array_sum(array_column($g_list, 'gajiPokok'));
        $tot_tj    = array_sum(array_column($g_list, 'tunjanganJabatan'))
                   + array_sum(array_column($g_list, 'tunjanganTransport'));
        $tot_ins   = array_sum(array_column($g_list, 'insentif'));
        $tot_kotor = array_sum(array_column($g_list, 'totalGajiKotor'));
        $tot_bpjs  = array_sum(array_column($g_list, 'bpjsKesehatan'))
                   + array_sum(array_column($g_list, 'bpjsKetenagakerjaan'));
        $tot_pph   = array_sum(array_column($g_list, 'pph21'));
        $tot_pot   = array_sum(array_column($g_list, 'potonganLain'));
        $tot_brsih = array_sum(array_column($g_list, 'totalGajiBersih'));

        $rekap_bulanan_pegawai[] = [
            'bulan'              => $m,
            'bulanName'          => $bulan_names[$m - 1],
            'totalPegawai'       => count($g_list),
            'totalGajiPokok'     => (float)$tot_gp,
            'totalGajiPokokFmt'  => fmt_rp_payroll((float)$tot_gp),
            'totalTunjangan'     => (float)$tot_tj,
            'totalTunjanganFmt'  => fmt_rp_payroll((float)$tot_tj),
            'totalInsentif'      => (float)$tot_ins,
            'totalInsentifFmt'   => fmt_rp_payroll((float)$tot_ins),
            'totalGajiKotor'     => (float)$tot_kotor,
            'totalGajiKotorFmt'  => fmt_rp_payroll((float)$tot_kotor),
            'totalBpjs'          => (float)$tot_bpjs,
            'totalBpjsFmt'       => fmt_rp_payroll((float)$tot_bpjs),
            'totalPph21'         => (float)$tot_pph,
            'totalPph21Fmt'      => fmt_rp_payroll((float)$tot_pph),
            'totalPotonganLain'  => (float)$tot_pot,
            'totalPotonganLainFmt' => fmt_rp_payroll((float)$tot_pot),
            'totalGajiBersih'    => (float)$tot_brsih,
            'totalGajiBersihFmt' => fmt_rp_payroll((float)$tot_brsih),
        ];
    }

    // 8. All honor for entity+year (for rekap bulanan Tenaga Ahli)
    $stmt = $pdo->prepare(
        "SELECT h.*, p.code AS projCode, p.name AS projName
         FROM HonorTenagaAhli h
         LEFT JOIN Project p ON h.projectId = p.id
         WHERE h.entityId = ? AND h.tahun = ?
         ORDER BY h.tanggal DESC"
    );
    $stmt->execute([$entity_id, $year]);
    $all_honor_entitas_tahun = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $rekap_bulanan_ta = [];
    for ($m = 1; $m <= 12; $m++) {
        $h_list = array_filter($all_honor_entitas_tahun, fn($h) => (int)$h['bulan'] === $m);
        $h_list = array_values($h_list);
        $bruto  = array_sum(array_column($h_list, 'nominalHonor'));
        $pph    = array_sum(array_column($h_list, 'pph21'));
        $bersih = array_sum(array_column($h_list, 'nominalBersih'));
        $rekap_bulanan_ta[] = [
            'bulan'              => $m,
            'bulanName'          => $bulan_names[$m - 1],
            'totalTransaksi'     => count($h_list),
            'totalHonorBruto'    => (float)$bruto,
            'totalHonorBrutoFmt' => fmt_rp_payroll((float)$bruto),
            'totalPph21'         => (float)$pph,
            'totalPph21Fmt'      => fmt_rp_payroll((float)$pph),
            'totalHonorBersih'   => (float)$bersih,
            'totalHonorBersihFmt'=> fmt_rp_payroll((float)$bersih),
        ];
    }

    // 9. All honor for all entities (lifetime & current year for konsolidasi)
    $stmt = $pdo->prepare(
        "SELECT h.*, e.id AS eid, e.`key` AS ekey, e.name AS ename,
                p.code AS projCode, p.name AS projName
         FROM HonorTenagaAhli h
         JOIN Entity e ON h.entityId = e.id
         LEFT JOIN Project p ON h.projectId = p.id
         ORDER BY h.tanggal DESC"
    );
    $stmt->execute();
    $all_honor_history = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $all_honor_tahun = array_values(array_filter($all_honor_history, fn($h) => (int)$h['tahun'] === $year));

    // Build rekapTenagaAhliPerNama (grouped by NIK/nama, cross-entity)
    $per_nama_map = [];

    // 1. Masukkan seluruh Master Tenaga Ahli yang terdaftar di Rekanan (tipe TENAGA_AHLI)
    // Gunakan data dari $rekanan_tenaga_ahli yang sudah memuat proyekList lengkap dengan projectEntityName & projectEntityId
    foreach ($rekanan_tenaga_ahli as $ra) {
        $key = trim($ra['nik'] ?? '') ?: trim($ra['nama']);
        if (!$key) continue;

        $p_list = !empty($ra['proyekList']) ? $ra['proyekList'] : [];

        // Kumpulkan daftar entitas dan proyek yang relevan bagi tenaga ahli ini
        $entities_for_this_ta = [];
        if (!empty($ra['entityName'])) {
            $entities_for_this_ta[] = $ra['entityName'];
        }

        $proj_names = [];
        $proj_objs = [];

        foreach ($p_list as $pl) {
            $p_name = $pl['projectName']
                ?: ($pl['projectCode'] ? "{$pl['projectCode']} - {$pl['projectName']}" : null);
            if ($p_name) {
                $p_label = $pl['projectCode'] ? "{$pl['projectCode']} - {$pl['projectName']}" : $pl['projectName'];
                $proj_names[] = $p_label;

                $ent_name = $pl['projectEntityName'] ?: ($ra['entityName'] ?: 'Holding / Lainnya');
                $proj_objs[] = [
                    'projectId'   => $pl['projectId'] ?? null,
                    'projectCode' => $pl['projectCode'] ?? null,
                    'projectName' => $pl['projectName'] ?? '',
                    'namaProyek'  => $p_label,
                    'entityId'    => $pl['projectEntityId'] ?? ($ra['entityId'] ?? null),
                    'entityName'  => $ent_name,
                ];

                if (!in_array($ent_name, $entities_for_this_ta)) {
                    $entities_for_this_ta[] = $ent_name;
                }
            }
        }

        if (!isset($per_nama_map[$key])) {
            $per_nama_map[$key] = [
                'nik'               => $ra['nik'] ?: '-',
                'nama'              => $ra['nama'],
                'npwp'              => $ra['npwp'] ?? null,
                'totalTransaksi'    => 0,
                'totalHonorBruto'   => 0.0,
                'totalPph21'        => 0.0,
                'totalHonorBersih'  => 0.0,
                'daftarEntitas'     => array_values(array_unique($entities_for_this_ta)),
                'daftarProyek'      => array_values(array_unique($proj_names)),
                'daftarProyekObj'   => $proj_objs,
                'daftarBulan'       => [],
                'rincian'           => [],
            ];
        } else {
            foreach ($entities_for_this_ta as $en) {
                if (!in_array($en, $per_nama_map[$key]['daftarEntitas'])) {
                    $per_nama_map[$key]['daftarEntitas'][] = $en;
                }
            }
            foreach ($proj_names as $pn) {
                if (!in_array($pn, $per_nama_map[$key]['daftarProyek'])) {
                    $per_nama_map[$key]['daftarProyek'][] = $pn;
                }
            }
            foreach ($proj_objs as $po) {
                $exists = false;
                foreach ($per_nama_map[$key]['daftarProyekObj'] as $existing_po) {
                    if ($existing_po['namaProyek'] === $po['namaProyek'] && $existing_po['entityName'] === $po['entityName']) {
                        $exists = true;
                        break;
                    }
                }
                if (!$exists) {
                    $per_nama_map[$key]['daftarProyekObj'][] = $po;
                }
            }
        }
    }

    // 2. Agregasikan data dari riwayat pembayaran honor
    foreach ($all_honor_tahun as $h) {
        $key = trim($h['nik'] ?? '') ?: trim($h['nama']);
        $bruto  = (float)$h['nominalHonor'];
        $pph    = (float)$h['pph21'];
        $bersih = (float)$h['nominalBersih'];
        $resolved_proj = $h['namaProyek'] ?: ($h['projCode'] ? "{$h['projCode']} - {$h['projName']}" : 'Umum / Non-Proyek');
        $bulan_name = $bulan_names[(int)$h['bulan'] - 1] ?? "Bulan {$h['bulan']}";
        $tgl_str = substr($h['tanggal'], 0, 10);

        if (!isset($per_nama_map[$key])) {
            $per_nama_map[$key] = [
                'nik'               => $h['nik'],
                'nama'              => $h['nama'],
                'npwp'              => $h['npwp'] ?? null,
                'totalTransaksi'    => 0,
                'totalHonorBruto'   => 0.0,
                'totalPph21'        => 0.0,
                'totalHonorBersih'  => 0.0,
                'daftarEntitas'     => [],
                'daftarProyek'      => [],
                'daftarProyekObj'   => [],
                'daftarBulan'       => [],
                'rincian'           => [],
            ];
        }
        $rec = &$per_nama_map[$key];
        $rec['totalTransaksi']++;
        $rec['totalHonorBruto']  += $bruto;
        $rec['totalPph21']        += $pph;
        $rec['totalHonorBersih']  += $bersih;
        if ($h['ename'] && !in_array($h['ename'], $rec['daftarEntitas'])) {
            $rec['daftarEntitas'][] = $h['ename'];
        }
        if ($resolved_proj && !in_array($resolved_proj, $rec['daftarProyek'])) {
            $rec['daftarProyek'][] = $resolved_proj;
        }
        if ($resolved_proj && isset($rec['daftarProyekObj'])) {
            $exists = false;
            foreach ($rec['daftarProyekObj'] as $epo) {
                if ($epo['namaProyek'] === $resolved_proj && $epo['entityName'] === $h['ename']) {
                    $exists = true;
                    break;
                }
            }
            if (!$exists) {
                $rec['daftarProyekObj'][] = [
                    'projectId'   => $h['projectId'] ?? null,
                    'projectCode' => $h['projCode'] ?? null,
                    'projectName' => $h['projName'] ?? '',
                    'namaProyek'  => $resolved_proj,
                    'entityId'    => $h['entityId'],
                    'entityName'  => $h['ename'],
                ];
            }
        }
        if ($bulan_name && !in_array($bulan_name, $rec['daftarBulan'])) {
            $rec['daftarBulan'][] = $bulan_name;
        }
        $rec['rincian'][] = [
            'id'              => $h['id'],
            'entityId'        => $h['entityId'],
            'entityName'      => $h['ename'],
            'tanggal'         => $tgl_str,
            'tanggalFmt'      => fmt_tanggal_id($tgl_str),
            'bulan'           => (int)$h['bulan'],
            'bulanName'       => $bulan_name,
            'uraian'          => $h['uraian'],
            'namaProyek'      => $resolved_proj,
            'noBukti'         => $h['noBukti'] ?? null,
            'nominalHonor'    => $bruto,
            'nominalHonorFmt' => fmt_rp_payroll($bruto),
            'pph21'           => $pph,
            'pph21Fmt'        => fmt_rp_payroll($pph),
            'nominalBersih'   => $bersih,
            'nominalBersihFmt'=> fmt_rp_payroll($bersih),
        ];
        unset($rec);
    }

    $rekap_ta_per_nama = [];
    foreach ($per_nama_map as $item) {
        $item['totalHonorBrutoFmt']  = fmt_rp_payroll($item['totalHonorBruto']);
        $item['totalPph21Fmt']       = fmt_rp_payroll($item['totalPph21']);
        $item['totalHonorBersihFmt'] = fmt_rp_payroll($item['totalHonorBersih']);
        $rekap_ta_per_nama[] = $item;
    }
    usort($rekap_ta_per_nama, function($a, $b) {
        if ($b['totalHonorBruto'] !== $a['totalHonorBruto']) {
            return $b['totalHonorBruto'] <=> $a['totalHonorBruto'];
        }
        return strcmp($a['nama'], $b['nama']);
    });

    // Build riwayatGaji lifetime untuk setiap Tenaga Ahli (Master Rekanan)
    $rincian_by_nik = [];
    $rincian_by_rek_id = [];
    foreach ($all_honor_history as $h) {
        $nik_key = trim($h['nik'] ?? '');
        $rek_key = trim($h['rekananId'] ?? '');
        $bruto   = (float)$h['nominalHonor'];
        $pph     = (float)$h['pph21'];
        $bersih  = (float)$h['nominalBersih'];
        $resolved_proj = $h['namaProyek'] ?: ($h['projCode'] ? "{$h['projCode']} - {$h['projName']}" : 'Umum / Non-Proyek');
        $bulan_name = $bulan_names[(int)$h['bulan'] - 1] ?? "Bulan {$h['bulan']}";
        $tgl_str = substr($h['tanggal'], 0, 10);

        $item_entry = [
            'id'              => $h['id'],
            'entityId'        => $h['entityId'],
            'entityName'      => $h['ename'],
            'tanggal'         => $tgl_str,
            'tanggalFmt'      => fmt_tanggal_id($tgl_str),
            'bulan'           => (int)$h['bulan'],
            'bulanName'       => $bulan_name,
            'tahun'           => (int)$h['tahun'],
            'uraian'          => $h['uraian'],
            'projectId'       => $h['projectId'] ?? null,
            'projectCode'     => $h['projCode'] ?? null,
            'projectName'     => $h['projName'] ?? null,
            'namaProyek'      => $resolved_proj,
            'noBukti'         => $h['noBukti'] ?? null,
            'nominalHonor'    => $bruto,
            'nominalHonorFmt' => fmt_rp_payroll($bruto),
            'pph21'           => $pph,
            'pph21Fmt'        => fmt_rp_payroll($pph),
            'nominalBersih'   => $bersih,
            'nominalBersihFmt'=> fmt_rp_payroll($bersih),
        ];

        if ($nik_key) {
            $rincian_by_nik[$nik_key][] = $item_entry;
        }
        if ($rek_key) {
            $rincian_by_rek_id[$rek_key][] = $item_entry;
        }
    }

    foreach ($rekanan_tenaga_ahli as &$rta_item) {
        $rta_nik = trim($rta_item['nik'] ?? '');
        $rta_id  = trim($rta_item['id'] ?? '');
        $rta_item['riwayatGaji'] = tenaga_ahli_merge_riwayat(
            $rincian_by_nik[$rta_nik] ?? [],
            $rincian_by_rek_id[$rta_id] ?? []
        );
    }
    unset($rta_item);

    // Build konsolidasiTenagaAhli
    $konsolidasi_map = [];
    foreach ($all_honor_tahun as $h) {
        $key    = $h['nik'] ?: $h['nama'];
        $bruto  = (float)$h['nominalHonor'];
        $pph    = (float)$h['pph21'];
        $bersih = (float)$h['nominalBersih'];

        if (!isset($konsolidasi_map[$key])) {
            $konsolidasi_map[$key] = [
                'nik'              => $h['nik'],
                'nama'             => $h['nama'],
                'npwp'             => $h['npwp'] ?? null,
                'totalTransaksi'   => 0,
                'totalHonorBruto'  => 0.0,
                'totalPph21'       => 0.0,
                'totalHonorBersih' => 0.0,
                'perEntitas'       => [],
            ];
        }
        $item = &$konsolidasi_map[$key];
        $item['totalTransaksi']++;
        $item['totalHonorBruto']  += $bruto;
        $item['totalPph21']        += $pph;
        $item['totalHonorBersih']  += $bersih;

        // Find or create perEntitas row
        $ent_found = false;
        foreach ($item['perEntitas'] as &$er) {
            if ($er['entityId'] === $h['entityId']) {
                $er['nominalHonor']  += $bruto;
                $er['pph21']          += $pph;
                $er['transaksiCount']++;
                $ent_found = true;
                break;
            }
        }
        unset($er);
        if (!$ent_found) {
            $item['perEntitas'][] = [
                'entityId'     => $h['entityId'],
                'entityName'   => $h['ename'],
                'entityKey'    => $h['ekey'],
                'nominalHonor' => $bruto,
                'pph21'        => $pph,
                'transaksiCount' => 1,
            ];
        }
        unset($item);
    }

    $konsolidasi_ta = [];
    foreach ($konsolidasi_map as $k) {
        $k['totalHonorBrutoFmt']  = fmt_rp_payroll($k['totalHonorBruto']);
        $k['totalPph21Fmt']       = fmt_rp_payroll($k['totalPph21']);
        $k['totalHonorBersihFmt'] = fmt_rp_payroll($k['totalHonorBersih']);
        foreach ($k['perEntitas'] as &$er) {
            $er['nominalHonorFmt'] = fmt_rp_payroll($er['nominalHonor']);
            $er['pph21Fmt']        = fmt_rp_payroll($er['pph21']);
        }
        unset($er);
        $konsolidasi_ta[] = $k;
    }

    // Build allHonorBulanIni — semua honor bulan ini, lintas entitas
    $all_honor_bulan_ini = [];
    $paid_holding_ids  = [];
    $paid_holding_niks = [];

    foreach ($all_honor_tahun as $h) {
        if ((int)$h['bulan'] !== $month) continue;
        $bruto  = (float)$h['nominalHonor'];
        $pph    = (float)$h['pph21'];
        $bersih = (float)$h['nominalBersih'];
        $resolved_proj = $h['namaProyek']
            ?: ($h['projCode'] ? "{$h['projCode']} - {$h['projName']}" : null);
        $tgl_str = substr($h['tanggal'], 0, 10);

        $proj_id_paid = $h['projectId'] ?: '__none__';
        if (!empty($h['rekananId'])) {
            $paid_holding_pairs[$h['rekananId'] . '_' . $proj_id_paid] = true;
        }
        if (!empty($h['nik'])) {
            $paid_holding_pairs[$h['nik'] . '_' . $proj_id_paid] = true;
        }

        $pgw_info = get_pegawai_tetap_info($h, $pegawai_by_nik, $pegawai_by_name);
        $is_pegawai_tetap_lain = ($pgw_info && $pgw_info['entityId'] !== $h['entityId']);

        $all_honor_bulan_ini[] = [
            'id'                  => $h['id'],
            'entityId'            => $h['entityId'],
            'entityName'          => $h['ename'],
            'entityKey'           => $h['ekey'],
            'rekananId'           => $h['rekananId'] ?? null,
            'nik'                 => $h['nik'],
            'nama'                => $h['nama'],
            'npwp'                => $h['npwp'] ?? null,
            'uraian'              => $h['uraian'],
            'tanggal'             => $tgl_str,
            'tanggalFmt'          => fmt_tanggal_id($tgl_str),
            'bulan'               => (int)$h['bulan'],
            'tahun'               => (int)$h['tahun'],
            'nominalHonor'        => $bruto,
            'nominalHonorFmt'     => fmt_rp_payroll($bruto),
            'tarifPph21Persen'    => (float)($h['tarifPph21Persen'] ?? 0),
            'pph21'               => $pph,
            'pph21Fmt'            => fmt_rp_payroll($pph),
            'nominalBersih'       => $bersih,
            'nominalBersihFmt'    => fmt_rp_payroll($bersih),
            'projectId'           => $h['projectId'] ?? null,
            'projectCode'         => $h['projCode'] ?? null,
            'projectName'         => $h['projName'] ?? null,
            'namaProyek'          => $resolved_proj,
            'ptkp'                => $h['ptkp'] ?? null,
            'jenisPph'            => $h['jenisPph'] ?? null,
            'noBukti'             => $h['noBukti'] ?? null,
            'isPendingPayment'    => false,
            'statusPembayaran'    => 'DIBAYAR',
            'isTurunLapangan'     => true,
            'tanggalMulaiTugas'   => $h['tanggalMulaiTugas'] ?? null,
            'tanggalSelesaiTugas' => $h['tanggalSelesaiTugas'] ?? null,
            'isPegawaiTetap'        => ($pgw_info !== null),
            'isPegawaiTetapLain'    => $is_pegawai_tetap_lain,
            'pegawaiHomeEntityId'   => $pgw_info ? $pgw_info['entityId'] : null,
            'pegawaiHomeEntityName' => $pgw_info ? $pgw_info['entityName'] : null,
            'pegawaiHomeEntityKey'  => $pgw_info ? $pgw_info['entityKey'] : null,
        ];
    }

    // Auto-populasikan freelance holding yang berstatus turun lapangan dan masih aktif dalam masa tugas untuk tiap proyek penugasan
    foreach ($rekanan_tenaga_ahli as $ta) {
        $proyek_list = !empty($ta['proyekList']) ? $ta['proyekList'] : [];
        if (empty($proyek_list) && !empty($ta['projectId'])) {
            $proyek_list = [[
                'projectId'           => $ta['projectId'],
                'projectCode'         => $ta['projectCode'] ?? null,
                'projectName'         => $ta['projectName'] ?? null,
                'projectEntityId'     => $ta['projectEntityId'] ?? $ta['entityId'],
                'projectEntityName'   => $ta['projectEntityName'] ?? ($ta['entityName'] ?? ''),
                'tanggalMulaiTugas'   => $ta['tanggalMulaiTugas'] ?? null,
                'tanggalSelesaiTugas' => $ta['tanggalSelesaiTugas'] ?? null,
                'isTurunLapangan'     => $ta['isTurunLapangan'] ?? true,
                'nominalHonorBulanan' => $ta['nominalHonorBulanan'] ?? 0.0,
            ]];
        }

        foreach ($proyek_list as $pl) {
            $proj_id_check = $pl['projectId'] ?: '__none__';
            $already_paid = (!empty($ta['id']) && isset($paid_holding_pairs[$ta['id'] . '_' . $proj_id_check]))
                || (!empty($ta['nik']) && isset($paid_holding_pairs[$ta['nik'] . '_' . $proj_id_check]));

            if ($already_paid) continue;

            $target_entity_id = $pl['projectEntityId'] ?: ($ta['entityId'] ?: $entity_id);
            $pgw_info = get_pegawai_tetap_info($ta, $pegawai_by_nik, $pegawai_by_name);
            $is_pegawai_tetap_lain = ($pgw_info && $pgw_info['entityId'] !== $target_entity_id);

            if (!is_tenaga_ahli_eligible_for_month($pl, $year, $month, false, $is_pegawai_tetap_lain)) continue;

            $nominal_honor = (float)($pl['nominalHonorBulanan'] ?? 0.0);
            foreach ($pl['gajiKontrak']['jadwal'] ?? [] as $salary_row) {
                if ($salary_row['bulan'] === sprintf('%04d-%02d', $year, $month)) $nominal_honor = (float)($salary_row['nominal'] ?? 0);
            }
            $has_npwp      = !empty($ta['npwp']);
            $tarif_pph     = $has_npwp ? 2.5 : 3.0;
            $pph21         = $nominal_honor > 0 ? round(($nominal_honor * $tarif_pph) / 100) : 0.0;
            $bersih        = max(0, $nominal_honor - $pph21);
            $resolved_proj = $pl['projectCode'] ? "{$pl['projectCode']} - {$pl['projectName']}" : ($pl['projectName'] ?? null);
            $tgl_default   = sprintf('%04d-%02d-01', $year, $month);

            $target_entity_id   = $pl['projectEntityId'] ?: ($ta['entityId'] ?: $entity_id);
            $target_entity_name = $pl['projectEntityName'] ?: ($entity['name'] ?? '');
            $target_entity_key  = '';
            foreach ($all_entities as $ent) {
                if ($ent['id'] === $target_entity_id) {
                    $target_entity_name = $ent['name'];
                    $target_entity_key  = $ent['key'];
                    break;
                }
            }

            $all_honor_bulan_ini[] = [
                'id'                  => 'pending_' . $ta['id'] . '_' . ($pl['projectId'] ?: 'none'),
                'entityId'            => $target_entity_id,
                'entityName'          => $target_entity_name,
                'entityKey'           => $target_entity_key,
                'rekananId'           => $ta['id'],
                'nik'                 => $ta['nik'] ?? '',
                'nama'                => $ta['nama'],
                'npwp'                => $ta['npwp'] ?? null,
                'uraian'              => "Honorarium Tenaga Ahli: {$ta['nama']}" . ($resolved_proj ? " ({$resolved_proj})" : ""),
                'tanggal'             => $tgl_default,
                'tanggalFmt'          => fmt_tanggal_id($tgl_default),
                'bulan'               => $month,
                'tahun'               => $year,
                'nominalHonor'        => $nominal_honor,
                'nominalHonorFmt'     => fmt_rp_payroll($nominal_honor),
                'tarifPph21Persen'    => $tarif_pph,
                'pph21'               => $pph21,
                'pph21Fmt'            => fmt_rp_payroll($pph21),
                'nominalBersih'       => $bersih,
                'nominalBersihFmt'    => fmt_rp_payroll($bersih),
                'projectId'           => $pl['projectId'] ?: null,
                'projectCode'         => $pl['projectCode'] ?? null,
                'projectName'         => $pl['projectName'] ?? null,
                'namaProyek'          => $resolved_proj,
                'ptkp'                => $ta['ptkp'] ?? 'TK/0',
                'jenisPph'            => 'PPh 21',
                'noBukti'             => null,
                'isPendingPayment'    => true,
                'statusPembayaran'    => 'BELUM_DIBAYAR',
                'isTurunLapangan'     => true,
                'tanggalMulaiTugas'   => $pl['tanggalMulaiTugas'] ?? null,
                'tanggalSelesaiTugas' => $pl['tanggalSelesaiTugas'] ?? null,
            ];
        }
    }

    // Build rekapTenagaAhliPerProyek — honor per proyek, seluruh tahun untuk entitas aktif ini
    $per_proyek_map = [];

    // 1. Masukkan seluruh proyek yang ditugaskan ke tenaga ahli yang BERASAL DARI entitas ini
    // agar proyek dan nama tenaga ahlinya tetap muncul di rekap per proyek walau belum ada pembayaran
    foreach ($rekanan_tenaga_ahli as $r) {
        $proyek_list = !empty($r['proyekList']) ? $r['proyekList'] : [];
        if (empty($proyek_list) && !empty($r['projectId'])) {
            $proyek_list = [[
                'projectId'           => $r['projectId'],
                'projectCode'         => $r['projectCode'] ?? null,
                'projectName'         => $r['projectName'] ?? null,
                'projectEntityId'     => $r['projectEntityId'] ?? $r['entityId'],
                'projectEntityName'   => $r['projectEntityName'] ?? ($r['entityName'] ?? ''),
            ]];
        }
        foreach ($proyek_list as $pl) {
            if (!empty($pl['projectId'])) {
                $pl_entity_id = $pl['projectEntityId'] ?? $r['entityId'];
                // HANYA jika proyek ini milik entitas aktif saat ini ($entity_id)!
                if ($pl_entity_id !== $entity_id) {
                    continue;
                }

                $proj_key = $pl['projectId'];
                if (!isset($per_proyek_map[$proj_key])) {
                    $proj_name = $pl['projectName']
                        ?: ($pl['projectCode'] ? "{$pl['projectCode']} - {$pl['projectName']}" : 'Proyek');
                    $per_proyek_map[$proj_key] = [
                        'projectId'         => $pl['projectId'],
                        'projectCode'       => $pl['projectCode'] ?? null,
                        'projectName'       => $proj_name,
                        'entityName'        => $entity['name'] ?? '',
                        'totalTransaksi'    => 0,
                        'totalHonorBruto'   => 0.0,
                        'totalPph'          => 0.0,
                        'totalHonorBersih'  => 0.0,
                        'tenagaAhliList'    => [],
                    ];
                }
                $nama = trim($r['nama']);
                if ($nama && !in_array($nama, $per_proyek_map[$proj_key]['tenagaAhliList'])) {
                    $per_proyek_map[$proj_key]['tenagaAhliList'][] = $nama;
                }
            }
        }
    }

    // 2. Agregasikan data dari riwayat pembayaran honor per proyek di entitas ini
    foreach ($all_honor_tahun as $h) {
        if ($h['entityId'] !== $entity_id) continue;
        $proj_key = $h['projectId'] ?: '__none__';
        $bruto  = (float)$h['nominalHonor'];
        $pph    = (float)$h['pph21'];
        $bersih = (float)$h['nominalBersih'];
        $proj_name = $h['namaProyek']
            ?: ($h['projCode'] ? "{$h['projCode']} - {$h['projName']}" : 'Umum / Non-Proyek');

        if (!isset($per_proyek_map[$proj_key])) {
            $per_proyek_map[$proj_key] = [
                'projectId'         => $h['projectId'] ?: null,
                'projectCode'       => $h['projCode'] ?? null,
                'projectName'       => $proj_name,
                'entityName'        => $h['ename'],
                'totalTransaksi'    => 0,
                'totalHonorBruto'   => 0.0,
                'totalPph'          => 0.0,
                'totalHonorBersih'  => 0.0,
                'tenagaAhliList'    => [],
            ];
        }
        $rec = &$per_proyek_map[$proj_key];
        $rec['totalTransaksi']++;
        $rec['totalHonorBruto']  += $bruto;
        $rec['totalPph']          += $pph;
        $rec['totalHonorBersih']  += $bersih;
        $nama = trim($h['nama']);
        if ($nama && !in_array($nama, $rec['tenagaAhliList'])) {
            $rec['tenagaAhliList'][] = $nama;
        }
        unset($rec);
    }

    $rekap_ta_per_proyek = [];
    foreach ($per_proyek_map as $item) {
        $item['totalHonorBrutoFmt']  = fmt_rp_payroll($item['totalHonorBruto']);
        $item['totalPphFmt']         = fmt_rp_payroll($item['totalPph']);
        $item['totalHonorBersihFmt'] = fmt_rp_payroll($item['totalHonorBersih']);
        $rekap_ta_per_proyek[] = $item;
    }
    usort($rekap_ta_per_proyek, function($a, $b) {
        if ($b['totalHonorBruto'] !== $a['totalHonorBruto']) {
            return $b['totalHonorBruto'] <=> $a['totalHonorBruto'];
        }
        return strcmp($a['projectName'], $b['projectName']);
    });

    // 10. Transactions for COA gaji/honor/tenaga ahli for year (for sync laba rugi)
    $year_start = "$year-01-01 00:00:00";
    $year_end   = "$year-12-31 23:59:59";
    $stmt = $pdo->prepare(
        "SELECT t.id, t.entityId, t.tanggal, t.noBukti, t.keterangan,
                t.coaAccountId, t.projectId, t.debit, t.kredit,
                t.extraFieldsJson,
                c.code AS coa_code, c.name AS coa_name,
                ji.`key` AS jenis_key, ji.nama AS jenis_nama,
                p.code AS proj_code, p.name AS proj_name,
                u.name AS staff_name
         FROM `Transaction` t
         JOIN CoaAccount c ON t.coaAccountId = c.id
         LEFT JOIN JenisInputTransaksi ji ON t.jenisInputId = ji.id
         LEFT JOIN Project p ON t.projectId = p.id
         LEFT JOIN User u ON t.staffId = u.id
         WHERE t.entityId = ?
           AND c.kategori = 'BEBAN'
           AND (c.code = '511' OR c.code = '612'
                OR c.name LIKE '%Gaji%' OR c.name LIKE '%Honor%' OR c.name LIKE '%Tenaga Ahli%')
           AND (t.extraFieldsJson IS NULL OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') IS NULL OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') != 'true')
           AND (
             (t.tanggal BETWEEN ? AND ? AND (t.extraFieldsJson IS NULL OR (JSON_VALUE(t.extraFieldsJson, '$.periodeTahunGaji') IS NULL AND JSON_VALUE(t.extraFieldsJson, '$.tanggalNota') IS NULL)))
             OR JSON_VALUE(t.extraFieldsJson, '$.periodeTahunGaji') = ?
             OR JSON_VALUE(t.extraFieldsJson, '$.tanggalNota') LIKE ?
           )
         ORDER BY t.tanggal DESC, t.noBukti DESC"
    );
    $stmt->execute([$entity_id, $year_start, $year_end, (string)$year, (string)$year . '%']);
    $tx_gaji_tahun = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $tx_pegawai_tahun = [];
    $tx_ta_tahun      = [];
    $jenis_map = [
        'kasKecil'        => 'Kas Kecil',
        'kasBesar'        => 'Kas Besar',
        'bankBuku'        => 'Buku Bank',
        'jurnalTransaksi' => 'Jurnal Umum',
    ];

    foreach ($tx_gaji_tahun as $t) {
        $code = $t['coa_code'];
        $name = strtolower($t['coa_name']);
        $d    = (float)$t['debit'];
        $k    = (float)$t['kredit'];
        $tgl  = substr($t['tanggal'], 0, 10);

        $extra = (!empty($t['extraFieldsJson']) && is_string($t['extraFieldsJson'])) ? json_decode($t['extraFieldsJson'], true) : [];
        $tgl_nota     = !empty($extra['tanggalNota']) ? substr((string)$extra['tanggalNota'], 0, 10) : null;
        $akrual_bulan = !empty($extra['periodeBulanGaji']) ? (int)$extra['periodeBulanGaji'] : ($tgl_nota ? (int)date('n', strtotime($tgl_nota)) : null);
        $akrual_tahun = !empty($extra['periodeTahunGaji']) ? (int)$extra['periodeTahunGaji'] : ($tgl_nota ? (int)date('Y', strtotime($tgl_nota)) : null);

        $bulan_tx  = $akrual_bulan ?: (int)date('n', strtotime($tgl));
        $tahun_tx  = $akrual_tahun ?: (int)date('Y', strtotime($tgl));
        $is_akrual = !empty($akrual_bulan) || (!empty($tgl_nota) && $tgl_nota !== $tgl);

        $is_crossing = !empty($extra['isCrossingEntry']);
        $crossing_from_key = $extra['crossingFromEntityKey'] ?? null;
        $entity_names = [
            'kencana'   => 'Kencana',
            'gaharu'    => 'Gaharu',
            'tataring'  => 'Tataring',
            'ciptaAsri' => 'Cipta Asri',
            'umum'      => 'Umum',
        ];
        $crossing_from_name = $crossing_from_key ? ($entity_names[$crossing_from_key] ?? ucfirst($crossing_from_key)) : null;

        $jenis_nama_str = $jenis_map[$t['jenis_key'] ?? ''] ?? ($t['jenis_nama'] ?? 'Jurnal Umum');
        if ($jenis_nama_str === 'Entry Jurnal') {
            $jenis_nama_str = 'Jurnal Umum';
        }
        if ($is_crossing && $crossing_from_name) {
            $jenis_nama_str = "Jurnal Umum (Pinjaman {$crossing_from_name})";
        }

        $item = [
            'id'                     => $t['id'],
            'entityId'               => $t['entityId'],
            'tanggal'                => $tgl,
            'tanggalFmt'             => fmt_tanggal_id($tgl),
            'bulan'                  => $bulan_tx,
            'tahun'                  => $tahun_tx,
            'isAkrual'               => $is_akrual,
            'periodeBulanGaji'       => $akrual_bulan,
            'periodeTahunGaji'       => $akrual_tahun,
            'tanggalNota'            => $tgl_nota,
            'noBukti'                => $t['noBukti'],
            'keterangan'             => $t['keterangan'],
            'coaAccountId'           => $t['coaAccountId'],
            'coaCode'                => $code ?: '-',
            'coaName'                => $t['coa_name'] ?: 'Beban Gaji',
            'jenisInputKey'          => $t['jenis_key'] ?? 'jurnalTransaksi',
            'jenisInputNama'         => $jenis_nama_str,
            'isCrossingEntry'        => $is_crossing,
            'crossingFromEntityKey'  => $crossing_from_key,
            'crossingFromEntityName' => $crossing_from_name,
            'crossingRole'           => $extra['crossingRole'] ?? null,
            'projectId'              => $t['projectId'] ?? null,
            'projectCode'            => $t['proj_code'] ?? null,
            'projectName'            => $t['proj_name'] ?? null,
            'namaProyek'             => $t['proj_code'] ? "{$t['proj_code']} - {$t['proj_name']}" : null,
            'debit'                  => $d,
            'debitFmt'               => fmt_rp_payroll($d),
            'kredit'                 => $k,
            'kreditFmt'              => fmt_rp_payroll($k),
            'staffName'              => $t['staff_name'] ?? null,
        ];

        if ($code === '612' || preg_match('/tenaga ahli|honor/i', $name)) {
            $tx_ta_tahun[] = $item;
        } elseif ($code === '511' || preg_match('/gaji/i', $name)) {
            $tx_pegawai_tahun[] = $item;
        }
    }

    $tx_pegawai_bulan = array_values(array_filter($tx_pegawai_tahun, fn($t) => $t['bulan'] === $month));
    $tx_ta_bulan      = array_values(array_filter($tx_ta_tahun,      fn($t) => $t['bulan'] === $month));

    $total_jurnal_pegawai_bulan  = array_sum(array_column($tx_pegawai_bulan, 'debit'));
    $total_jurnal_pegawai_tahun  = array_sum(array_column($tx_pegawai_tahun, 'debit'));
    $total_payload_pegawai_bulan = $summary_bulan_ini['totalGajiKotor'];
    $total_payload_pegawai_tahun = array_sum(array_column($rekap_bulanan_pegawai, 'totalGajiKotor'));
    $selisih_pgw_bulan           = abs($total_payload_pegawai_bulan - $total_jurnal_pegawai_bulan);
    $selisih_pgw_tahun           = abs($total_payload_pegawai_tahun - $total_jurnal_pegawai_tahun);

    $total_jurnal_ta_bulan  = array_sum(array_column($tx_ta_bulan,  'debit'));
    $total_jurnal_ta_tahun  = array_sum(array_column($tx_ta_tahun,  'debit'));
    $total_payload_ta_bulan = $summary_honor_bulan_ini['totalHonorBruto'];
    $total_payload_ta_tahun = array_sum(array_column($rekap_bulanan_ta, 'totalHonorBruto'));
    $selisih_ta_bulan       = abs($total_payload_ta_bulan - $total_jurnal_ta_bulan);
    $selisih_ta_tahun       = abs($total_payload_ta_tahun - $total_jurnal_ta_tahun);

    $penyesuaian_jurnal = [
        'pegawai' => [
            'coaCode'               => '511',
            'coaName'               => 'Gaji',
            'totalPayrollBulan'     => $total_payload_pegawai_bulan,
            'totalPayrollBulanFmt'  => fmt_rp_payroll($total_payload_pegawai_bulan),
            'totalJurnalBulan'      => $total_jurnal_pegawai_bulan,
            'totalJurnalBulanFmt'   => fmt_rp_payroll($total_jurnal_pegawai_bulan),
            'selisihBulan'          => $selisih_pgw_bulan,
            'selisihBulanFmt'       => fmt_rp_payroll($selisih_pgw_bulan),
            'isSinkronBulan'        => $selisih_pgw_bulan === 0.0,
            'totalPayrollTahun'     => $total_payload_pegawai_tahun,
            'totalPayrollTahunFmt'  => fmt_rp_payroll($total_payload_pegawai_tahun),
            'totalJurnalTahun'      => $total_jurnal_pegawai_tahun,
            'totalJurnalTahunFmt'   => fmt_rp_payroll($total_jurnal_pegawai_tahun),
            'selisihTahun'          => $selisih_pgw_tahun,
            'selisihTahunFmt'       => fmt_rp_payroll($selisih_pgw_tahun),
            'isSinkronTahun'        => $selisih_pgw_tahun === 0.0,
            'transaksiBulan'        => $tx_pegawai_bulan,
            'transaksiTahun'        => $tx_pegawai_tahun,
        ],
        'tenagaAhli' => [
            'coaCode'               => '612',
            'coaName'               => 'Gaji Tenaga Ahli',
            'totalPayrollBulan'     => $total_payload_ta_bulan,
            'totalPayrollBulanFmt'  => fmt_rp_payroll($total_payload_ta_bulan),
            'totalJurnalBulan'      => $total_jurnal_ta_bulan,
            'totalJurnalBulanFmt'   => fmt_rp_payroll($total_jurnal_ta_bulan),
            'selisihBulan'          => $selisih_ta_bulan,
            'selisihBulanFmt'       => fmt_rp_payroll($selisih_ta_bulan),
            'isSinkronBulan'        => $selisih_ta_bulan === 0.0,
            'totalPayrollTahun'     => $total_payload_ta_tahun,
            'totalPayrollTahunFmt'  => fmt_rp_payroll($total_payload_ta_tahun),
            'totalJurnalTahun'      => $total_jurnal_ta_tahun,
            'totalJurnalTahunFmt'   => fmt_rp_payroll($total_jurnal_ta_tahun),
            'selisihTahun'          => $selisih_ta_tahun,
            'selisihTahunFmt'       => fmt_rp_payroll($selisih_ta_tahun),
            'isSinkronTahun'        => $selisih_ta_tahun === 0.0,
            'transaksiBulan'        => $tx_ta_bulan,
            'transaksiTahun'        => $tx_ta_tahun,
        ],
    ];

    $total_payload_bulan = $total_payload_pegawai_bulan + $total_payload_ta_bulan;
    $total_gl_bulan      = $total_jurnal_pegawai_bulan  + $total_jurnal_ta_bulan;
    $total_selisih_bulan = abs($total_payload_bulan - $total_gl_bulan);

    $tx_semua_bulan = array_merge($tx_pegawai_bulan, $tx_ta_bulan);
    usort($tx_semua_bulan, function($a, $b) {
        $cmp = strcmp($b['tanggal'], $a['tanggal']);
        if ($cmp !== 0) return $cmp;
        return strcmp($b['noBukti'], $a['noBukti']);
    });

    $sync_data = [
        'tahun'                    => $year,
        'bulan'                    => $month,
        'payrollGajiPegawai'       => $total_payload_pegawai_bulan,
        'payrollGajiPegawaiFmt'    => fmt_rp_payroll($total_payload_pegawai_bulan),
        'glBebanGaji511'           => $total_jurnal_pegawai_bulan,
        'glBebanGaji511Fmt'        => fmt_rp_payroll($total_jurnal_pegawai_bulan),
        'selisihGajiPegawai'       => $selisih_pgw_bulan,
        'selisihGajiPegawaiFmt'    => fmt_rp_payroll($selisih_pgw_bulan),
        'isGajiPegawaiSinkron'     => $selisih_pgw_bulan === 0.0,
        'payrollHonorTenagaAhli'   => $total_payload_ta_bulan,
        'payrollHonorTenagaAhliFmt'=> fmt_rp_payroll($total_payload_ta_bulan),
        'glBebanTenagaAhli612'     => $total_jurnal_ta_bulan,
        'glBebanTenagaAhli612Fmt'  => fmt_rp_payroll($total_jurnal_ta_bulan),
        'selisihTenagaAhli'        => $selisih_ta_bulan,
        'selisihTenagaAhliFmt'     => fmt_rp_payroll($selisih_ta_bulan),
        'isTenagaAhliSinkron'      => $selisih_ta_bulan === 0.0,
        'totalPayroll'             => $total_payload_bulan,
        'totalPayrollFmt'          => fmt_rp_payroll($total_payload_bulan),
        'totalGLBeban'             => $total_gl_bulan,
        'totalGLBebanFmt'          => fmt_rp_payroll($total_gl_bulan),
        'totalSelisih'             => $total_selisih_bulan,
        'totalSelisihFmt'          => fmt_rp_payroll($total_selisih_bulan),
        'isOverallSinkron'         => $total_selisih_bulan === 0.0,
        'jurnalPegawaiRows'        => $tx_pegawai_bulan,
        'jurnalTenagaAhliRows'     => $tx_ta_bulan,
        'jurnalSemuaRows'          => $tx_semua_bulan,
    ];

    json_response([
        'entity'                => $entity,
        'allEntities'           => $all_entities,
        'projects'              => $projects,
        'allProjects'           => $all_projects,
        'rekananTenagaAhli'     => $rekanan_tenaga_ahli,
        'honorTracking'         => array_map('tenaga_ahli_payment_for_tracking', $all_honor_history),
        'year'                  => $year,
        'month'                 => $month,
        'pegawaiList'           => $pegawai_list,
        'allPegawaiMaster'      => $all_pegawai_master,
        'allHoldingPegawaiMaster' => $all_holding_pegawai,
        'gajiBulanIni'          => $gaji_bulan_ini,
        'rekapBulananPegawai'   => $rekap_bulanan_pegawai,
        'summaryBulanIni'       => array_merge($summary_bulan_ini, [
            'totalGajiPokokFmt'             => fmt_rp_payroll($summary_bulan_ini['totalGajiPokok']),
            'totalTunjanganJabatanFmt'      => fmt_rp_payroll($summary_bulan_ini['totalTunjanganJabatan']),
            'totalTunjanganTransportFmt'    => fmt_rp_payroll($summary_bulan_ini['totalTunjanganTransport']),
            'totalInsentifFmt'              => fmt_rp_payroll($summary_bulan_ini['totalInsentif']),
            'totalThrFmt'                   => fmt_rp_payroll($summary_bulan_ini['totalThr']),
            'totalTunjanganBpjsFmt'         => fmt_rp_payroll($summary_bulan_ini['totalTunjanganBpjs']),
            'totalTunjanganPphFmt'          => fmt_rp_payroll($summary_bulan_ini['totalTunjanganPph']),
            'totalBpjsKesehatanFmt'         => fmt_rp_payroll($summary_bulan_ini['totalBpjsKesehatan']),
            'totalBpjsKetenagakerjaanFmt'   => fmt_rp_payroll($summary_bulan_ini['totalBpjsKetenagakerjaan']),
            'totalPotonganBpjsFmt'          => fmt_rp_payroll($summary_bulan_ini['totalPotonganBpjs']),
            'totalPotonganLainFmt'          => fmt_rp_payroll($summary_bulan_ini['totalPotonganLain']),
            'totalPph21Fmt'                 => fmt_rp_payroll($summary_bulan_ini['totalPph21']),
            'totalGajiKotorFmt'             => fmt_rp_payroll($summary_bulan_ini['totalGajiKotor']),
            'totalGajiTerlaporPajakFmt'     => fmt_rp_payroll($summary_bulan_ini['totalGajiTerlaporPajak']),
            'totalGajiBersihFmt'            => fmt_rp_payroll($summary_bulan_ini['totalGajiBersih']),
        ]),
        'honorList'             => $honor_list,
        'allHonorBulanIni'      => $all_honor_bulan_ini,
        'rekapBulananTenagaAhli'=> $rekap_bulanan_ta,
        'rekapTenagaAhliPerNama'=> $rekap_ta_per_nama,
        'rekapTenagaAhliPerProyek' => $rekap_ta_per_proyek,
        'summaryHonorBulanIni'  => array_merge($summary_honor_bulan_ini, [
            'totalHonorBrutoFmt'  => fmt_rp_payroll($summary_honor_bulan_ini['totalHonorBruto']),
            'totalPph21Fmt'       => fmt_rp_payroll($summary_honor_bulan_ini['totalPph21']),
            'totalHonorBersihFmt' => fmt_rp_payroll($summary_honor_bulan_ini['totalHonorBersih']),
        ]),
        'konsolidasiTenagaAhli' => $konsolidasi_ta,
        'penyesuaianJurnal'     => $penyesuaian_jurnal,
        'syncData'              => $sync_data,
    ]);
}

// ─── POST /api/payroll/pegawai ────────────────────────────────────────────────
elseif ($method === 'POST' && $sub === 'pegawai' && $sub2 === '') {
    $user = require_auth();
    $pdo  = get_pdo();

    $entity_id      = trim($body['entityId'] ?? '');
    $nik            = trim($body['nik'] ?? '');
    $nama           = trim($body['nama'] ?? '');
    $jabatan        = trim($body['jabatan'] ?? '') ?: 'Karyawan';
    $status_kel     = trim($body['statusKeluarga'] ?? '') ?: 'TK/0';
    $ptkp           = parse_rupiah_num($body['ptkp'] ?? null, 54000000.0);
    $gaji_pokok     = parse_rupiah_num($body['gajiPokok'] ?? null, 0.0);
    $status         = strtoupper(trim($body['status'] ?? 'AKTIF'));
    if (!in_array($status, ['AKTIF', 'RESIGN', 'PENSIUN'])) {
        $status = 'AKTIF';
    }
    $is_active      = ($status === 'AKTIF');
    $tanggal_masuk  = !empty($body['tanggalMasuk']) ? trim($body['tanggalMasuk']) : null;
    $tanggal_resign = !empty($body['tanggalResign']) ? trim($body['tanggalResign']) : null;

    if (!$entity_id || !$nik || !$nama) {
        return error_response('Entitas, NIK/Kode, dan Nama Pegawai wajib diisi.', 400);
    }

    // Check unique NIK within entity
    $stmt = $pdo->prepare("SELECT id FROM Pegawai WHERE entityId = ? AND nik = ? LIMIT 1");
    $stmt->execute([$entity_id, $nik]);
    if ($stmt->fetchColumn()) {
        return error_response("Pegawai dengan NIK/Kode $nik sudah terdaftar pada entitas ini.", 409);
    }

    $id  = uuid4();
    $now = date('Y-m-d H:i:s');
    $tunjangan_jabatan  = parse_rupiah_num($body['tunjanganJabatan'] ?? null, 0.0);
    $tarif_transport    = parse_rupiah_num($body['tarifTransportHarian'] ?? null, 15000.0);
    if ($tarif_transport <= 0) {
        $tarif_transport = 15000.0;
    }
    $tunjangan_bpjs_kes = parse_rupiah_num($body['tunjanganBpjsKes'] ?? null, 0.0);
    $tunjangan_bpjs_tk  = parse_rupiah_num($body['tunjanganBpjsTk'] ?? null, 0.0);
    $bpjs_kes           = parse_rupiah_num($body['bpjsKesehatan'] ?? null, 0.0);
    $bpjs_tk            = parse_rupiah_num($body['bpjsKetenagakerjaan'] ?? null, 0.0);
    $potongan_bpjs      = isset($body['potonganBpjs']) && parse_rupiah_num($body['potonganBpjs'], 0.0) > 0
        ? parse_rupiah_num($body['potonganBpjs'])
        : ($bpjs_kes + $bpjs_tk);

    $pdo->prepare(
        "INSERT INTO Pegawai (id, entityId, nik, nama, jabatan, statusKeluarga, ptkp, gajiPokok, tunjanganJabatan, tarifTransportHarian, tunjanganBpjsKes, tunjanganBpjsTk, bpjsKesehatan, bpjsKetenagakerjaan, potonganBpjs, isActive, status, tanggalResign, tanggalMasuk, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )->execute([
        $id, $entity_id, $nik, $nama, $jabatan, $status_kel, $ptkp, $gaji_pokok,
        $tunjangan_jabatan, $tarif_transport, $tunjangan_bpjs_kes, $tunjangan_bpjs_tk, $bpjs_kes, $bpjs_tk, $potongan_bpjs,
        $is_active ? 1 : 0, $status, $tanggal_resign, $tanggal_masuk, $now, $now
    ]);

    log_activity($user['id'], "Tambah Pegawai Tetap: $nama ($nik) - $jabatan", 'FINANCIAL_CHANGE', [
        'pegawaiId' => $id, 'entityId' => $entity_id,
    ]);

    $stmt = $pdo->prepare("SELECT * FROM Pegawai WHERE id = ?");
    $stmt->execute([$id]);
    $pegawai = $stmt->fetch(PDO::FETCH_ASSOC);

    json_response(['success' => true, 'data' => $pegawai]);
}

// ─── POST /api/payroll/pegawai/batch-transport ──────────────────────────────
elseif ($method === 'POST' && $sub === 'pegawai' && $sub2 === 'batch-transport') {
    $user = require_auth();
    $pdo  = get_pdo();

    $entity_id       = trim($body['entityId'] ?? '');
    $tarif_transport = parse_rupiah_num($body['tarifTransportHarian'] ?? null, 15000.0);
    if ($tarif_transport < 0) $tarif_transport = 15000.0;

    if (!$entity_id) {
        return error_response('Entitas wajib dipilih.', 400);
    }

    $now = date('Y-m-d H:i:s');
    $stmt = $pdo->prepare("UPDATE Pegawai SET tarifTransportHarian = ?, updatedAt = ? WHERE entityId = ?");
    $stmt->execute([$tarif_transport, $now, $entity_id]);
    $affected = $stmt->rowCount();

    log_activity(
        $user['id'],
        "Update Tarif Transport Standar Master Pegawai: " . fmt_rp_payroll($tarif_transport) . "/hari untuk $affected pegawai",
        'FINANCIAL_CHANGE',
        ['entityId' => $entity_id, 'tarifTransport' => $tarif_transport, 'count' => $affected]
    );

    json_response([
        'success'  => true,
        'affected' => $affected,
        'message'  => "Berhasil memperbarui tarif transport menjadi " . fmt_rp_payroll($tarif_transport) . " per hari untuk {$affected} pegawai.",
    ]);
}

// ─── POST /api/payroll/pegawai/single-transport ─────────────────────────────
elseif ($method === 'POST' && $sub === 'pegawai' && $sub2 === 'single-transport') {
    $user = require_auth();
    $pdo  = get_pdo();

    $pegawai_id      = trim($body['pegawaiId'] ?? '');
    $tarif_transport = parse_rupiah_num($body['tarifTransportHarian'] ?? null, 15000.0);
    if ($tarif_transport < 0) $tarif_transport = 15000.0;

    if (!$pegawai_id) {
        return error_response('ID Pegawai wajib diisi.', 400);
    }

    $now = date('Y-m-d H:i:s');
    $stmt = $pdo->prepare("UPDATE Pegawai SET tarifTransportHarian = ?, updatedAt = ? WHERE id = ?");
    $stmt->execute([$tarif_transport, $now, $pegawai_id]);

    log_activity(
        $user['id'],
        "Update Tarif Transport Pegawai ($pegawai_id): " . fmt_rp_payroll($tarif_transport) . "/hari",
        'FINANCIAL_CHANGE',
        ['pegawaiId' => $pegawai_id, 'tarifTransport' => $tarif_transport]
    );

    json_response([
        'success' => true,
        'message' => "Berhasil memperbarui tarif transport menjadi " . fmt_rp_payroll($tarif_transport) . " per hari.",
    ]);
}

// ─── PUT /api/payroll/pegawai/{id} ────────────────────────────────────────────
elseif ($method === 'PUT' && $sub === 'pegawai' && $sub2 !== '') {
    $user = require_auth();
    $pdo  = get_pdo();
    $id   = $sub2;

    $stmt = $pdo->prepare("SELECT * FROM Pegawai WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$existing) return error_response('Data pegawai tidak ditemukan.', 404);

    $nik                = trim($body['nik'] ?? $existing['nik']);
    $nama               = trim($body['nama'] ?? $existing['nama']);
    $jabatan            = trim($body['jabatan'] ?? $existing['jabatan']) ?: 'Karyawan';
    $status_kel         = trim($body['statusKeluarga'] ?? $existing['statusKeluarga']) ?: 'TK/0';
    $ptkp               = isset($body['ptkp']) ? parse_rupiah_num($body['ptkp'], (float)$existing['ptkp']) : (float)$existing['ptkp'];
    $gaji_pokok         = isset($body['gajiPokok']) ? parse_rupiah_num($body['gajiPokok'], (float)$existing['gajiPokok']) : (float)$existing['gajiPokok'];
    $tunjangan_jabatan  = isset($body['tunjanganJabatan']) ? parse_rupiah_num($body['tunjanganJabatan'], (float)$existing['tunjanganJabatan']) : (float)$existing['tunjanganJabatan'];
    $tarif_transport    = isset($body['tarifTransportHarian']) ? parse_rupiah_num($body['tarifTransportHarian'], (float)($existing['tarifTransportHarian'] ?? 15000.0)) : (float)($existing['tarifTransportHarian'] ?? 15000.0);
    if ($tarif_transport <= 0) {
        $tarif_transport = 15000.0;
    }
    $tunjangan_bpjs_kes = array_key_exists('tunjanganBpjsKes', $body) ? parse_rupiah_num($body['tunjanganBpjsKes'], (float)($existing['tunjanganBpjsKes'] ?? 0)) : (float)($existing['tunjanganBpjsKes'] ?? 0);
    $tunjangan_bpjs_tk  = array_key_exists('tunjanganBpjsTk', $body) ? parse_rupiah_num($body['tunjanganBpjsTk'], (float)($existing['tunjanganBpjsTk'] ?? 0)) : (float)($existing['tunjanganBpjsTk'] ?? 0);
    $bpjs_kes           = array_key_exists('bpjsKesehatan', $body) ? parse_rupiah_num($body['bpjsKesehatan'], (float)($existing['bpjsKesehatan'] ?? 0)) : (float)($existing['bpjsKesehatan'] ?? 0);
    $bpjs_tk            = array_key_exists('bpjsKetenagakerjaan', $body) ? parse_rupiah_num($body['bpjsKetenagakerjaan'], (float)($existing['bpjsKetenagakerjaan'] ?? 0)) : (float)($existing['bpjsKetenagakerjaan'] ?? 0);
    $potongan_bpjs      = array_key_exists('potonganBpjs', $body) && parse_rupiah_num($body['potonganBpjs'], 0.0) > 0
        ? parse_rupiah_num($body['potonganBpjs'])
        : (float)($existing['potonganBpjs'] ?? ($bpjs_kes + $bpjs_tk));
    
    $status            = isset($body['status']) ? strtoupper(trim($body['status'])) : ($existing['status'] ?? 'AKTIF');
    if (!in_array($status, ['AKTIF', 'RESIGN', 'PENSIUN'])) {
        $status = 'AKTIF';
    }
    $is_active         = ($status === 'AKTIF');

    $tanggal_resign    = array_key_exists('tanggalResign', $body)
        ? (!empty($body['tanggalResign']) ? trim($body['tanggalResign']) : null)
        : ($existing['tanggalResign'] ?? null);
    if ($status === 'AKTIF' && empty($body['tanggalResign'])) {
        $tanggal_resign = null;
    }

    $tanggal_masuk     = array_key_exists('tanggalMasuk', $body)
        ? (!empty($body['tanggalMasuk']) ? trim($body['tanggalMasuk']) : null)
        : ($existing['tanggalMasuk'] ?? null);

    if (!$nik || !$nama) return error_response('NIK/Kode dan Nama Pegawai wajib diisi.', 400);

    // Check NIK uniqueness if changed
    if ($existing['nik'] !== $nik) {
        $stmt = $pdo->prepare("SELECT id FROM Pegawai WHERE entityId = ? AND nik = ? AND id != ? LIMIT 1");
        $stmt->execute([$existing['entityId'], $nik, $id]);
        if ($stmt->fetchColumn()) {
            return error_response("Pegawai dengan NIK/Kode $nik sudah terdaftar pada entitas ini.", 409);
        }
    }

    $now = date('Y-m-d H:i:s');
    $pdo->prepare(
        "UPDATE Pegawai SET nik=?, nama=?, jabatan=?, statusKeluarga=?, ptkp=?, gajiPokok=?, tunjanganJabatan=?, tarifTransportHarian=?, tunjanganBpjsKes=?, tunjanganBpjsTk=?, bpjsKesehatan=?, bpjsKetenagakerjaan=?, potonganBpjs=?, isActive=?, status=?, tanggalResign=?, tanggalMasuk=?, updatedAt=? WHERE id=?"
    )->execute([
        $nik, $nama, $jabatan, $status_kel, $ptkp, $gaji_pokok, $tunjangan_jabatan, $tarif_transport,
        $tunjangan_bpjs_kes, $tunjangan_bpjs_tk, $bpjs_kes, $bpjs_tk, $potongan_bpjs,
        $is_active ? 1 : 0, $status, $tanggal_resign, $tanggal_masuk, $now, $id
    ]);

    log_activity($user['id'], "Update Pegawai Tetap: $nama ($nik)", 'FINANCIAL_CHANGE', ['pegawaiId' => $id]);

    $stmt = $pdo->prepare("SELECT * FROM Pegawai WHERE id = ?");
    $stmt->execute([$id]);
    $updated = $stmt->fetch(PDO::FETCH_ASSOC);
    json_response(['success' => true, 'data' => $updated]);
}

// ─── DELETE /api/payroll/pegawai/{id} ─────────────────────────────────────────
elseif ($method === 'DELETE' && $sub === 'pegawai' && $sub2 !== '') {
    $user = require_auth();
    $pdo  = get_pdo();
    $id   = $sub2;

    $stmt = $pdo->prepare("SELECT id, nama, nik, entityId FROM Pegawai WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$existing) return error_response('Data pegawai tidak ditemukan.', 404);

    // Larangan Menghapus Data: Karyawan yang memiliki riwayat gaji tidak boleh dihapus dari sistem
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM GajiPegawaiBulanan WHERE pegawaiId = ?");
    $stmt->execute([$id]);
    $gaji_count = (int)$stmt->fetchColumn();
    if ($gaji_count > 0) {
        return error_response(
            "Karyawan {$existing['nama']} tidak boleh dihapus karena memiliki {$gaji_count} riwayat penggajian yang harus diarsip untuk laporan keuangan & pajak tahunan. Silakan ubah status menjadi RESIGN atau PENSIUN.",
            422
        );
    }

    $pdo->prepare("DELETE FROM Pegawai WHERE id = ?")->execute([$id]);

    log_activity($user['id'], "Hapus Pegawai Tetap: {$existing['nama']} ({$existing['nik']})", 'FINANCIAL_CHANGE', [
        'pegawaiId' => $id, 'entityId' => $existing['entityId'],
    ]);
    json_response(['success' => true]);
}

// ─── POST /api/payroll/gaji/bulk-generate ─────────────────────────────────────
elseif ($method === 'POST' && $sub === 'gaji' && $sub2 === 'bulk-generate') {
    $user = require_auth();
    $pdo  = get_pdo();

    $entity_id          = trim($body['entityId'] ?? '');
    $bulan              = (int)($body['bulan'] ?? 0);
    $tahun              = (int)($body['tahun'] ?? 0);
    $default_hari_kerja = (int)parse_rupiah_num($body['defaultHariKerja'] ?? null, 20.0);
    if ($default_hari_kerja <= 0) $default_hari_kerja = 20;
    $overwrite          = !empty($body['overwrite']);
    $auto_calculate_pph = isset($body['autoCalculatePph']) ? !empty($body['autoCalculatePph']) : true;

    if (!$entity_id || !$bulan || !$tahun) {
        return error_response('Entitas, Bulan, dan Tahun wajib diisi.', 400);
    }

    // Ambil seluruh pegawai di entitas ini
    $stmt = $pdo->prepare("SELECT * FROM Pegawai WHERE entityId = ? ORDER BY nama ASC");
    $stmt->execute([$entity_id]);
    $all_pegawai = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (empty($all_pegawai)) {
        return error_response('Belum ada pegawai terdaftar di master database entitas ini.', 404);
    }

    // Ambil data gaji yang sudah ada di bulan/tahun ini
    $stmt = $pdo->prepare("SELECT id, pegawaiId FROM GajiPegawaiBulanan WHERE entityId = ? AND bulan = ? AND tahun = ?");
    $stmt->execute([$entity_id, $bulan, $tahun]);
    $existing_gaji_rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $existing_gaji_map = []; // pegawaiId => gaji_id
    foreach ($existing_gaji_rows as $eg) {
        $existing_gaji_map[$eg['pegawaiId']] = $eg['id'];
    }

    $now = date('Y-m-d H:i:s');
    $count = 0;
    $skipped = 0;

    foreach ($all_pegawai as $p) {
        $pid = $p['id'];
        $has_existing = isset($existing_gaji_map[$pid]);

        // Cek eligibility: karyawan aktif atau yang resign sesudah/pada bulan target
        $eligible = is_pegawai_eligible_for_month($p, $tahun, $bulan, $has_existing);
        if (!$eligible) {
            $skipped++;
            continue;
        }

        if ($has_existing && !$overwrite) {
            $skipped++;
            continue;
        }

        $gp                  = (float)$p['gajiPokok'];
        $tj                  = (float)$p['tunjanganJabatan'];
        $tarif               = (float)($p['tarifTransportHarian'] ?: 15000.0);
        if ($tarif <= 0) $tarif = 15000.0;
        $hk                  = $default_hari_kerja;
        $tt                  = $hk * $tarif;
        $tbkes               = (float)($p['tunjanganBpjsKes'] ?? 0);
        $tbtk                = (float)($p['tunjanganBpjsTk'] ?? 0);
        $tb                  = $tbkes + $tbtk;
        $bkes                = (float)($p['bpjsKesehatan'] ?? 0);
        $btk                 = (float)($p['bpjsKetenagakerjaan'] ?? 0);
        $pb                  = (float)($p['potonganBpjs'] ?? ($bkes + $btk));
        if ($pb <= 0 && ($bkes > 0 || $btk > 0)) {
            $pb = $bkes + $btk;
        }

        $insentif            = 0.0;
        $thr                 = 0.0;
        $tunjangan_pph       = 0.0;
        $potongan_lain       = 0.0;

        // Pada bulan 12 (Desember): Tunjangan PPh dikalkulasikan dan diselesaikan sebagai akumulasi fasilitas PPh yang ditanggung perusahaan
        if ($bulan === 12) {
            $stmt_pph_prev = $pdo->prepare(
                "SELECT COALESCE(SUM(pph21), 0) FROM GajiPegawaiBulanan
                 WHERE pegawaiId = ? AND tahun = ? AND bulan BETWEEN 1 AND 11"
            );
            $stmt_pph_prev->execute([$pid, $tahun]);
            $sum_pph_jan_nov = (float)$stmt_pph_prev->fetchColumn();
            $calc_pph_des = hitung_pph21_ter($gp + $tj + $tt + $tb, $p['statusKeluarga'] ?? 'TK/0');
            $pph21_des = (float)$calc_pph_des['nominal'];
            $tunjangan_pph = $sum_pph_jan_nov + $pph21_des;
        }

        // Gaji Terlapor Pajak (Bruto): Akumulasi seluruh penghasilan kotor (Gaji + Seluruh Tunjangan) dasar PPh 21
        $total_kotor         = $gp + $tj + $tt + $tb + $tunjangan_pph;
        $total_pajak         = $total_kotor;

        $pph21               = 0.0;
        if ($auto_calculate_pph) {
            $calc_pph = hitung_pph21_ter($total_kotor, $p['statusKeluarga'] ?? 'TK/0');
            $pph21 = (float)$calc_pph['nominal'];
        }

        // Gaji Bersih / Take Home Pay (THP / Ditransfer):
        // THP = Gaji Pokok + Tunjangan Jabatan + Transport + Tunjangan Lainnya/Insentif - Potongan BPJS - Potongan Lain
        // (Tunjangan BPJS dan Tunjangan PPh tidak ikut dikirim ke rekening karyawan karena dibayarkan langsung ke lembaga terkait)
        $total_bersih        = max(0, $gp + $tj + $tt + $insentif + $thr - $pb - $potongan_lain);
        $catatan             = "Generated otomatis dari Master Data ({$hk} hari kerja" . ($auto_calculate_pph ? ", TER PPh 21 aktif" : "") . ")";

        if ($has_existing && $overwrite) {
            $existing_id = $existing_gaji_map[$pid];
            $pdo->prepare(
                "UPDATE GajiPegawaiBulanan
                 SET gajiPokok=?, tunjanganJabatan=?, hariKerja=?, tarifTransportHarian=?, tunjanganTransport=?,
                     insentif=?, tunjanganLainnya=?, thr=?, tunjanganBpjs=?, tunjanganBpjsKes=?,
                     tunjanganBpjsTk=?, tunjanganPph=?, bpjsKesehatan=?, bpjsKetenagakerjaan=?,
                     potonganBpjs=?, potonganLain=?, pph21=?, totalGajiKotor=?, totalGajiTerlaporPajak=?,
                     totalGajiBersih=?, catatan=?, updatedAt=?
                 WHERE id=?"
            )->execute([
                $gp, $tj, $hk, $tarif, $tt,
                $insentif, 0.0, $thr, $tb, $tbkes,
                $tbtk, $tunjangan_pph, $bkes, $btk,
                $pb, $potongan_lain, $pph21, $total_kotor, $total_pajak,
                $total_bersih, $catatan, $now, $existing_id
            ]);
        } else {
            $gaji_id = uuid4();
            $pdo->prepare(
                "INSERT INTO GajiPegawaiBulanan
                 (id, pegawaiId, entityId, bulan, tahun, gajiPokok, tunjanganJabatan, hariKerja,
                  tarifTransportHarian, tunjanganTransport, insentif, tunjanganLainnya, thr,
                  tunjanganBpjs, tunjanganBpjsKes, tunjanganBpjsTk, tunjanganPph, bpjsKesehatan,
                  bpjsKetenagakerjaan, potonganBpjs, potonganLain, pph21, totalGajiKotor,
                  totalGajiTerlaporPajak, totalGajiBersih, catatan, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )->execute([
                $gaji_id, $pid, $entity_id, $bulan, $tahun, $gp, $tj, $hk,
                $tarif, $tt, $insentif, 0.0, $thr,
                $tb, $tbkes, $tbtk, $tunjangan_pph, $bkes,
                $btk, $pb, $potongan_lain, $pph21, $total_kotor,
                $total_pajak, $total_bersih, $catatan, $now, $now
            ]);
        }
        $count++;
    }

    log_activity(
        $user['id'],
        "Generate Otomatis Gaji {$count} Pegawai Periode Bulan {$bulan}/{$tahun} (Standar {$default_hari_kerja} Hari Kerja)",
        'FINANCIAL_CHANGE',
        ['entityId' => $entity_id, 'bulan' => $bulan, 'tahun' => $tahun, 'count' => $count]
    );

    json_response([
        'success'        => true,
        'processedCount' => $count,
        'skippedCount'   => $skipped,
        'message'        => "Berhasil memproses gaji untuk {$count} pegawai periode bulan {$bulan}/{$tahun}.",
    ]);
}

// ─── POST /api/payroll/gaji ───────────────────────────────────────────────────
elseif ($method === 'POST' && $sub === 'gaji' && $sub2 === '') {
    $user = require_auth();
    $pdo  = get_pdo();

    $pegawai_id          = trim($body['pegawaiId'] ?? '');
    $entity_id           = trim($body['entityId'] ?? '');
    $bulan               = (int)($body['bulan'] ?? 0);
    $tahun               = (int)($body['tahun'] ?? 0);
    $gaji_pokok          = parse_rupiah_num($body['gajiPokok'] ?? null, 0.0);
    $tunjangan_jabatan   = parse_rupiah_num($body['tunjanganJabatan'] ?? null, 0.0);
    $hari_kerja          = (int)parse_rupiah_num($body['hariKerja'] ?? null, 0.0);
    $tarif_transport     = parse_rupiah_num($body['tarifTransportHarian'] ?? null, 15000.0);
    $tunjangan_transport = parse_rupiah_num($body['tunjanganTransport'] ?? null, 0.0);
    $insentif            = parse_rupiah_num($body['insentif'] ?? null, 0.0);
    $tunjangan_lainnya   = parse_rupiah_num($body['tunjanganLainnya'] ?? null, $insentif);
    $thr                 = parse_rupiah_num($body['thr'] ?? null, 0.0);
    $tunjangan_bpjs_kes  = parse_rupiah_num($body['tunjanganBpjsKes'] ?? null, 0.0);
    $tunjangan_bpjs_tk   = parse_rupiah_num($body['tunjanganBpjsTk'] ?? null, 0.0);
    $tunjangan_bpjs      = isset($body['tunjanganBpjs']) && parse_rupiah_num($body['tunjanganBpjs'], 0.0) > 0
        ? parse_rupiah_num($body['tunjanganBpjs'])
        : ($tunjangan_bpjs_kes + $tunjangan_bpjs_tk);
    $tunjangan_pph       = parse_rupiah_num($body['tunjanganPph'] ?? null, 0.0);
    $bpjs_kes            = parse_rupiah_num($body['bpjsKesehatan'] ?? null, 0.0);
    $bpjs_tk             = parse_rupiah_num($body['bpjsKetenagakerjaan'] ?? null, 0.0);
    $potongan_bpjs       = isset($body['potonganBpjs']) && parse_rupiah_num($body['potonganBpjs'], 0.0) > 0
        ? parse_rupiah_num($body['potonganBpjs'])
        : ($bpjs_kes + $bpjs_tk);
    $potongan_lain       = parse_rupiah_num($body['potonganLain'] ?? null, 0.0);
    $pph21               = parse_rupiah_num($body['pph21'] ?? null, 0.0);
    $catatan             = trim($body['catatan'] ?? '') ?: null;

    if (!$pegawai_id || !$entity_id || !$bulan || !$tahun) {
        return error_response('Pegawai, Entitas, Bulan, dan Tahun wajib diisi.', 400);
    }

    $stmt = $pdo->prepare("SELECT id, nama, nik, tarifTransportHarian FROM Pegawai WHERE id = ? LIMIT 1");
    $stmt->execute([$pegawai_id]);
    $pegawai = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$pegawai) return error_response('Pegawai tidak ditemukan.', 404);

    if ($tarif_transport <= 0) {
        $tarif_transport = (float)($pegawai['tarifTransportHarian'] ?? 15000.0);
        if ($tarif_transport <= 0) $tarif_transport = 15000.0;
    }
    if ($tunjangan_transport <= 0 && $hari_kerja > 0) {
        $tunjangan_transport = $hari_kerja * $tarif_transport;
    }

    $tunj_lain = max($insentif, $tunjangan_lainnya);

    // Pada bulan 12 (Desember): Tunjangan PPh dikalkulasikan dan diselesaikan sebagai akumulasi fasilitas PPh yang ditanggung perusahaan jika belum diisi manual
    if ($bulan === 12 && $tunjangan_pph <= 0 && empty($body['isTunjanganPphManual'])) {
        $stmt_pph_prev = $pdo->prepare(
            "SELECT COALESCE(SUM(pph21), 0) FROM GajiPegawaiBulanan
             WHERE pegawaiId = ? AND tahun = ? AND bulan BETWEEN 1 AND 11"
        );
        $stmt_pph_prev->execute([$pegawai_id, $tahun]);
        $sum_pph_prev = (float)$stmt_pph_prev->fetchColumn();
        if ($sum_pph_prev > 0 || $pph21 > 0) {
            $tunjangan_pph = $sum_pph_prev + $pph21;
        }
    }

    // Gaji Terlapor Pajak (Bruto): Akumulasi seluruh penghasilan kotor (Gaji + Seluruh Tunjangan) dasar PPh 21
    $total_kotor  = $gaji_pokok + $tunjangan_jabatan + $tunjangan_transport + $tunj_lain + $thr + $tunjangan_bpjs + $tunjangan_pph;
    $total_pajak  = $total_kotor;

    // Gaji Bersih / Take Home Pay (THP / Ditransfer): Nominal riil yang ditransfer ke rekening karyawan
    // THP = Gaji Pokok + Tunjangan Jabatan + Transport + Tunjangan Lainnya/Insentif - Potongan BPJS - Potongan Lain
    // (Tunjangan BPJS dan Tunjangan PPh tidak ikut dikirim ke rekening karyawan karena dibayarkan langsung ke lembaga terkait)
    $total_bersih = max(0, $gaji_pokok + $tunjangan_jabatan + $tunjangan_transport + $tunj_lain + $thr - $potongan_bpjs - $potongan_lain);
    $now          = date('Y-m-d H:i:s');

    // Check existing (upsert)
    $stmt = $pdo->prepare("SELECT id FROM GajiPegawaiBulanan WHERE pegawaiId = ? AND bulan = ? AND tahun = ? LIMIT 1");
    $stmt->execute([$pegawai_id, $bulan, $tahun]);
    $existing_id = $stmt->fetchColumn();

    if ($existing_id) {
        $pdo->prepare(
            "UPDATE GajiPegawaiBulanan
             SET gajiPokok=?, tunjanganJabatan=?, hariKerja=?, tarifTransportHarian=?, tunjanganTransport=?,
                 insentif=?, tunjanganLainnya=?, thr=?, tunjanganBpjs=?, tunjanganBpjsKes=?,
                 tunjanganBpjsTk=?, tunjanganPph=?, bpjsKesehatan=?, bpjsKetenagakerjaan=?,
                 potonganBpjs=?, potonganLain=?, pph21=?, totalGajiKotor=?, totalGajiTerlaporPajak=?,
                 totalGajiBersih=?, catatan=?, updatedAt=?
             WHERE id=?"
        )->execute([
            $gaji_pokok, $tunjangan_jabatan, $hari_kerja, $tarif_transport, $tunjangan_transport,
            $insentif, $tunjangan_lainnya, $thr, $tunjangan_bpjs, $tunjangan_bpjs_kes,
            $tunjangan_bpjs_tk, $tunjangan_pph, $bpjs_kes, $bpjs_tk,
            $potongan_bpjs, $potongan_lain, $pph21, $total_kotor, $total_pajak,
            $total_bersih, $catatan, $now, $existing_id
        ]);
        $gaji_id = $existing_id;
    } else {
        $gaji_id = uuid4();
        $pdo->prepare(
            "INSERT INTO GajiPegawaiBulanan
             (id, pegawaiId, entityId, bulan, tahun, gajiPokok, tunjanganJabatan, hariKerja,
              tarifTransportHarian, tunjanganTransport, insentif, tunjanganLainnya, thr,
              tunjanganBpjs, tunjanganBpjsKes, tunjanganBpjsTk, tunjanganPph, bpjsKesehatan,
              bpjsKetenagakerjaan, potonganBpjs, potonganLain, pph21, totalGajiKotor,
              totalGajiTerlaporPajak, totalGajiBersih, catatan, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )->execute([
            $gaji_id, $pegawai_id, $entity_id, $bulan, $tahun, $gaji_pokok, $tunjangan_jabatan, $hari_kerja,
            $tarif_transport, $tunjangan_transport, $insentif, $tunjangan_lainnya, $thr,
            $tunjangan_bpjs, $tunjangan_bpjs_kes, $tunjangan_bpjs_tk, $tunjangan_pph, $bpjs_kes,
            $bpjs_tk, $potongan_bpjs, $potongan_lain, $pph21, $total_kotor,
            $total_pajak, $total_bersih, $catatan, $now, $now
        ]);
    }

    log_activity($user['id'],
        "Input Gaji Pegawai {$pegawai['nama']} Bulan $bulan/$tahun (Kotor: Rp " . number_format((int)$total_kotor, 0, ',', '.') . ", Bersih: Rp " . number_format((int)$total_bersih, 0, ',', '.') . ")",
        'FINANCIAL_CHANGE',
        ['gajiId' => $gaji_id, 'pegawaiId' => $pegawai_id, 'bulan' => $bulan, 'tahun' => $tahun]
    );

    $stmt = $pdo->prepare("SELECT * FROM GajiPegawaiBulanan WHERE id = ?");
    $stmt->execute([$gaji_id]);
    $gaji = $stmt->fetch(PDO::FETCH_ASSOC);
    json_response(['success' => true, 'data' => $gaji]);
}

// ─── DELETE /api/payroll/gaji/{id} ───────────────────────────────────────────
elseif ($method === 'DELETE' && $sub === 'gaji' && $sub2 !== '') {
    $user = require_auth();
    $pdo  = get_pdo();
    $id   = $sub2;

    $stmt = $pdo->prepare(
        "SELECT g.id, g.bulan, g.tahun, p.nama AS pegawai_nama
         FROM GajiPegawaiBulanan g
         JOIN Pegawai p ON g.pegawaiId = p.id
         WHERE g.id = ? LIMIT 1"
    );
    $stmt->execute([$id]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$existing) return error_response('Data gaji bulanan tidak ditemukan.', 404);

    $pdo->prepare("DELETE FROM GajiPegawaiBulanan WHERE id = ?")->execute([$id]);

    log_activity($user['id'],
        "Hapus Gaji Pegawai: {$existing['pegawai_nama']} Bulan {$existing['bulan']}/{$existing['tahun']}",
        'FINANCIAL_CHANGE', ['gajiId' => $id]
    );
    json_response(['success' => true]);
}

// ─── POST /api/payroll/honor ──────────────────────────────────────────────────
elseif ($method === 'POST' && $sub === 'honor' && $sub2 === '') {
    $user = require_auth();
    $pdo  = get_pdo();

    $id              = trim($body['id'] ?? '') ?: null;
    $entity_id       = trim($body['entityId'] ?? '');
    $rekanan_id      = trim($body['rekananId'] ?? '') ?: null;
    $nik             = trim($body['nik'] ?? '');
    $nama            = trim($body['nama'] ?? '');
    $npwp            = trim($body['npwp'] ?? '') ?: null;
    $uraian          = trim($body['uraian'] ?? '');
    $tanggal_str     = trim($body['tanggal'] ?? '');
    $nominal_honor   = parse_rupiah_num($body['nominalHonor'] ?? null, 0.0);
    $tarif_pph       = parse_rupiah_num($body['tarifPph21Persen'] ?? null, 0.0);
    $pph21           = parse_rupiah_num($body['pph21'] ?? null, 0.0);
    $project_id      = trim($body['projectId'] ?? '') ?: null;
    $nama_proyek     = trim($body['namaProyek'] ?? '') ?: null;
    $no_bukti        = trim($body['noBukti'] ?? '') ?: null;

    // Jika rekananId dipilih, ambil NIK/Nama/NPWP dari database jika belum terisi
    $final_rekanan_id = $rekanan_id;
    if ($rekanan_id) {
        $stmt = $pdo->prepare("SELECT id, nama, nik, npwp FROM Rekanan WHERE id = ? LIMIT 1");
        $stmt->execute([$rekanan_id]);
        $r = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($r) {
            if (!$nama) $nama = $r['nama'];
            if (!$nik)  $nik  = $r['nik'] ?? '';
            if (!$npwp) $npwp = $r['npwp'];
        }
    }

    if (!$entity_id || !$nik || !$nama || !$uraian || !$tanggal_str || $nominal_honor <= 0) {
        return error_response('Entitas, Tenaga Ahli (NIK & Nama), Uraian Tugas, Tanggal, dan Nominal Honor (> 0) wajib diisi.', 400);
    }

    // Jika projectId ada tapi namaProyek belum diisi
    if (!$nama_proyek && $project_id) {
        $stmt = $pdo->prepare("SELECT code, name FROM Project WHERE id = ? LIMIT 1");
        $stmt->execute([$project_id]);
        $proj = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($proj) $nama_proyek = "{$proj['code']} - {$proj['name']}";
    }

    try {
        [$bulan, $tahun, $tanggal_db] = tenaga_ahli_periode_honor($body, $tanggal_str);
    } catch (InvalidArgumentException $e) {
        return error_response($e->getMessage(), 400);
    }
    $nominal_bersih = max(0, $nominal_honor - $pph21);

    // Jika rekananId belum ada, cek match NIK/NPWP
    if (!$final_rekanan_id) {
        $or_sql = ['nik = ?'];
        $bind   = [$nik];
        if ($npwp) { $or_sql[] = 'npwp = ?'; $bind[] = $npwp; }
        $stmt = $pdo->prepare(
            "SELECT id FROM Rekanan WHERE tipe = 'TENAGA_AHLI' AND (" . implode(' OR ', $or_sql) . ") LIMIT 1"
        );
        $stmt->execute($bind);
        $matched = $stmt->fetchColumn();
        if ($matched) $final_rekanan_id = $matched;
    }

    $now = date('Y-m-d H:i:s');
    if ($id) {
        // UPDATE
        $pdo->prepare(
            "UPDATE HonorTenagaAhli
             SET entityId=?, rekananId=?, nik=?, nama=?, npwp=?, uraian=?, tanggal=?,
                 bulan=?, tahun=?, nominalHonor=?, tarifPph21Persen=?, pph21=?, nominalBersih=?,
                 projectId=?, namaProyek=?, noBukti=?, updatedAt=?
             WHERE id=?"
        )->execute([$entity_id, $final_rekanan_id, $nik, $nama, $npwp, $uraian, $tanggal_db,
                    $bulan, $tahun, $nominal_honor, $tarif_pph, $pph21, $nominal_bersih,
                    $project_id, $nama_proyek, $no_bukti, $now, $id]);

        log_activity($user['id'],
            "Update Honorarium Tenaga Ahli: $nama - Rp " . number_format((int)$nominal_honor, 0, ',', '.'),
            'FINANCIAL_CHANGE', ['honorId' => $id, 'entityId' => $entity_id]
        );
        $honor_id = $id;
    } else {
        // CREATE
        $honor_id = uuid4();
        $pdo->prepare(
            "INSERT INTO HonorTenagaAhli
             (id, entityId, rekananId, nik, nama, npwp, uraian, tanggal,
              bulan, tahun, nominalHonor, tarifPph21Persen, pph21, nominalBersih,
              projectId, namaProyek, noBukti, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )->execute([$honor_id, $entity_id, $final_rekanan_id, $nik, $nama, $npwp, $uraian, $tanggal_db,
                    $bulan, $tahun, $nominal_honor, $tarif_pph, $pph21, $nominal_bersih,
                    $project_id, $nama_proyek, $no_bukti, $now, $now]);

        log_activity($user['id'],
            "Input Honorarium Tenaga Ahli: $nama - Rp " . number_format((int)$nominal_honor, 0, ',', '.'),
            'FINANCIAL_CHANGE', ['honorId' => $honor_id, 'entityId' => $entity_id]
        );
    }

    $stmt = $pdo->prepare("SELECT * FROM HonorTenagaAhli WHERE id = ?");
    $stmt->execute([$honor_id]);
    $honor = $stmt->fetch(PDO::FETCH_ASSOC);
    json_response(['success' => true, 'data' => $honor]);
}

// ─── DELETE /api/payroll/honor/{id} ──────────────────────────────────────────
elseif ($method === 'DELETE' && $sub === 'honor' && $sub2 !== '') {
    $user = require_auth();
    $pdo  = get_pdo();
    $id   = $sub2;

    $stmt = $pdo->prepare("SELECT id, nama, nominalHonor, entityId FROM HonorTenagaAhli WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$existing) return error_response('Data honorarium tidak ditemukan.', 404);

    $pdo->prepare("DELETE FROM HonorTenagaAhli WHERE id = ?")->execute([$id]);

    log_activity($user['id'],
        "Hapus Honorarium Tenaga Ahli: {$existing['nama']} - Rp " . number_format((int)$existing['nominalHonor'], 0, ',', '.'),
        'FINANCIAL_CHANGE', ['honorId' => $id, 'entityId' => $existing['entityId']]
    );
    json_response(['success' => true]);
}

// ─── POST /api/payroll/copy-gaji ─────────────────────────────────────────────
elseif ($method === 'POST' && $sub === 'copy-gaji') {
    $user = require_auth();
    $pdo  = get_pdo();

    $entity_id    = trim($body['entityId'] ?? '');
    $target_year  = (int)($body['targetYear'] ?? 0);
    $target_month = (int)($body['targetMonth'] ?? 0);

    if (!$entity_id || !$target_year || !$target_month) {
        return error_response('entityId, targetYear, targetMonth wajib diisi.', 400);
    }

    $source_month = $target_month === 1 ? 12 : $target_month - 1;
    $source_year  = $target_month === 1 ? $target_year - 1 : $target_year;

    $stmt = $pdo->prepare(
        "SELECT * FROM GajiPegawaiBulanan WHERE entityId = ? AND tahun = ? AND bulan = ?"
    );
    $stmt->execute([$entity_id, $source_year, $source_month]);
    $prev_gaji_list = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $now   = date('Y-m-d H:i:s');
    $count = 0;

    if (empty($prev_gaji_list)) {
        // Buat dari master pegawai aktif & eligible
        $stmt = $pdo->prepare(
            "SELECT * FROM Pegawai WHERE entityId = ? AND (status = 'AKTIF' OR (isActive = 1 AND (status IS NULL OR status = '')))"
        );
        $stmt->execute([$entity_id]);
        $active_pegawai = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($active_pegawai)) {
            return error_response('Belum ada pegawai aktif di master database entitas ini.', 404);
        }

        foreach ($active_pegawai as $p) {
            // Cek eligibility untuk bulan & tahun target
            if (!is_pegawai_eligible_for_month($p, $target_year, $target_month, false)) {
                continue;
            }

            // Cek existing
            $stmt = $pdo->prepare(
                "SELECT id FROM GajiPegawaiBulanan WHERE pegawaiId = ? AND bulan = ? AND tahun = ? LIMIT 1"
            );
            $stmt->execute([$p['id'], $target_month, $target_year]);
            if ($stmt->fetchColumn()) continue;

            $gp = (float)$p['gajiPokok'];
            $tj = (float)$p['tunjanganJabatan'];
            $tarif = (float)($p['tarifTransportHarian'] ?: 15000.0);
            $hk = 20;
            $tt = $hk * $tarif;
            $tbk = (float)($p['tunjanganBpjsKes'] ?? 0);
            $tbtk = (float)($p['tunjanganBpjsTk'] ?? 0);
            $tb = $tbk + $tbtk;
            $bkes = (float)($p['bpjsKesehatan'] ?? 0);
            $btk = (float)($p['bpjsKetenagakerjaan'] ?? 0);
            $pb = (float)($p['potonganBpjs'] ?? ($bkes + $btk));
            if ($pb <= 0 && ($bkes > 0 || $btk > 0)) $pb = $bkes + $btk;
            $kotor = $gp + $tj + $tt + $tb;
            $bersih = max(0, $gp + $tj + $tt - $pb);
            $pdo->prepare(
                "INSERT INTO GajiPegawaiBulanan
                 (id, entityId, pegawaiId, bulan, tahun, gajiPokok, tunjanganJabatan, hariKerja,
                  tarifTransportHarian, tunjanganTransport, tunjanganBpjs, tunjanganBpjsKes, tunjanganBpjsTk,
                  bpjsKesehatan, bpjsKetenagakerjaan, potonganBpjs, totalGajiKotor, totalGajiTerlaporPajak,
                  totalGajiBersih, catatan, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )->execute([uuid4(), $entity_id, $p['id'], $target_month, $target_year,
                        $gp, $tj, $hk, $tarif, $tt, $tb, $tbk, $tbtk, $bkes, $btk, $pb,
                        $kotor, $kotor, $bersih, 'Dibuat otomatis dari Master Data Karyawan (Standar 20 hari kerja)', $now, $now]);
            $count++;
        }

        log_activity($user['id'],
            "Generate otomatis gaji $count pegawai dari master untuk bulan $target_month/$target_year",
            'FINANCIAL_CHANGE', ['entityId' => $entity_id, 'targetYear' => $target_year, 'targetMonth' => $target_month]
        );

        json_response([
            'success' => true, 'count' => $count,
            'message' => "$count pegawai berhasil dibuat dari master data.",
        ]);
    }

    foreach ($prev_gaji_list as $prev) {
        // Cek apakah pegawai masih aktif/eligible di bulan target (tidak resign sebelum bulan target)
        $stmt = $pdo->prepare("SELECT * FROM Pegawai WHERE id = ? LIMIT 1");
        $stmt->execute([$prev['pegawaiId']]);
        $peg = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($peg && !is_pegawai_eligible_for_month($peg, $target_year, $target_month, false)) {
            continue; // Otomatis lewati karyawan yang sudah resign untuk bulan target
        }

        $stmt = $pdo->prepare(
            "SELECT id FROM GajiPegawaiBulanan WHERE pegawaiId = ? AND bulan = ? AND tahun = ? LIMIT 1"
        );
        $stmt->execute([$prev['pegawaiId'], $target_month, $target_year]);
        if ($stmt->fetchColumn()) continue;

        $pdo->prepare(
            "INSERT INTO GajiPegawaiBulanan
             (id, entityId, pegawaiId, bulan, tahun, gajiPokok, tunjanganJabatan, hariKerja,
              tarifTransportHarian, tunjanganTransport, insentif, tunjanganLainnya, thr,
              tunjanganBpjs, tunjanganBpjsKes, tunjanganBpjsTk, tunjanganPph, bpjsKesehatan,
              bpjsKetenagakerjaan, potonganBpjs, potonganLain, pph21, totalGajiKotor,
              totalGajiTerlaporPajak, totalGajiBersih, catatan, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )->execute([
            uuid4(), $entity_id, $prev['pegawaiId'], $target_month, $target_year,
            $prev['gajiPokok'], $prev['tunjanganJabatan'], (int)($prev['hariKerja'] ?? 0),
            (float)($prev['tarifTransportHarian'] ?? 15000), (float)($prev['tunjanganTransport'] ?? 0),
            (float)($prev['insentif'] ?? 0), (float)($prev['tunjanganLainnya'] ?? 0), (float)($prev['thr'] ?? 0),
            (float)($prev['tunjanganBpjs'] ?? 0), (float)($prev['tunjanganBpjsKes'] ?? 0), (float)($prev['tunjanganBpjsTk'] ?? 0),
            (float)($prev['tunjanganPph'] ?? 0), (float)($prev['bpjsKesehatan'] ?? 0),
            (float)($prev['bpjsKetenagakerjaan'] ?? 0), (float)($prev['potonganBpjs'] ?? 0),
            (float)($prev['potonganLain'] ?? 0), (float)($prev['pph21'] ?? 0),
            (float)($prev['totalGajiKotor'] ?? 0), (float)($prev['totalGajiTerlaporPajak'] ?? ($prev['totalGajiKotor'] ?? 0)),
            (float)($prev['totalGajiBersih'] ?? 0),
            "Disalin dari bulan $source_month/$source_year", $now, $now
        ]);
        $count++;
    }

    log_activity($user['id'],
        "Salin gaji $count pegawai dari bulan $source_month/$source_year ke bulan $target_month/$target_year",
        'FINANCIAL_CHANGE', ['entityId' => $entity_id, 'targetYear' => $target_year, 'targetMonth' => $target_month]
    );

    json_response([
        'success' => true, 'count' => $count,
        'message' => "$count gaji pegawai berhasil disalin dari bulan $source_month/$source_year.",
    ]);
}

elseif ($method === 'POST' && $sub === 'gaji-kontrak' && $sub2 === '') {
    require __DIR__ . '/payroll-gaji-kontrak.php';
}

// ─── POST /api/payroll/tenaga-ahli ────────────────────────────────────────────
elseif ($method === 'POST' && $sub === 'tenaga-ahli' && $sub2 === '') {
    $user = require_auth();
    $pdo  = get_pdo();

    $id                    = trim($body['id'] ?? '') ?: null;
    $nama                  = trim($body['nama'] ?? '');
    $nik                   = trim($body['nik'] ?? '');
    $npwp                  = trim($body['npwp'] ?? '') ?: null;
    $kategori              = trim($body['kategori'] ?? '') ?: null;
    $ptkp                  = trim($body['ptkp'] ?? 'TK/0') ?: 'TK/0';
    $entity_id             = trim($body['entityId'] ?? '') ?: null;
    $project_id            = trim($body['projectId'] ?? '') ?: null;
    $tanggal_mulai_tugas   = trim($body['tanggalMulaiTugas'] ?? '') ?: null;
    $tanggal_selesai_tugas = trim($body['tanggalSelesaiTugas'] ?? '') ?: null;
    $is_turun_lapangan     = isset($body['isTurunLapangan']) ? ($body['isTurunLapangan'] ? 1 : 0) : 1;
    $nominal_honor_bulanan = parse_rupiah_num($body['nominalHonorBulanan'] ?? null, 0.0);

    if (!$nama || !$nik) {
        return error_response('Nama Lengkap dan NIK Tenaga Ahli wajib diisi.', 400);
    }

    $clean_nik = preg_replace('/\D/', '', $nik);
    if (strlen($clean_nik) !== 16) {
        return error_response('NIK Tenaga Ahli harus berupa 16 digit angka KTP.', 400);
    }

    ensure_tenaga_ahli_tables($pdo);

    // Parse daftar penugasan multi-proyek
    $editing_person = null;
    if ($id) {
        $stmt = $pdo->prepare("SELECT id, nik FROM Rekanan WHERE id = ? AND tipe = 'TENAGA_AHLI'");
        $stmt->execute([$id]);
        $editing_person = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$editing_person) return error_response('Tenaga ahli tidak ditemukan.', 404);
        $stmt = $pdo->prepare("SELECT id FROM Rekanan WHERE tipe = 'TENAGA_AHLI' AND nik = ? AND id <> ? LIMIT 1");
        $stmt->execute([$clean_nik, $id]);
        if ($stmt->fetchColumn()) return error_response('NIK sudah digunakan tenaga ahli lain. Periksa kembali data diri.', 409);
    }
    $proyek_list_raw = $body['proyekList'] ?? null;
    if (is_string($proyek_list_raw)) {
        $proyek_list = json_decode($proyek_list_raw, true) ?: [];
    } elseif (is_array($proyek_list_raw)) {
        $proyek_list = $proyek_list_raw;
    } else {
        $proyek_list = [];
    }

    // Fallback jika dikirim via single project fields
    if (empty($proyek_list) && $project_id) {
        $proyek_list = [[
            'projectId'           => $project_id,
            'tanggalMulaiTugas'   => $tanggal_mulai_tugas,
            'tanggalSelesaiTugas' => $tanggal_selesai_tugas,
            'isTurunLapangan'     => $is_turun_lapangan,
            'nominalHonorBulanan' => $nominal_honor_bulanan,
        ]];
    }

    if (empty($proyek_list)) {
        return error_response('Minimal 1 Penugasan Proyek wajib diisi.', 400);
    }

    $validated_proyek_list = [];
    $seen_projects = [];
    foreach ($proyek_list as $pl) {
        $pl_proj_id = trim($pl['projectId'] ?? '');
        $pl_mulai   = trim($pl['tanggalMulaiTugas'] ?? '');
        $pl_selesai = trim($pl['tanggalSelesaiTugas'] ?? '');
        $pl_turun   = isset($pl['isTurunLapangan']) ? ($pl['isTurunLapangan'] ? 1 : 0) : 1;
        $pl_honor   = parse_rupiah_num($pl['nominalHonorBulanan'] ?? null, 0.0);

        if (!$pl_proj_id) {
            return error_response('Kode Proyek Penugasan wajib dipilih.', 400);
        }
        if (isset($seen_projects[$pl_proj_id])) return error_response('Proyek yang sama tidak boleh ditambahkan lebih dari sekali.', 400);
        $seen_projects[$pl_proj_id] = true;
        $stmt = $pdo->prepare('SELECT id FROM Project WHERE id = ?');
        $stmt->execute([$pl_proj_id]);
        if (!$stmt->fetchColumn()) return error_response('Proyek penugasan tidak ditemukan.', 404);
        if (!$pl_mulai || !$pl_selesai) {
            return error_response('Masa Tugas (Tanggal Mulai dan Tanggal Selesai) wajib diisi untuk tiap proyek.', 400);
        }
        $ts_m = strtotime($pl_mulai);
        $ts_s = strtotime($pl_selesai);
        if (!$ts_m || !$ts_s) {
            return error_response('Format Tanggal Masa Tugas tidak valid.', 400);
        }
        if ($ts_s < $ts_m) {
            return error_response('Tanggal Selesai Tugas tidak boleh lebih awal dari Tanggal Mulai Tugas.', 400);
        }

        $validated_proyek_list[] = [
            'projectId'           => $pl_proj_id,
            'tanggalMulaiTugas'   => date('Y-m-d', $ts_m),
            'tanggalSelesaiTugas' => date('Y-m-d', $ts_s),
            'isTurunLapangan'     => $pl_turun,
            'nominalHonorBulanan' => $pl_honor,
        ];
    }

    ensure_tenaga_ahli_gaji_table($pdo);
    // Jangan membuat jadwal dan catatan yang sudah disimpan menjadi tak terjangkau.
    $stmt_gaji_owner = $pdo->prepare("SELECT id FROM Rekanan WHERE tipe = 'TENAGA_AHLI' AND (id = ? OR (? = '' AND nik = ?)) LIMIT 1");
    $stmt_gaji_owner->execute([$id ?? '', $id ?? '', $clean_nik]);
    $gaji_owner = $stmt_gaji_owner->fetchColumn();
    if ($gaji_owner) {
        $stmt_protected = $pdo->prepare('SELECT projectId FROM TenagaAhliGajiKontrak WHERE rekananId = ? AND gajiNegosiasi IS NOT NULL');
        $stmt_protected->execute([$gaji_owner]);
        $submitted_projects = array_column($validated_proyek_list, 'projectId');
        foreach ($stmt_protected->fetchAll(PDO::FETCH_COLUMN) as $protected_project) {
            if (!in_array($protected_project, $submitted_projects, true)) {
                return error_response('Penugasan dengan gaji negosiasi tersimpan tidak dapat dihapus. Sesuaikan bulan pada halaman gaji tenaga ahli.', 409);
            }
        }
    }

    $pdo->beginTransaction();
    try {
        // Ambil penugasan pertama untuk backward compatibility pada tabel Rekanan
        $primary_pl = $validated_proyek_list[0];
        $project_id            = $primary_pl['projectId'];
        $tanggal_mulai_db      = $primary_pl['tanggalMulaiTugas'];
        $tanggal_selesai_db    = $primary_pl['tanggalSelesaiTugas'];
        $is_turun_lapangan     = $primary_pl['isTurunLapangan'];
        $nominal_honor_bulanan = $primary_pl['nominalHonorBulanan'];
        $now = date('Y-m-d H:i:s');

        if ($id) {
            // Pertahankan riwayat lama yang sebelumnya hanya terhubung lewat NIK.
            if (!empty($editing_person['nik']) && $editing_person['nik'] !== $clean_nik) {
                $pdo->prepare("UPDATE HonorTenagaAhli SET rekananId = ? WHERE (rekananId IS NULL OR rekananId = '') AND nik = ?")
                    ->execute([$id, $editing_person['nik']]);
            }
            $pdo->prepare(
                "UPDATE Rekanan
                 SET nama=?, nik=?, npwp=?, kategori=?, ptkp=?, entityId=?,
                     tanggalMulaiTugas=?, tanggalSelesaiTugas=?, projectId=?,
                     isTurunLapangan=?, nominalHonorBulanan=?, updatedAt=?
                 WHERE id=?"
            )->execute([
                $nama, $clean_nik, $npwp, $kategori, $ptkp, $entity_id,
                $tanggal_mulai_db, $tanggal_selesai_db, $project_id,
                $is_turun_lapangan, $nominal_honor_bulanan, $now, $id
            ]);

            log_activity($user['id'], "Update Database Tenaga Ahli: $nama ($clean_nik)", 'FINANCIAL_CHANGE', ['rekananId' => $id]);
            $record_id = $id;
        } else {
            // Cek apakah NIK sudah terdaftar
            $stmt = $pdo->prepare("SELECT id, nama FROM Rekanan WHERE tipe = 'TENAGA_AHLI' AND nik = ? LIMIT 1");
            $stmt->execute([$clean_nik]);
            $existing = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($existing) {
                // Perbarui data profil dan tambahkan penugasan proyek
                $record_id = $existing['id'];
                $pdo->prepare(
                    "UPDATE Rekanan
                     SET nama=?, npwp=?, kategori=?, ptkp=?, entityId=?,
                         tanggalMulaiTugas=?, tanggalSelesaiTugas=?, projectId=?,
                         isTurunLapangan=?, nominalHonorBulanan=?, updatedAt=?
                     WHERE id=?"
                )->execute([
                    $nama, $npwp, $kategori, $ptkp, $entity_id,
                    $tanggal_mulai_db, $tanggal_selesai_db, $project_id,
                    $is_turun_lapangan, $nominal_honor_bulanan, $now, $record_id
                ]);
                log_activity($user['id'], "Update Penugasan Proyek Tenaga Ahli: $nama ($clean_nik)", 'FINANCIAL_CHANGE', ['rekananId' => $record_id]);
            } else {
                $record_id = uuid4();
                $pdo->prepare(
                    "INSERT INTO Rekanan
                     (id, nama, nik, npwp, tipe, kategori, ptkp, entityId,
                      tanggalMulaiTugas, tanggalSelesaiTugas, projectId,
                      isTurunLapangan, nominalHonorBulanan, createdAt, updatedAt)
                     VALUES (?, ?, ?, ?, 'TENAGA_AHLI', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                )->execute([
                    $record_id, $nama, $clean_nik, $npwp, $kategori, $ptkp, $entity_id,
                    $tanggal_mulai_db, $tanggal_selesai_db, $project_id,
                    $is_turun_lapangan, $nominal_honor_bulanan, $now, $now
                ]);
                log_activity($user['id'], "Tambah Database Tenaga Ahli: $nama ($clean_nik)", 'FINANCIAL_CHANGE', ['rekananId' => $record_id]);
            }
        }

        // Sinkronisasikan tabel TenagaAhliProject
        $pdo->prepare("DELETE FROM TenagaAhliProject WHERE rekananId = ?")->execute([$record_id]);
        $stmt_insert_tap = $pdo->prepare(
            "INSERT INTO TenagaAhliProject
                (id, rekananId, projectId, tanggalMulaiTugas, tanggalSelesaiTugas, isTurunLapangan, nominalHonorBulanan, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        );
        foreach ($validated_proyek_list as $pl_item) {
            $stmt_insert_tap->execute([
                uuid4(), $record_id, $pl_item['projectId'],
                $pl_item['tanggalMulaiTugas'], $pl_item['tanggalSelesaiTugas'],
                $pl_item['isTurunLapangan'], $pl_item['nominalHonorBulanan'],
                $now, $now
            ]);
        }

        $stmt = $pdo->prepare(
            "SELECT r.id, r.nama, r.nik, r.npwp, r.kategori, r.ptkp, r.entityId,
                    r.tanggalMulaiTugas, r.tanggalSelesaiTugas, r.projectId,
                    r.isTurunLapangan, r.nominalHonorBulanan,
                    p.code AS projectCode, p.name AS projectName
             FROM Rekanan r
             LEFT JOIN Project p ON r.projectId = p.id
             WHERE r.id = ?"
        );
        $stmt->execute([$record_id]);
        $record = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($record) {
            $record['isTurunLapangan']       = ((int)($record['isTurunLapangan'] ?? 1) === 1);
            $record['nominalHonorBulanan']    = (float)($record['nominalHonorBulanan'] ?? 0.0);
            $record['nominalHonorBulananFmt'] = fmt_rp_payroll($record['nominalHonorBulanan']);

            // Ambil penugasan proyek
            $stmt_tap = $pdo->prepare(
                "SELECT tap.*, p.code AS projectCode, p.name AS projectName
                 FROM TenagaAhliProject tap
                 JOIN Project p ON tap.projectId = p.id
                 WHERE tap.rekananId = ?
                 ORDER BY tap.createdAt ASC"
            );
            $stmt_tap->execute([$record_id]);
            $record['proyekList'] = array_map(function($tap_row) {
                $tap_row['isTurunLapangan'] = ((int)($tap_row['isTurunLapangan'] ?? 1) === 1);
                $tap_row['nominalHonorBulanan'] = (float)($tap_row['nominalHonorBulanan'] ?? 0);
                $tap_row['nominalHonorBulananFmt'] = fmt_rp_payroll($tap_row['nominalHonorBulanan']);
                $tap_row['tanggalMulaiTugasFmt'] = !empty($tap_row['tanggalMulaiTugas']) ? fmt_tanggal_id($tap_row['tanggalMulaiTugas']) : null;
                $tap_row['tanggalSelesaiTugasFmt'] = !empty($tap_row['tanggalSelesaiTugas']) ? fmt_tanggal_id($tap_row['tanggalSelesaiTugas']) : null;
                return $tap_row;
            }, $stmt_tap->fetchAll(PDO::FETCH_ASSOC));
        }

        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        throw $e;
    }

    json_response([
        'success' => true,
        'data'    => $record,
        'message' => "Tenaga Ahli $nama berhasil disimpan dengan " . count($validated_proyek_list) . " penugasan proyek.",
    ]);
}

// ─── DELETE /api/payroll/tenaga-ahli/{id} ─────────────────────────────────────
elseif ($method === 'DELETE' && $sub === 'tenaga-ahli' && $sub2 !== '') {
    $user = require_auth();
    $pdo  = get_pdo();
    $id   = $sub2;

    // Cek apakah ada riwayat honor
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM HonorTenagaAhli WHERE rekananId = ?");
    $stmt->execute([$id]);
    $honor_count = (int)$stmt->fetchColumn();
    if ($honor_count > 0) {
        return error_response("Tenaga Ahli tidak dapat dihapus karena memiliki $honor_count riwayat pembayaran honor.", 409);
    }

    ensure_tenaga_ahli_gaji_table($pdo);
    $stmt = $pdo->prepare('SELECT COUNT(*) FROM TenagaAhliGajiKontrak WHERE rekananId = ? AND gajiNegosiasi IS NOT NULL');
    $stmt->execute([$id]);
    if ((int)$stmt->fetchColumn() > 0) {
        return error_response('Tenaga ahli memiliki gaji negosiasi dan jadwal bulanan tersimpan sehingga tidak dapat dihapus.', 409);
    }
    $pdo->prepare('DELETE FROM TenagaAhliGajiKontrak WHERE rekananId = ?')->execute([$id]);
    $pdo->prepare("DELETE FROM Rekanan WHERE id = ?")->execute([$id]);
    json_response(['success' => true, 'message' => 'Tenaga Ahli berhasil dihapus dari database.']);
}

else {
    error_response('Endpoint tidak ditemukan.', 404);
}
