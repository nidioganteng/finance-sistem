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
        "SELECT p.*,
                g.id as gaji_id, g.bulan, g.tahun,
                g.gajiPokok as gaji_gp, g.tunjanganJabatan, g.tunjanganTransport,
                g.insentif, g.bpjsKesehatan, g.bpjsKetenagakerjaan, g.potonganLain,
                g.pph21 as gaji_pph21, g.totalGajiKotor, g.totalGajiBersih, g.catatan as gaji_catatan
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

    // Build pegawaiList
    $pegawai_list = [];
    $gaji_bulan_ini = [];
    $summary_bulan_ini = [
        'totalPegawaiAktif'         => 0,
        'totalPegawaiInput'         => 0,
        'totalGajiPokok'            => 0.0,
        'totalTunjanganJabatan'     => 0.0,
        'totalTunjanganTransport'   => 0.0,
        'totalInsentif'             => 0.0,
        'totalBpjsKesehatan'        => 0.0,
        'totalBpjsKetenagakerjaan'  => 0.0,
        'totalPotonganLain'         => 0.0,
        'totalPph21'                => 0.0,
        'totalGajiKotor'            => 0.0,
        'totalGajiBersih'           => 0.0,
    ];

    foreach ($pegawai_map as $pid => $p) {
        $gaji_months = $pegawai_gaji_map[$pid];
        $ptkp_num    = (float)$p['ptkp'];
        $gaji_pokok_num = (float)$p['gajiPokok'];
        $is_active   = (bool)$p['isActive'];

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

            $current_gaji = [
                'id'                       => $g['gaji_id'],
                'pegawaiId'                => $pid,
                'pegawaiNama'              => $p['nama'],
                'pegawaiNik'               => $p['nik'],
                'pegawaiJabatan'           => $p['jabatan'],
                'bulan'                    => (int)$g['bulan'],
                'tahun'                    => (int)$g['tahun'],
                'gajiPokok'                => $gp,
                'gajiPokokFmt'             => fmt_rp_payroll($gp),
                'tunjanganJabatan'         => $tj,
                'tunjanganJabatanFmt'      => fmt_rp_payroll($tj),
                'tunjanganTransport'       => $tt,
                'tunjanganTransportFmt'    => fmt_rp_payroll($tt),
                'insentif'                 => $ins,
                'insentifFmt'              => fmt_rp_payroll($ins),
                'bpjsKesehatan'            => $bkes,
                'bpjsKesehatanFmt'         => fmt_rp_payroll($bkes),
                'bpjsKetenagakerjaan'      => $btk,
                'bpjsKetenagakerjaanFmt'   => fmt_rp_payroll($btk),
                'potonganLain'             => $pot,
                'potonganLainFmt'          => fmt_rp_payroll($pot),
                'pph21'                    => $pph,
                'pph21Fmt'                 => fmt_rp_payroll($pph),
                'totalGajiKotor'           => $kotor,
                'totalGajiKotorFmt'        => fmt_rp_payroll($kotor),
                'totalGajiBersih'          => $brsih,
                'totalGajiBersihFmt'       => fmt_rp_payroll($brsih),
                'catatan'                  => $g['gaji_catatan'],
            ];

            $gaji_bulan_ini[] = $current_gaji;

            $summary_bulan_ini['totalGajiPokok']           += $gp;
            $summary_bulan_ini['totalTunjanganJabatan']    += $tj;
            $summary_bulan_ini['totalTunjanganTransport']  += $tt;
            $summary_bulan_ini['totalInsentif']            += $ins;
            $summary_bulan_ini['totalBpjsKesehatan']       += $bkes;
            $summary_bulan_ini['totalBpjsKetenagakerjaan'] += $btk;
            $summary_bulan_ini['totalPotonganLain']        += $pot;
            $summary_bulan_ini['totalPph21']               += $pph;
            $summary_bulan_ini['totalGajiKotor']           += $kotor;
            $summary_bulan_ini['totalGajiBersih']          += $brsih;
            $summary_bulan_ini['totalPegawaiInput']++;
        }

        // Akumulasi tahunan
        $total_gaji_kotor_thn  = 0.0;
        $total_gaji_bersih_thn = 0.0;
        $total_pph21_thn       = 0.0;
        foreach ($gaji_months as $gm) {
            $total_gaji_kotor_thn  += (float)$gm['totalGajiKotor'];
            $total_gaji_bersih_thn += (float)$gm['totalGajiBersih'];
            $total_pph21_thn       += (float)$gm['gaji_pph21'];
        }

        if ($is_active) $summary_bulan_ini['totalPegawaiAktif']++;

        $pegawai_list[] = [
            'id'             => $pid,
            'entityId'       => $p['entityId'],
            'nik'            => $p['nik'],
            'nama'           => $p['nama'],
            'jabatan'        => $p['jabatan'],
            'statusKeluarga' => $p['statusKeluarga'],
            'ptkp'           => $ptkp_num,
            'ptkpFmt'        => fmt_rp_payroll($ptkp_num),
            'gajiPokok'      => $gaji_pokok_num,
            'gajiPokokFmt'   => fmt_rp_payroll($gaji_pokok_num),
            'isActive'       => (bool)$p['isActive'],
            'currentGaji'    => $current_gaji,
            'akumulasiTahun' => [
                'totalGajiKotor'  => $total_gaji_kotor_thn,
                'totalGajiBersih' => $total_gaji_bersih_thn,
                'totalPph21'      => $total_pph21_thn,
                'bulanTerbayar'   => count($gaji_months),
            ],
        ];
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
        'gajiBulanIni'          => $gaji_bulan_ini,
        'rekapBulananPegawai'   => $rekap_bulanan_pegawai,
        'summaryBulanIni'       => array_merge($summary_bulan_ini, [
            'totalGajiPokokFmt'             => fmt_rp_payroll($summary_bulan_ini['totalGajiPokok']),
            'totalTunjanganJabatanFmt'      => fmt_rp_payroll($summary_bulan_ini['totalTunjanganJabatan']),
            'totalTunjanganTransportFmt'    => fmt_rp_payroll($summary_bulan_ini['totalTunjanganTransport']),
            'totalInsentifFmt'              => fmt_rp_payroll($summary_bulan_ini['totalInsentif']),
            'totalBpjsKesehatanFmt'         => fmt_rp_payroll($summary_bulan_ini['totalBpjsKesehatan']),
            'totalBpjsKetenagakerjaanFmt'   => fmt_rp_payroll($summary_bulan_ini['totalBpjsKetenagakerjaan']),
            'totalPotonganLainFmt'          => fmt_rp_payroll($summary_bulan_ini['totalPotonganLain']),
            'totalPph21Fmt'                 => fmt_rp_payroll($summary_bulan_ini['totalPph21']),
            'totalGajiKotorFmt'             => fmt_rp_payroll($summary_bulan_ini['totalGajiKotor']),
            'totalGajiBersihFmt'            => fmt_rp_payroll($summary_bulan_ini['totalGajiBersih']),
        ]),
        'honorList'             => $honor_list,
        'rekapBulananTenagaAhli'=> $rekap_bulanan_ta,
        'rekapTenagaAhliPerNama'=> $rekap_ta_per_nama,
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
    $ptkp           = (float)($body['ptkp'] ?? 54000000);
    $gaji_pokok     = (float)($body['gajiPokok'] ?? 0);
    $is_active      = isset($body['isActive'])
        ? ($body['isActive'] === true || $body['isActive'] === 'true' || $body['isActive'] === 'on')
        : true;

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
    $pdo->prepare(
        "INSERT INTO Pegawai (id, entityId, nik, nama, jabatan, statusKeluarga, ptkp, gajiPokok, isActive, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )->execute([$id, $entity_id, $nik, $nama, $jabatan, $status_kel, $ptkp, $gaji_pokok, $is_active ? 1 : 0, $now, $now]);

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

    $nik        = trim($body['nik'] ?? $existing['nik']);
    $nama       = trim($body['nama'] ?? $existing['nama']);
    $jabatan    = trim($body['jabatan'] ?? $existing['jabatan']) ?: 'Karyawan';
    $status_kel = trim($body['statusKeluarga'] ?? $existing['statusKeluarga']) ?: 'TK/0';
    $ptkp       = isset($body['ptkp']) ? (float)$body['ptkp'] : (float)$existing['ptkp'];
    $gaji_pokok = isset($body['gajiPokok']) ? (float)$body['gajiPokok'] : (float)$existing['gajiPokok'];
    $is_active  = isset($body['isActive'])
        ? ($body['isActive'] === true || $body['isActive'] === 'true' || $body['isActive'] === 'on')
        : (bool)$existing['isActive'];

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
        "UPDATE Pegawai SET nik=?, nama=?, jabatan=?, statusKeluarga=?, ptkp=?, gajiPokok=?, isActive=?, updatedAt=? WHERE id=?"
    )->execute([$nik, $nama, $jabatan, $status_kel, $ptkp, $gaji_pokok, $is_active ? 1 : 0, $now, $id]);

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

    $pegawai_id       = trim($body['pegawaiId'] ?? '');
    $entity_id        = trim($body['entityId'] ?? '');
    $bulan            = (int)($body['bulan'] ?? 0);
    $tahun            = (int)($body['tahun'] ?? 0);
    $gaji_pokok       = (float)($body['gajiPokok'] ?? 0);
    $tunjangan_jabatan= (float)($body['tunjanganJabatan'] ?? 0);
    $tunjangan_transport = (float)($body['tunjanganTransport'] ?? 0);
    $insentif         = (float)($body['insentif'] ?? 0);
    $bpjs_kes         = (float)($body['bpjsKesehatan'] ?? 0);
    $bpjs_tk          = (float)($body['bpjsKetenagakerjaan'] ?? 0);
    $potongan_lain    = (float)($body['potonganLain'] ?? 0);
    $pph21            = (float)($body['pph21'] ?? 0);
    $catatan          = trim($body['catatan'] ?? '') ?: null;

    if (!$pegawai_id || !$entity_id || !$bulan || !$tahun) {
        return error_response('Pegawai, Entitas, Bulan, dan Tahun wajib diisi.', 400);
    }

    $stmt = $pdo->prepare("SELECT id, nama, nik FROM Pegawai WHERE id = ? LIMIT 1");
    $stmt->execute([$pegawai_id]);
    $pegawai = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$pegawai) return error_response('Pegawai tidak ditemukan.', 404);

    $total_kotor  = $gaji_pokok + $tunjangan_jabatan + $tunjangan_transport + $insentif;
    $total_bersih = max(0, $total_kotor - $bpjs_kes - $bpjs_tk - $potongan_lain - $pph21);
    $now          = date('Y-m-d H:i:s');

    // Check existing (upsert)
    $stmt = $pdo->prepare("SELECT id FROM GajiPegawaiBulanan WHERE pegawaiId = ? AND bulan = ? AND tahun = ? LIMIT 1");
    $stmt->execute([$pegawai_id, $bulan, $tahun]);
    $existing_id = $stmt->fetchColumn();

    if ($existing_id) {
        $pdo->prepare(
            "UPDATE GajiPegawaiBulanan
             SET gajiPokok=?, tunjanganJabatan=?, tunjanganTransport=?, insentif=?,
                 bpjsKesehatan=?, bpjsKetenagakerjaan=?, potonganLain=?, pph21=?,
                 totalGajiKotor=?, totalGajiBersih=?, catatan=?
             WHERE id=?"
        )->execute([$gaji_pokok, $tunjangan_jabatan, $tunjangan_transport, $insentif,
                    $bpjs_kes, $bpjs_tk, $potongan_lain, $pph21,
                    $total_kotor, $total_bersih, $catatan, $existing_id]);
        $gaji_id = $existing_id;
    } else {
        $gaji_id = uuid4();
        $pdo->prepare(
            "INSERT INTO GajiPegawaiBulanan
             (id, pegawaiId, entityId, bulan, tahun, gajiPokok, tunjanganJabatan, tunjanganTransport,
              insentif, bpjsKesehatan, bpjsKetenagakerjaan, potonganLain, pph21,
              totalGajiKotor, totalGajiBersih, catatan, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )->execute([$gaji_id, $pegawai_id, $entity_id, $bulan, $tahun,
                    $gaji_pokok, $tunjangan_jabatan, $tunjangan_transport, $insentif,
                    $bpjs_kes, $bpjs_tk, $potongan_lain, $pph21,
                    $total_kotor, $total_bersih, $catatan, $now]);
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
    $nominal_honor   = (float)($body['nominalHonor'] ?? 0);
    $tarif_pph       = (float)($body['tarifPph21Persen'] ?? 0);
    $pph21           = (float)($body['pph21'] ?? 0);
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
        // Buat dari master pegawai aktif
        $stmt = $pdo->prepare(
            "SELECT * FROM Pegawai WHERE entityId = ? AND isActive = 1"
        );
        $stmt->execute([$entity_id]);
        $active_pegawai = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($active_pegawai)) {
            return error_response('Belum ada pegawai aktif di master database entitas ini.', 404);
        }

        foreach ($active_pegawai as $p) {
            // Cek existing
            $stmt = $pdo->prepare(
                "SELECT id FROM GajiPegawaiBulanan WHERE pegawaiId = ? AND bulan = ? AND tahun = ? LIMIT 1"
            );
            $stmt->execute([$p['id'], $target_month, $target_year]);
            if ($stmt->fetchColumn()) continue;

            $gp = (float)$p['gajiPokok'];
            $pdo->prepare(
                "INSERT INTO GajiPegawaiBulanan
                 (id, entityId, pegawaiId, bulan, tahun, gajiPokok, totalGajiKotor, totalGajiBersih, catatan, createdAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )->execute([uuid4(), $entity_id, $p['id'], $target_month, $target_year,
                        $gp, $gp, $gp, 'Dibuat otomatis dari Gaji Pokok Master', $now]);
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
        $stmt = $pdo->prepare(
            "SELECT id FROM GajiPegawaiBulanan WHERE pegawaiId = ? AND bulan = ? AND tahun = ? LIMIT 1"
        );
        $stmt->execute([$prev['pegawaiId'], $target_month, $target_year]);
        if ($stmt->fetchColumn()) continue;

        $pdo->prepare(
            "INSERT INTO GajiPegawaiBulanan
             (id, entityId, pegawaiId, bulan, tahun, gajiPokok, tunjanganJabatan, tunjanganTransport,
              insentif, bpjsKesehatan, bpjsKetenagakerjaan, potonganLain, pph21,
              totalGajiKotor, totalGajiBersih, catatan, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )->execute([
            uuid4(), $entity_id, $prev['pegawaiId'], $target_month, $target_year,
            $prev['gajiPokok'], $prev['tunjanganJabatan'], $prev['tunjanganTransport'],
            $prev['insentif'], $prev['bpjsKesehatan'], $prev['bpjsKetenagakerjaan'],
            $prev['potonganLain'], $prev['pph21'],
            $prev['totalGajiKotor'], $prev['totalGajiBersih'],
            "Disalin dari bulan $source_month/$source_year", $now,
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
