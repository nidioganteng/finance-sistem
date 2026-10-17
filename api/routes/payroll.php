<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

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

    // 3. Projects for entity
    $stmt = $pdo->prepare("SELECT id, code, name FROM Project WHERE entityId = ? ORDER BY code ASC");
    $stmt->execute([$entity_id]);
    $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 4. Tenaga Ahli master (rekanan tipe TENAGA_AHLI)
    $stmt = $pdo->prepare(
        "SELECT id, nama, nik, npwp, kategori FROM Rekanan WHERE tipe = 'TENAGA_AHLI' ORDER BY nama ASC"
    );
    $stmt->execute();
    $rekanan_tenaga_ahli = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 5. Pegawai for entity with all gaji for year
    $stmt = $pdo->prepare(
        "SELECT p.*, p.tarifTransportHarian AS pegawai_tarif_transport,
                g.id as gaji_id, g.bulan, g.tahun,
                g.gajiPokok as gaji_gp, g.tunjanganJabatan, g.tunjanganTransport,
                g.insentif, g.bpjsKesehatan, g.bpjsKetenagakerjaan, g.potonganLain,
                g.pph21 as gaji_pph21, g.totalGajiKotor, g.totalGajiBersih, g.catatan as gaji_catatan,
                g.hariKerja, g.tarifTransportHarian, g.thr, g.tunjanganBpjs, g.tunjanganBpjsKes,
                g.tunjanganBpjsTk, g.tunjanganPph, g.tunjanganLainnya, g.potonganBpjs, g.totalGajiTerlaporPajak
         FROM Pegawai p
         LEFT JOIN GajiPegawaiBulanan g ON g.pegawaiId = p.id AND g.tahun = ?
         WHERE p.entityId = ?
         ORDER BY p.isActive DESC, p.nama ASC"
    );
    $stmt->execute([$year, $entity_id]);
    $pegawai_rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Group pegawai rows (one per pegawai, collect all gaji months)
    $pegawai_map = [];
    $pegawai_gaji_map = []; // pegawaiId => [bulan => gaji_row]
    foreach ($pegawai_rows as $row) {
        $pid = $row['id'];
        if (!isset($pegawai_map[$pid])) {
            $pegawai_map[$pid] = $row;
            $pegawai_gaji_map[$pid] = [];
        }
        if ($row['gaji_id']) {
            $pegawai_gaji_map[$pid][$row['bulan']] = $row;
        }
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

    foreach ($pegawai_map as $pid => $p) {
        $gaji_months    = $pegawai_gaji_map[$pid];
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
            $gp    = (float)$g['gaji_gp'];
            $tj    = (float)$g['tunjanganJabatan'];
            $tt    = (float)$g['tunjanganTransport'];
            $ins   = (float)$g['insentif'];
            $bkes  = (float)$g['bpjsKesehatan'];
            $btk   = (float)$g['bpjsKetenagakerjaan'];
            $pot   = (float)$g['potonganLain'];
            $pph   = (float)$g['gaji_pph21'];
            $kotor = (float)$g['totalGajiKotor'];
            $brsih = (float)$g['totalGajiBersih'];
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
                'id'                       => $g['gaji_id'],
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
                'catatan'                  => $g['gaji_catatan'],
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
            $total_gaji_kotor_thn  += (float)$gm['totalGajiKotor'];
            $total_gaji_bersih_thn += (float)$gm['totalGajiBersih'];
            $total_pph21_thn       += (float)$gm['gaji_pph21'];

            $gp_m    = (float)$gm['gaji_gp'];
            $tj_m    = (float)$gm['tunjanganJabatan'];
            $tt_m    = (float)$gm['tunjanganTransport'];
            $ins_m   = (float)$gm['insentif'];
            $bkes_m  = (float)$gm['bpjsKesehatan'];
            $btk_m   = (float)$gm['bpjsKetenagakerjaan'];
            $pot_m   = (float)$gm['potonganLain'];
            $pph_m   = (float)$gm['gaji_pph21'];
            $kotor_m = (float)$gm['totalGajiKotor'];
            $brsih_m = (float)$gm['totalGajiBersih'];
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
                'id'                       => $gm['gaji_id'],
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
                'catatan'                  => $gm['gaji_catatan'],
            ];
        }

        $tj_master    = (float)$p['tunjanganJabatan'];
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
        $tarif_master = isset($p['pegawai_tarif_transport']) ? (float)$p['pegawai_tarif_transport'] : (isset($p['tarifTransportHarian']) ? (float)$p['tarifTransportHarian'] : 15000.0);
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
                p.code AS projCode, p.name AS projName
         FROM HonorTenagaAhli h
         JOIN Entity e ON h.entityId = e.id
         LEFT JOIN Project p ON h.projectId = p.id
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

    foreach ($honor_raw as $h) {
        $bruto  = (float)$h['nominalHonor'];
        $pph    = (float)$h['pph21'];
        $bersih = (float)$h['nominalBersih'];
        $resolved_proj = $h['namaProyek']
            ?: ($h['projCode'] ? "{$h['projCode']} - {$h['projName']}" : null);
        $tgl_str = substr($h['tanggal'], 0, 10); // YYYY-MM-DD

        $honor_list[] = [
            'id'               => $h['id'],
            'entityId'         => $h['entityId'],
            'entityName'       => $h['entityName'],
            'entityKey'        => $h['entityKey'],
            'rekananId'        => $h['rekananId'] ?? null,
            'nik'              => $h['nik'],
            'nama'             => $h['nama'],
            'npwp'             => $h['npwp'] ?? null,
            'uraian'           => $h['uraian'],
            'tanggal'          => $tgl_str,
            'tanggalFmt'       => fmt_tanggal_id($tgl_str),
            'bulan'            => (int)$h['bulan'],
            'tahun'            => (int)$h['tahun'],
            'nominalHonor'     => $bruto,
            'nominalHonorFmt'  => fmt_rp_payroll($bruto),
            'tarifPph21Persen' => (float)$h['tarifPph21Persen'],
            'pph21'            => $pph,
            'pph21Fmt'         => fmt_rp_payroll($pph),
            'nominalBersih'    => $bersih,
            'nominalBersihFmt' => fmt_rp_payroll($bersih),
            'projectId'        => $h['projectId'] ?? null,
            'projectCode'      => $h['projCode'] ?? null,
            'projectName'      => $h['projName'] ?? null,
            'namaProyek'       => $resolved_proj,
            'noBukti'          => $h['noBukti'] ?? null,
        ];

        $summary_honor_bulan_ini['totalTransaksi']++;
        $summary_honor_bulan_ini['totalHonorBruto']  += $bruto;
        $summary_honor_bulan_ini['totalPph21']        += $pph;
        $summary_honor_bulan_ini['totalHonorBersih']  += $bersih;
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

    // 9. All honor for all entities+year (for konsolidasi)
    $stmt = $pdo->prepare(
        "SELECT h.*, e.id AS eid, e.`key` AS ekey, e.name AS ename,
                p.code AS projCode, p.name AS projName
         FROM HonorTenagaAhli h
         JOIN Entity e ON h.entityId = e.id
         LEFT JOIN Project p ON h.projectId = p.id
         WHERE h.tahun = ?
         ORDER BY h.tanggal DESC"
    );
    $stmt->execute([$year]);
    $all_honor_tahun = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Build rekapTenagaAhliPerNama (grouped by NIK/nama, cross-entity)
    $per_nama_map = [];
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
    usort($rekap_ta_per_nama, fn($a, $b) => $b['totalHonorBruto'] <=> $a['totalHonorBruto']);

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
    foreach ($all_honor_tahun as $h) {
        if ((int)$h['bulan'] !== $month) continue;
        $bruto  = (float)$h['nominalHonor'];
        $pph    = (float)$h['pph21'];
        $bersih = (float)$h['nominalBersih'];
        $resolved_proj = $h['namaProyek']
            ?: ($h['projCode'] ? "{$h['projCode']} - {$h['projName']}" : null);
        $tgl_str = substr($h['tanggal'], 0, 10);
        $all_honor_bulan_ini[] = [
            'id'               => $h['id'],
            'entityId'         => $h['entityId'],
            'entityName'       => $h['ename'],
            'entityKey'        => $h['ekey'],
            'rekananId'        => $h['rekananId'] ?? null,
            'nik'              => $h['nik'],
            'nama'             => $h['nama'],
            'npwp'             => $h['npwp'] ?? null,
            'uraian'           => $h['uraian'],
            'tanggal'          => $tgl_str,
            'tanggalFmt'       => fmt_tanggal_id($tgl_str),
            'bulan'            => (int)$h['bulan'],
            'tahun'            => (int)$h['tahun'],
            'nominalHonor'     => $bruto,
            'nominalHonorFmt'  => fmt_rp_payroll($bruto),
            'tarifPph21Persen' => (float)($h['tarifPph21Persen'] ?? 0),
            'pph21'            => $pph,
            'pph21Fmt'         => fmt_rp_payroll($pph),
            'nominalBersih'    => $bersih,
            'nominalBersihFmt' => fmt_rp_payroll($bersih),
            'projectId'        => $h['projectId'] ?? null,
            'projectCode'      => $h['projCode'] ?? null,
            'namaProyek'       => $resolved_proj,
            'ptkp'             => $h['ptkp'] ?? null,
            'jenisPph'         => $h['jenisPph'] ?? null,
            'noBukti'          => $h['noBukti'] ?? null,
        ];
    }

    // Build rekapTenagaAhliPerProyek — honor per proyek, seluruh tahun
    $per_proyek_map = [];
    foreach ($all_honor_tahun as $h) {
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
    usort($rekap_ta_per_proyek, fn($a, $b) => $b['totalHonorBruto'] <=> $a['totalHonorBruto']);

    // 10. Transactions for COA gaji/honor/tenaga ahli for year (for sync laba rugi)
    $year_start = "$year-01-01 00:00:00";
    $year_end   = "$year-12-31 23:59:59";
    $stmt = $pdo->prepare(
        "SELECT t.id, t.entityId, t.tanggal, t.noBukti, t.keterangan,
                t.coaAccountId, t.projectId, t.debit, t.kredit,
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
           AND t.tanggal BETWEEN ? AND ?
           AND c.kategori = 'BEBAN'
           AND (c.code = '511' OR c.code = '612'
                OR c.name LIKE '%Gaji%' OR c.name LIKE '%Honor%' OR c.name LIKE '%Tenaga Ahli%')
         ORDER BY t.tanggal DESC, t.noBukti DESC"
    );
    $stmt->execute([$entity_id, $year_start, $year_end]);
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
        $bulan_tx = (int)date('n', strtotime($tgl));
        $jenis_nama_str = $jenis_map[$t['jenis_key'] ?? ''] ?? ($t['jenis_nama'] ?? 'Jurnal Umum');

        $item = [
            'id'            => $t['id'],
            'entityId'      => $t['entityId'],
            'tanggal'       => $tgl,
            'tanggalFmt'    => fmt_tanggal_id($tgl),
            'bulan'         => $bulan_tx,
            'tahun'         => (int)date('Y', strtotime($tgl)),
            'noBukti'       => $t['noBukti'],
            'keterangan'    => $t['keterangan'],
            'coaAccountId'  => $t['coaAccountId'],
            'coaCode'       => $code ?: '-',
            'coaName'       => $t['coa_name'] ?: 'Beban Gaji',
            'jenisInputKey' => $t['jenis_key'] ?? 'jurnalTransaksi',
            'jenisInputNama'=> $jenis_nama_str,
            'projectId'     => $t['projectId'] ?? null,
            'projectCode'   => $t['proj_code'] ?? null,
            'projectName'   => $t['proj_name'] ?? null,
            'namaProyek'    => $t['proj_code'] ? "{$t['proj_code']} - {$t['proj_name']}" : null,
            'debit'         => $d,
            'debitFmt'      => fmt_rp_payroll($d),
            'kredit'        => $k,
            'kreditFmt'     => fmt_rp_payroll($k),
            'staffName'     => $t['staff_name'] ?? null,
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
    ];

    json_response([
        'entity'                => $entity,
        'allEntities'           => $all_entities,
        'projects'              => $projects,
        'rekananTenagaAhli'     => $rekanan_tenaga_ahli,
        'year'                  => $year,
        'month'                 => $month,
        'pegawaiList'           => $pegawai_list,
        'allPegawaiMaster'      => $all_pegawai_master,
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

    $total_kotor  = $gaji_pokok + $tunjangan_jabatan + $tunjangan_transport + $insentif + $thr + $tunjangan_bpjs + $tunjangan_pph;
    $total_pajak  = $total_kotor;
    // Potongan dari karyawan: BPJS Karyawan + Potongan Lain (PPh 21 ditanggung perusahaan)
    $total_bersih = max(0, $gaji_pokok + $tunjangan_jabatan + $tunjangan_transport + $insentif + $thr - $potongan_bpjs - $potongan_lain);
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

    $tgl_ts    = strtotime($tanggal_str);
    $bulan     = (int)date('n', $tgl_ts);
    $tahun     = (int)date('Y', $tgl_ts);
    $tanggal_db = date('Y-m-d', $tgl_ts) . ' 00:00:00';
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
                 projectId=?, namaProyek=?, noBukti=?
             WHERE id=?"
        )->execute([$entity_id, $final_rekanan_id, $nik, $nama, $npwp, $uraian, $tanggal_db,
                    $bulan, $tahun, $nominal_honor, $tarif_pph, $pph21, $nominal_bersih,
                    $project_id, $nama_proyek, $no_bukti, $id]);

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
              projectId, namaProyek, noBukti, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )->execute([$honor_id, $entity_id, $final_rekanan_id, $nik, $nama, $npwp, $uraian, $tanggal_db,
                    $bulan, $tahun, $nominal_honor, $tarif_pph, $pph21, $nominal_bersih,
                    $project_id, $nama_proyek, $no_bukti, $now]);

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
            $tbk = (float)($p['tunjanganBpjsKes'] ?? 0);
            $tbtk = (float)($p['tunjanganBpjsTk'] ?? 0);
            $tb = $tbk + $tbtk;
            $bkes = (float)($p['bpjsKesehatan'] ?? 0);
            $btk = (float)($p['bpjsKetenagakerjaan'] ?? 0);
            $pb = (float)($p['potonganBpjs'] ?? ($bkes + $btk));
            if ($pb <= 0 && ($bkes > 0 || $btk > 0)) $pb = $bkes + $btk;
            $kotor = $gp + $tj + $tb;
            $bersih = max(0, $gp + $tj - $pb);
            $pdo->prepare(
                "INSERT INTO GajiPegawaiBulanan
                 (id, entityId, pegawaiId, bulan, tahun, gajiPokok, tunjanganJabatan,
                  tunjanganBpjs, tunjanganBpjsKes, tunjanganBpjsTk, bpjsKesehatan, bpjsKetenagakerjaan,
                  potonganBpjs, totalGajiKotor, totalGajiTerlaporPajak, totalGajiBersih, catatan, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )->execute([uuid4(), $entity_id, $p['id'], $target_month, $target_year,
                        $gp, $tj, $tb, $tbk, $tbtk, $bkes, $btk, $pb,
                        $kotor, $kotor, $bersih, 'Dibuat otomatis dari Master Data Karyawan (Komponen Tetap)', $now, $now]);
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

// ─── POST /api/payroll/tenaga-ahli ────────────────────────────────────────────
elseif ($method === 'POST' && $sub === 'tenaga-ahli' && $sub2 === '') {
    $user = require_auth();
    $pdo  = get_pdo();

    $id       = trim($body['id'] ?? '') ?: null;
    $nama     = trim($body['nama'] ?? '');
    $nik      = trim($body['nik'] ?? '');
    $npwp     = trim($body['npwp'] ?? '') ?: null;
    $kategori = trim($body['kategori'] ?? '') ?: null;
    $entity_id = trim($body['entityId'] ?? '') ?: null;

    if (!$nama || !$nik) {
        return error_response('Nama Lengkap dan NIK Tenaga Ahli wajib diisi.', 400);
    }

    $clean_nik = preg_replace('/\D/', '', $nik);
    if (strlen($clean_nik) !== 16) {
        return error_response('NIK Tenaga Ahli harus berupa 16 digit angka KTP.', 400);
    }

    $now = date('Y-m-d H:i:s');

    if ($id) {
        $pdo->prepare(
            "UPDATE Rekanan SET nama=?, nik=?, npwp=?, kategori=?, entityId=?, updatedAt=? WHERE id=?"
        )->execute([$nama, $clean_nik, $npwp, $kategori, $entity_id, $now, $id]);

        log_activity($user['id'], "Update Database Tenaga Ahli: $nama ($clean_nik)", 'FINANCIAL_CHANGE', ['rekananId' => $id]);
        $record_id = $id;
    } else {
        // Cek NIK sudah terdaftar
        $stmt = $pdo->prepare("SELECT id, nama FROM Rekanan WHERE tipe = 'TENAGA_AHLI' AND nik = ? LIMIT 1");
        $stmt->execute([$clean_nik]);
        $existing = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($existing) {
            return error_response("Tenaga Ahli dengan NIK $clean_nik sudah terdaftar ({$existing['nama']}).", 409);
        }

        $record_id = uuid4();
        $pdo->prepare(
            "INSERT INTO Rekanan (id, nama, nik, npwp, tipe, kategori, entityId, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, 'TENAGA_AHLI', ?, ?, ?, ?)"
        )->execute([$record_id, $nama, $clean_nik, $npwp, $kategori, $entity_id, $now, $now]);

        log_activity($user['id'], "Tambah Database Tenaga Ahli: $nama ($clean_nik)", 'FINANCIAL_CHANGE', ['rekananId' => $record_id]);
    }

    $stmt = $pdo->prepare("SELECT id, nama, nik, npwp, kategori FROM Rekanan WHERE id = ?");
    $stmt->execute([$record_id]);
    $record = $stmt->fetch(PDO::FETCH_ASSOC);

    json_response([
        'success' => true,
        'data'    => $record,
        'message' => "Tenaga Ahli $nama berhasil disimpan ke database.",
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

    $pdo->prepare("DELETE FROM Rekanan WHERE id = ?")->execute([$id]);
    json_response(['success' => true, 'message' => 'Tenaga Ahli berhasil dihapus dari database.']);
}

else {
    error_response('Endpoint tidak ditemukan.', 404);
}
