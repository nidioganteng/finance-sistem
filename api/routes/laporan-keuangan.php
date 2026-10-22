<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');
require_once __DIR__.'/../helpers/kas-transitory.php';

require_once __DIR__ . '/../helpers/akuntansi-helpers.php';

$user = require_auth();

// GET /api/laporan-keuangan?type=tx-count&entityIds[]=...&dateFrom=...&dateTo=...
if ($method === 'GET' && ($_GET['type'] ?? '') === 'tx-count') {
    $entity_ids_raw = $_GET['entityIds'] ?? [];
    if (!is_array($entity_ids_raw)) $entity_ids_raw = [$entity_ids_raw];
    $entity_ids = array_filter(array_map('trim', $entity_ids_raw));

    if (empty($entity_ids)) error_response('entityIds diperlukan.', 400);

    $date_from = $_GET['dateFrom'] ?? date('Y') . '-01-01 00:00:00';
    $date_to   = $_GET['dateTo']   ?? date('Y') . '-12-31 23:59:59';

    $pdo = get_pdo();
    $placeholders = implode(',', array_fill(0, count($entity_ids), '?'));
    $stmt = $pdo->prepare(
        "SELECT COUNT(*) FROM `Transaction`
          WHERE entityId IN ($placeholders) AND tanggal BETWEEN ? AND ?"
    );
    $stmt->execute(array_merge($entity_ids, [$date_from, $date_to]));
    json_response(['count' => (int)$stmt->fetchColumn()]);
}

// GET /api/laporan-keuangan?entityIds[]=...&year=...&version=INTERNAL|UMUM
if ($method === 'GET') {
    $entity_ids_raw = $_GET['entityIds'] ?? [];
    if (!is_array($entity_ids_raw)) {
        $entity_ids_raw = [$entity_ids_raw];
    }
    $entity_ids = array_filter(array_map('trim', $entity_ids_raw));

    $year    = isset($_GET['year'])    ? (int)$_GET['year']     : (int)date('Y');
    $version = strtoupper($_GET['version'] ?? 'INTERNAL');

    if (empty($entity_ids)) error_response('entityIds diperlukan (array).', 400);
    if (!in_array($version, ['INTERNAL', 'UMUM'])) {
        error_response("version tidak valid. Pilihan: INTERNAL, UMUM", 400);
    }

    $pdo = get_pdo();

    $report_cat_filter = $version === 'INTERNAL'
        ? "c.report_category IN ('INTERNAL','SEMUA')"
        : "(c.report_category IN ('UMUM','SEMUA') OR c.code = '628')";

    $date_from = "$year-01-01 00:00:00";
    $date_to   = "$year-12-31 23:59:59";

    // ── Helper: query gabungan untuk banyak entity ───────────────────────────
    $placeholders = implode(',', array_fill(0, count($entity_ids), '?'));

    // Nama entity untuk label
    $stmt_e = $pdo->prepare("SELECT id, `key`, name FROM Entity WHERE id IN ($placeholders)");
    $stmt_e->execute($entity_ids);
    $entities = $stmt_e->fetchAll(PDO::FETCH_ASSOC);

    // ── Exclusion list noBukti untuk seluruh entity yang dipilih ─────────────
    $all_excluded_nobukti = get_excluded_no_bukti_for_version($pdo, $entity_ids, $year, $version);

    $nobukti_sql = '';
    $nobukti_params = [];
    if (!empty($all_excluded_nobukti)) {
        $ph_ex = implode(',', array_fill(0, count($all_excluded_nobukti), '?'));
        $nobukti_sql = " AND (t.noBukti IS NULL OR t.noBukti NOT IN ($ph_ex))";
        $nobukti_params = $all_excluded_nobukti;
    }

    // ── Laba Rugi Gabungan ────────────────────────────────────────────────────
    $params_lr = array_merge($entity_ids, [$date_from, $date_to], $nobukti_params);
    $stmt_lr   = $pdo->prepare(
        "SELECT c.id, c.code, c.name, c.kategori,
                COALESCE(SUM(t.debit),  0) AS total_debit,
                COALESCE(SUM(t.kredit), 0) AS total_kredit
         FROM `Transaction` t
         JOIN CoaAccount c ON t.coaAccountId = c.id
         WHERE t.entityId IN ($placeholders)
           AND t.tanggal BETWEEN ? AND ?
           AND c.kategori IN ('PENDAPATAN','BEBAN')
           AND $report_cat_filter
           AND (t.extraFieldsJson IS NULL OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') IS NULL OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') != 'true')
           $nobukti_sql
         GROUP BY c.id, c.code, c.name, c.kategori
         ORDER BY c.code ASC"
    );
    $stmt_lr->execute($params_lr);
    $lr_rows = $stmt_lr->fetchAll(PDO::FETCH_ASSOC);

    $pendapatan = [];
    $beban      = [];
    foreach ($lr_rows as $row) {
        $total_d = (float)$row['total_debit'];
        $total_k = (float)$row['total_kredit'];
        if ($row['kategori'] === 'PENDAPATAN') {
            $pendapatan[] = [
                'id'       => $row['id'],
                'code'     => $row['code'],
                'name'     => $row['name'],
                'kategori' => $row['kategori'],
                'saldo'    => $total_k - $total_d,
                'debit'    => $total_d,
                'kredit'   => $total_k,
            ];
        } else {
            $is_mkt = ($row['code'] === '628');
            $code   = ($version === 'UMUM' && $is_mkt) ? '150' : $row['code'];
            $name   = ($version === 'UMUM' && $is_mkt) ? 'Kas Titipan' : $row['name'];
            $saldo  = $total_d - $total_k;

            $beban[] = [
                'id'       => $row['id'],
                'code'     => $code,
                'name'     => $name,
                'kategori' => $row['kategori'],
                'saldo'    => $saldo,
                'debit'    => $total_d,
                'kredit'   => $total_k,
            ];
        }
    }

    // Penyusutan gabungan
    $total_beban_penyusutan_gabungan     = 0.0;
    $total_akumulasi_penyusutan_gabungan = 0.0;
    $total_harga_perolehan_gabungan      = 0.0;
    $rekap_aset_gabungan = [
        'TANAH'            => ['beban' => 0.0, 'akumulasi' => 0.0, 'count' => 0, 'harga_perolehan' => 0.0, 'nilai_buku' => 0.0],
        'BANGUNAN'         => ['beban' => 0.0, 'akumulasi' => 0.0, 'count' => 0, 'harga_perolehan' => 0.0, 'nilai_buku' => 0.0],
        'KENDARAAN'        => ['beban' => 0.0, 'akumulasi' => 0.0, 'count' => 0, 'harga_perolehan' => 0.0, 'nilai_buku' => 0.0],
        'PERALATAN_KANTOR' => ['beban' => 0.0, 'akumulasi' => 0.0, 'count' => 0, 'harga_perolehan' => 0.0, 'nilai_buku' => 0.0],
    ];
    foreach ($entity_ids as $eid) {
        $ps = get_penyusutan_summary($eid, $year);
        $total_beban_penyusutan_gabungan     += (float)$ps['total_beban'];
        $total_akumulasi_penyusutan_gabungan += (float)$ps['total_akumulasi'];
        $total_harga_perolehan_gabungan      += (float)($ps['total_harga_perolehan'] ?? 0);
        foreach ($ps['rekap'] as $kat => $rv) {
            if (isset($rekap_aset_gabungan[$kat])) {
                $rekap_aset_gabungan[$kat]['beban']           += $rv['beban'];
                $rekap_aset_gabungan[$kat]['akumulasi']       += $rv['akumulasi'];
                $rekap_aset_gabungan[$kat]['count']           += $rv['count'];
                $rekap_aset_gabungan[$kat]['harga_perolehan'] += $rv['harga_perolehan'] ?? 0.0;
                $rekap_aset_gabungan[$kat]['nilai_buku']      += $rv['nilai_buku']      ?? 0.0;
            }
        }
    }

    // Tambahkan beban penyusutan ke akun 512
    if ($total_beban_penyusutan_gabungan > 0) {
        $found_depr = -1;
        foreach ($beban as $idx => $b) {
            if (in_array($b['code'], ['512', '540']) || preg_match('/penyusutan/i', $b['name'])) {
                $found_depr = $idx;
                break;
            }
        }
        if ($found_depr !== -1) {
            $beban[$found_depr]['saldo'] = $total_beban_penyusutan_gabungan;
            $beban[$found_depr]['debit'] = $total_beban_penyusutan_gabungan;
        } else {
            $beban[] = [
                'id'       => null,
                'code'     => '512',
                'name'     => 'Beban Penyusutan Aset Tetap',
                'kategori' => 'BEBAN',
                'saldo'    => $total_beban_penyusutan_gabungan,
                'debit'    => $total_beban_penyusutan_gabungan,
                'kredit'   => 0.0,
                'isAuto'   => true,
            ];
        }
    }

    // Pendapatan dari FakturPendapatan yang belum dijurnal
    $stmt_rec = $pdo->prepare(
        "SELECT DISTINCT t.noBukti, t.fakturId, JSON_VALUE(t.extraFieldsJson, '$.fakturId') AS extraFakturId
         FROM `Transaction` t
         JOIN CoaAccount c ON t.coaAccountId = c.id
         WHERE t.entityId IN ($placeholders) AND t.tanggal BETWEEN ? AND ? AND c.kategori = 'PENDAPATAN'
           AND (t.extraFieldsJson IS NULL OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') IS NULL OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') != 'true')"
    );
    $stmt_rec->execute(array_merge($entity_ids, [$date_from, $date_to]));
    $rec_nobukti = [];
    $rec_faktur_ids = [];
    foreach ($stmt_rec->fetchAll(PDO::FETCH_ASSOC) as $rec) {
        if (!empty($rec['noBukti']))       $rec_nobukti[]    = $rec['noBukti'];
        if (!empty($rec['fakturId']))      $rec_faktur_ids[] = $rec['fakturId'];
        if (!empty($rec['extraFakturId'])) $rec_faktur_ids[] = $rec['extraFakturId'];
    }
    $rec_nobukti    = array_unique(array_filter($rec_nobukti));
    $rec_faktur_ids = array_unique(array_filter($rec_faktur_ids));

    $faktur_conds  = ["f.entityId IN ($placeholders)", "f.tahunPajak = ?"];
    $faktur_params = array_merge($entity_ids, [$year]);

    if (!empty($rec_nobukti)) {
        $ph = implode(',', array_fill(0, count($rec_nobukti), '?'));
        $faktur_conds[] = "f.noFaktur NOT IN ($ph)";
        $faktur_params  = array_merge($faktur_params, $rec_nobukti);
    }
    if (!empty($rec_faktur_ids)) {
        $ph = implode(',', array_fill(0, count($rec_faktur_ids), '?'));
        $faktur_conds[] = "f.id NOT IN ($ph)";
        $faktur_params  = array_merge($faktur_params, $rec_faktur_ids);
    }

    $stmt_faktur = $pdo->prepare(
        "SELECT COALESCE(SUM(f.nilaiProyek), 0) FROM FakturPendapatan f WHERE " . implode(' AND ', $faktur_conds)
    );
    $stmt_faktur->execute($faktur_params);
    $faktur_unlinked_gabungan = (float)$stmt_faktur->fetchColumn();

    if ($faktur_unlinked_gabungan > 0) {
        $found_rev = -1;
        foreach ($pendapatan as $idx => $p) {
            if ($p['code'] === '400' || preg_match('/pendapatan/i', $p['name'])) {
                $found_rev = $idx;
                break;
            }
        }
        if ($found_rev !== -1) {
            $pendapatan[$found_rev]['kredit'] += $faktur_unlinked_gabungan;
            $pendapatan[$found_rev]['saldo']  += $faktur_unlinked_gabungan;
        } else {
            $pendapatan[] = [
                'id'       => null,
                'code'     => '400',
                'name'     => 'Pendapatan Proyek (E-Faktur)',
                'kategori' => 'PENDAPATAN',
                'saldo'    => $faktur_unlinked_gabungan,
                'debit'    => 0.0,
                'kredit'   => $faktur_unlinked_gabungan,
                'isAuto'   => true,
            ];
        }
    }

    $total_pendapatan = array_sum(array_column($pendapatan, 'saldo'));
    $total_beban      = array_sum(array_column($beban,      'saldo'));
    $laba_bersih      = $total_pendapatan - $total_beban;

    // ── Neraca Gabungan ───────────────────────────────────────────────────────
    $params_neraca = array_merge($entity_ids, [$year], $entity_ids, [$date_from, $date_to], $nobukti_params);
    $stmt_neraca   = $pdo->prepare(
        "SELECT c.id, c.code, c.name, c.kategori, c.reportType,
                COALESCE(SUM(sa.nominal), 0) AS saldo_awal,
                COALESCE(SUM(t.debit),   0) AS total_debit,
                COALESCE(SUM(t.kredit),  0) AS total_kredit
         FROM CoaAccount c
         LEFT JOIN SaldoAwal sa
           ON sa.coaAccountId = c.id
           AND sa.entityId IN ($placeholders)
           AND sa.year = ?
         LEFT JOIN `Transaction` t
           ON  t.coaAccountId = c.id
           AND t.entityId IN ($placeholders)
           AND t.tanggal BETWEEN ? AND ?
           AND (t.extraFieldsJson IS NULL OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') IS NULL OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') != 'true')
           $nobukti_sql
         WHERE c.kategori IN ('ASET','KEWAJIBAN','MODAL')
           AND $report_cat_filter
         GROUP BY c.id, c.code, c.name, c.kategori, c.reportType
         ORDER BY c.code ASC"
    );
    $stmt_neraca->execute($params_neraca);
    $neraca_rows = $stmt_neraca->fetchAll(PDO::FETCH_ASSOC);

    $aktiva_lancar      = [];
    $aktiva_tetap       = [];
    $kewajiban          = [];
    $modal              = [];
    $laba_ditahan_saldo = 0.0;
    $laba_ditahan_item  = null;

    foreach ($neraca_rows as $row) {
        $sa    = (float)$row['saldo_awal'];
        $debit = (float)$row['total_debit'];
        $kredit= (float)$row['total_kredit'];
        $saldo = hitung_saldo_akhir($row['kategori'], $row['code'], $sa, $debit, $kredit);

        $has_activity = ($sa != 0.0 || $debit != 0.0 || $kredit != 0.0);
        $is_contra    = is_contra_aset($row['code']);

        $line = [
            'id'       => $row['id'],
            'code'     => $row['code'],
            'name'     => $row['name'],
            'kategori' => $row['kategori'],
            'saldo'    => $saldo,
            'isContra' => $is_contra,
        ];

        if ($row['kategori'] === 'ASET') {
            if (is_aktiva_tetap($row['code'], $row['name'])) {
                if ($has_activity || $row['code'] === '100' || $row['code'] === '1001') {
                    $aktiva_tetap[] = $line;
                }
            } else {
                if ($has_activity) {
                    $aktiva_lancar[] = $line;
                }
            }
        } elseif ($row['kategori'] === 'KEWAJIBAN') {
            if ($has_activity) {
                $kewajiban[] = $line;
            }
        } elseif ($row['kategori'] === 'MODAL') {
            if (is_laba_ditahan($row['code'], $row['name'])) {
                $laba_ditahan_saldo = $saldo;
                $laba_ditahan_item  = $line;
            } else {
                if ($has_activity || $row['code'] === '320') {
                    $modal[] = $line;
                }
            }
        }
    }

    // Sinkronkan Aktiva Tetap & Akumulasi Penyusutan
    if ($total_akumulasi_penyusutan_gabungan > 0 || $total_harga_perolehan_gabungan > 0) {
        $akm_found = false;
        foreach ($aktiva_tetap as &$at) {
            if (!empty($at['isContra']) || $at['code'] === '1001' || preg_match('/penyusutan/i', $at['name'])) {
                $at['saldo']    = $total_akumulasi_penyusutan_gabungan;
                $at['isContra'] = true;
                $akm_found      = true;
                break;
            }
        }
        unset($at);

        if (!$akm_found && $total_akumulasi_penyusutan_gabungan > 0) {
            $aktiva_tetap[] = [
                'id'       => null,
                'code'     => '1001',
                'name'     => 'Akumulasi Penyusutan Aset',
                'kategori' => 'ASET',
                'saldo'    => $total_akumulasi_penyusutan_gabungan,
                'isContra' => true,
            ];
        }

        $perolehan_found = false;
        foreach ($aktiva_tetap as &$at) {
            if (empty($at['isContra']) && ($at['code'] === '100' || preg_match('/aktiva tetap|aset tetap/i', $at['name']))) {
                if ($at['saldo'] == 0 || $at['saldo'] < $total_harga_perolehan_gabungan) {
                    $at['saldo'] = $total_harga_perolehan_gabungan;
                }
                $perolehan_found = true;
                break;
            }
        }
        unset($at);

        if (!$perolehan_found && $total_harga_perolehan_gabungan > 0) {
            array_unshift($aktiva_tetap, [
                'id'       => null,
                'code'     => '100',
                'name'     => 'Aktiva Tetap (Perolehan)',
                'kategori' => 'ASET',
                'saldo'    => $total_harga_perolehan_gabungan,
                'isContra' => false,
            ]);
        }
    }

    // Inter-entity netting
    $inter_entity_pairs = [
        ['111', '311'], ['112', '312'], ['113', '313'], ['114', '314'], ['115', '315'],
        ['117', '317'],
    ];
    foreach ($inter_entity_pairs as [$p_code, $h_code]) {
        $p_idx = -1;
        foreach ($aktiva_lancar as $i => $item) {
            if ($item['code'] === $p_code) { $p_idx = $i; break; }
        }
        $h_idx = -1;
        foreach ($kewajiban as $i => $item) {
            if ($item['code'] === $h_code) { $h_idx = $i; break; }
        }
        if ($p_idx !== -1 && $h_idx !== -1) {
            $p_saldo = (float)$aktiva_lancar[$p_idx]['saldo'];
            $h_saldo = (float)$kewajiban[$h_idx]['saldo'];
            if ($p_saldo >= $h_saldo) {
                $aktiva_lancar[$p_idx]['saldo'] = $p_saldo - $h_saldo;
                array_splice($kewajiban, $h_idx, 1);
                if (abs($aktiva_lancar[$p_idx]['saldo']) < 0.01) {
                    array_splice($aktiva_lancar, $p_idx, 1);
                }
            } else {
                $kewajiban[$h_idx]['saldo'] = $h_saldo - $p_saldo;
                array_splice($aktiva_lancar, $p_idx, 1);
                if (abs($kewajiban[$h_idx]['saldo']) < 0.01) {
                    array_splice($kewajiban, $h_idx, 1);
                }
            }
        }
    }

    // Laba Ditahan & Ekuitas
    $total_laba_ditahan = $laba_ditahan_saldo + $laba_bersih;
    if ($laba_ditahan_item) {
        $laba_ditahan_item['saldo']        = $total_laba_ditahan;
        $laba_ditahan_item['labaBerjalan']  = $laba_bersih;
        array_unshift($modal, $laba_ditahan_item);
    } else {
        array_unshift($modal, [
            'id'           => null,
            'code'         => '310',
            'name'         => 'Laba Ditahan',
            'kategori'     => 'MODAL',
            'saldo'        => $total_laba_ditahan,
            'labaBerjalan' => $laba_bersih,
        ]);
    }

    $held_summary=transitory_cash_summary($pdo,$entity_ids,substr($date_to,0,10));
    $aktiva_lancar=transitory_asset_line($aktiva_lancar,$held_summary['ledgerHeld']);
    $total_aktiva_lancar = 0.0;
    foreach ($aktiva_lancar as $item) {
        $total_aktiva_lancar += !empty($item['isContra']) ? -$item['saldo'] : $item['saldo'];
    }

    $total_aktiva_tetap = 0.0;
    foreach ($aktiva_tetap as $item) {
        $total_aktiva_tetap += !empty($item['isContra']) ? -$item['saldo'] : $item['saldo'];
    }

    $total_aktiva = $total_aktiva_lancar + $total_aktiva_tetap;

    $total_kewajiban = 0.0;
    foreach ($kewajiban as $item) {
        $total_kewajiban += (float)$item['saldo'];
    }

    $total_modal = 0.0;
    foreach ($modal as $item) {
        $total_modal += (float)$item['saldo'];
    }

    $total_passiva = $total_kewajiban + $total_modal;

    // ── Arus Kas Gabungan (Monthly) ──────────────────────────────────────────
    $params_ak = array_merge($entity_ids, [$date_from, $date_to], $nobukti_params);
    $cash_debit_sql=transitory_cash_sql($pdo,'debit'); $cash_credit_sql=transitory_cash_sql($pdo,'kredit');
    $stmt_ak   = $pdo->prepare(
        "SELECT MONTH(t.tanggal) AS bulan,
                COALESCE(SUM($cash_debit_sql),  0) AS total_masuk,
                COALESCE(SUM($cash_credit_sql), 0) AS total_keluar
         FROM `Transaction` t
         JOIN CoaAccount c ON t.coaAccountId = c.id
         WHERE t.entityId IN ($placeholders)
           AND t.tanggal BETWEEN ? AND ?
           AND c.reportType = 'ARUS_KAS'
           AND (t.extraFieldsJson IS NULL OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') IS NULL OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') != 'true')
           $nobukti_sql
         GROUP BY MONTH(t.tanggal)
         ORDER BY bulan ASC"
    );
    $stmt_ak->execute($params_ak);
    $ak_rows = $stmt_ak->fetchAll(PDO::FETCH_ASSOC);

    $nama_bulan = [
        1=>'Januari',2=>'Februari',3=>'Maret',4=>'April',5=>'Mei',6=>'Juni',
        7=>'Juli',8=>'Agustus',9=>'September',10=>'Oktober',11=>'November',12=>'Desember',
    ];

    $ak_map = [];
    foreach ($ak_rows as $r) {
        $ak_map[(int)$r['bulan']] = ['masuk' => (float)$r['total_masuk'], 'keluar' => (float)$r['total_keluar']];
    }
    $arus_kas_monthly = [];
    for ($m = 1; $m <= 12; $m++) {
        $masuk  = $ak_map[$m]['masuk']  ?? 0.0;
        $keluar = $ak_map[$m]['keluar'] ?? 0.0;
        $arus_kas_monthly[] = [
            'bulan'     => $m,
            'namaBulan' => $nama_bulan[$m],
            'masuk'     => $masuk,
            'keluar'    => $keluar,
            'neto'      => $masuk - $keluar,
        ];
    }

    $cash_summary=['kasTotal'=>0.0,'kasTersedia'=>0.0,'kasDitahan'=>0.0,'kasAwal'=>0.0];
    foreach($entity_ids as $cash_entity) { $item=transitory_company_cash($pdo,$cash_entity,$year,$version); foreach(array_keys($cash_summary) as $key) $cash_summary[$key]+=$item[$key]; }
    json_response([
        'kas'=>$cash_summary,
        'entityIds'           => $entity_ids,
        'entities'            => $entities,
        'year'                => $year,
        'version'             => $version,
        'labaRugi' => [
            'pendapatan'      => $pendapatan,
            'beban'           => $beban,
            'totalPendapatan' => $total_pendapatan,
            'totalBeban'      => $total_beban,
            'labaBersih'      => $laba_bersih,
            'bebanPenyusutan' => $total_beban_penyusutan_gabungan,
            'fakturUnlinked'  => $faktur_unlinked_gabungan,
        ],
        'neraca' => [
            'aktivaLancar'          => $aktiva_lancar,
            'aktivaTetap'           => $aktiva_tetap,
            'kewajiban'             => $kewajiban,
            'modal'                 => $modal,
            'totalAktivaLancar'     => $total_aktiva_lancar,
            'totalAktivaTetap'      => $total_aktiva_tetap,
            'totalAktiva'           => $total_aktiva,
            'totalKewajiban'        => $total_kewajiban,
            'totalModal'            => $total_modal,
            'totalKewajibanModal'   => $total_passiva,
            'totalPassiva'          => $total_passiva,
            'akumulasiPenyusutan'   => $total_akumulasi_penyusutan_gabungan,
            'rekapPerKategoriAset'  => $rekap_aset_gabungan,
            'selisih'               => round($total_aktiva - $total_passiva, 2),
            'balanced'              => abs($total_aktiva - $total_passiva) < 1,
        ],
        'arusKas' => [
            'monthly'     => $arus_kas_monthly,
            'totalMasuk'  => array_sum(array_column($arus_kas_monthly, 'masuk')),
            'totalKeluar' => array_sum(array_column($arus_kas_monthly, 'keluar')),
            'totalNeto'   => array_sum(array_column($arus_kas_monthly, 'neto')),
        ],
    ]);
}

error_response('Endpoint tidak ditemukan.', 404);
