<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');
require_once __DIR__.'/../helpers/kas-transitory.php';

require_once __DIR__ . '/../helpers/akuntansi-helpers.php';

$user = require_auth();

// GET /api/arus-kas?entityId=...&year=...[&mode=presisi][&version=INTERNAL|UMUM]
if ($method === 'GET') {
    $mode = $_GET['mode'] ?? 'monthly';

    // Support entityId as string or array (entityId[])
    $entity_ids_raw = $_GET['entityId'] ?? [];
    if (!is_array($entity_ids_raw)) {
        $entity_ids_raw = [$entity_ids_raw];
    }
    $entity_ids = array_values(array_filter(array_map('trim', $entity_ids_raw)));

    $year    = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
    $version = strtoupper($_GET['version'] ?? 'INTERNAL');

    if (empty($entity_ids)) error_response('entityId diperlukan.', 400);

    $pdo = get_pdo();

    // ──────────────────────────────────────────────────────────────────────────
    // MODE PRESISI: Arus Kas Metode Tidak Langsung (PSAK)
    // ──────────────────────────────────────────────────────────────────────────
    if ($mode === 'presisi') {
        $norm_version = in_array($version, ['INTERNAL', 'UMUM']) ? $version : 'INTERNAL';

        // Resolve entity name
        $entity_name = 'Semua Entitas (Grup)';
        if (count($entity_ids) === 1) {
            $stmt_ent = $pdo->prepare('SELECT name FROM Entity WHERE id = ?');
            $stmt_ent->execute([$entity_ids[0]]);
            $ent_row = $stmt_ent->fetch();
            if ($ent_row) $entity_name = $ent_row['name'];
        }

        $date_from = "$year-01-01 00:00:00";
        $date_to   = "$year-12-31 23:59:59";
        $ph_entities = implode(',', array_fill(0, count($entity_ids), '?'));

        // 1. Ambil semua akun COA
        $report_cat_filter = $norm_version === 'UMUM'
            ? "c.report_category IN ('UMUM','SEMUA')"
            : "c.report_category IN ('INTERNAL','SEMUA')";

        $stmt_coa = $pdo->query("SELECT c.id, c.code, c.name, c.kategori, c.reportType FROM CoaAccount c WHERE $report_cat_filter ORDER BY c.code ASC");
        $all_accounts = $stmt_coa->fetchAll();
        $account_by_code = [];
        $account_by_id   = [];
        foreach ($all_accounts as $acc) {
            $account_by_code[$acc['code']] = $acc;
            $account_by_id[$acc['id']]     = $acc;
        }

        // 2. Ambil Saldo Awal per akun untuk entity yang dipilih
        $stmt_sa = $pdo->prepare(
            "SELECT coaAccountId, COALESCE(SUM(nominal), 0) AS total_sa
             FROM SaldoAwal
             WHERE entityId IN ($ph_entities) AND year = ?
             GROUP BY coaAccountId"
        );
        $stmt_sa->execute(array_merge($entity_ids, [$year]));
        $saldo_awal_map = [];
        foreach ($stmt_sa->fetchAll() as $sa) {
            $saldo_awal_map[$sa['coaAccountId']] = (float)$sa['total_sa'];
        }

        $held_opening=transitory_cash_summary($pdo,$entity_ids,($year-1).'-12-31');
        $saldo_awal_map[TRANSITORY_COA_ID]=$held_opening['ledgerHeld'];

        // 3. Ambil mutasi transaksi (abaikan mirror autoPostedFromJurnal)
        $stmt_tx = $pdo->prepare(
            "SELECT t.coaAccountId,
                    COALESCE(SUM(t.debit),  0) AS total_debit,
                    COALESCE(SUM(t.kredit), 0) AS total_kredit
             FROM `Transaction` t
             WHERE t.entityId IN ($ph_entities)
               AND t.tanggal BETWEEN ? AND ?
               AND t.coaAccountId IS NOT NULL
               AND (t.extraFieldsJson IS NULL OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') IS NULL OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') != 'true')
             GROUP BY t.coaAccountId"
        );
        $stmt_tx->execute(array_merge($entity_ids, [$date_from, $date_to]));
        $mutasi_debit_map  = [];
        $mutasi_kredit_map = [];
        foreach ($stmt_tx->fetchAll() as $tx) {
            $mutasi_debit_map[$tx['coaAccountId']]  = (float)$tx['total_debit'];
            $mutasi_kredit_map[$tx['coaAccountId']] = (float)$tx['total_kredit'];
        }

        // Helper delta: (Akhir - Awal)
        $get_account_delta = function(?array $account) use (&$mutasi_debit_map, &$mutasi_kredit_map): float {
            if (!$account) return 0.0;
            $debit  = $mutasi_debit_map[$account['id']]  ?? 0.0;
            $kredit = $mutasi_kredit_map[$account['id']] ?? 0.0;
            if ($account['kategori'] === 'ASET') {
                return $debit - $kredit;
            } else {
                return $kredit - $debit;
            }
        };

        // 4. Hitung Laba Bersih Setelah Pajak
        $total_pendapatan = 0.0;
        $total_beban      = 0.0;
        foreach ($all_accounts as $acc) {
            $d = $mutasi_debit_map[$acc['id']]  ?? 0.0;
            $k = $mutasi_kredit_map[$acc['id']] ?? 0.0;
            if ($acc['kategori'] === 'PENDAPATAN') {
                $total_pendapatan += ($k - $d);
            } elseif ($acc['kategori'] === 'BEBAN') {
                $total_beban += ($d - $k);
            }
        }

        // Hitung total beban penyusutan dari Modul Aset Tetap
        $penyusutan_aset_tetap = 0.0;
        foreach ($entity_ids as $eid) {
            $penyusutan_aset_tetap += total_beban_penyusutan($eid, $year);
        }

        // Sinkronisasi penyusutan aset tetap agar tidak dobel hitung
        if ($penyusutan_aset_tetap > 0) {
            $acc_penyusutan = null;
            foreach ($all_accounts as $a) {
                if ($a['code'] === '512' || $a['code'] === '540' || preg_match('/penyusutan/i', $a['name'])) {
                    $acc_penyusutan = $a;
                    break;
                }
            }
            if ($acc_penyusutan) {
                $d = $mutasi_debit_map[$acc_penyusutan['id']]  ?? 0.0;
                $k = $mutasi_kredit_map[$acc_penyusutan['id']] ?? 0.0;
                $existing_tx_penyusutan = $d - $k;
                $total_beban = $total_beban - $existing_tx_penyusutan + $penyusutan_aset_tetap;
            } else {
                $total_beban += $penyusutan_aset_tetap;
            }
        }

        $laba_bersih_setelah_pajak = $total_pendapatan - $total_beban;

        // Amortisasi & Cadangan CKPN (kode 210)
        $amortisasi_aset = 0.0;
        $cadangan_ckpn   = isset($account_by_code['210']) ? $get_account_delta($account_by_code['210']) : 0.0;
        $laba_operasi_setelah_penyesuaian = $laba_bersih_setelah_pajak + $penyusutan_aset_tetap + $amortisasi_aset + $cadangan_ckpn;

        // 5. Perubahan Modal Kerja
        // Piutang: Aset lancar, kenaikan = kas keluar (-), penurunan = kas masuk (+)
        $calc_delta_piutang = function(string $code) use (&$account_by_code, &$get_account_delta): float {
            $acc = $account_by_code[$code] ?? null;
            if (!$acc) return 0.0;
            return -$get_account_delta($acc);
        };

        $piutang_usaha   = $calc_delta_piutang('116');
        $piutang_kak     = $calc_delta_piutang('111');
        $piutang_gs      = $calc_delta_piutang('112');
        $piutang_tb      = $calc_delta_piutang('113');
        $piutang_cad     = $calc_delta_piutang('114');
        $piutang_kp      = $calc_delta_piutang('115');
        $piutang_lainnya = $calc_delta_piutang('117') + $calc_delta_piutang('118');

        // Utang: Kewajiban, kenaikan = kas masuk (+), penurunan = kas keluar (-)
        $calc_delta_utang = function(string $code) use (&$account_by_code, &$get_account_delta): float {
            $acc = $account_by_code[$code] ?? null;
            if (!$acc) return 0.0;
            return $get_account_delta($acc);
        };

        $utang_pajak                 = $calc_delta_utang('301');
        $utang_kak                   = $calc_delta_utang('311');
        $utang_gs                    = $calc_delta_utang('312');
        $utang_tb                    = $calc_delta_utang('313');
        $utang_cad                   = $calc_delta_utang('314');
        $utang_kp                    = $calc_delta_utang('315');
        $titipan                     = $calc_delta_utang('200');
        $utang_imbalan_pasca_kerja   = $calc_delta_utang('220');

        $total_modal_kerja =
            $piutang_usaha + $piutang_kak + $piutang_gs + $piutang_tb + $piutang_cad + $piutang_kp + $piutang_lainnya +
            $utang_pajak + $utang_kak + $utang_gs + $utang_tb + $utang_cad + $utang_kp +
            $titipan + $utang_imbalan_pasca_kerja;

        $total_arus_kas_operasi = $laba_operasi_setelah_penyesuaian + $total_modal_kerja;

        // 6. Aktivitas Investasi
        // Perolehan aset baru di tahun berjalan (mengurangi kas)
        $stmt_inv = $pdo->prepare(
            "SELECT COALESCE(SUM(hargaPerolehan), 0)
             FROM AsetTetap
             WHERE entityId IN ($ph_entities)
               AND tanggalPerolehan BETWEEN ? AND ?"
        );
        $stmt_inv->execute(array_merge($entity_ids, [$date_from, $date_to]));
        $perolehan_aset_tetap_raw = (float)$stmt_inv->fetchColumn();
        $perolehan_aset_tetap     = -$perolehan_aset_tetap_raw;
        $perolehan_aset_tb        = 0.0;
        $total_arus_kas_investasi = $perolehan_aset_tetap + $perolehan_aset_tb;

        // 7. Aktivitas Pendanaan
        // Setoran modal (320), Laba Ditahan (310), Prive (531)
        $acc_modal        = $account_by_code['320'] ?? null;
        $acc_laba_ditahan = $account_by_code['310'] ?? null;
        $acc_prive        = $account_by_code['531'] ?? null;

        $delta_modal        = $acc_modal        ? $get_account_delta($acc_modal)        : 0.0;
        $delta_laba_ditahan = $acc_laba_ditahan ? $get_account_delta($acc_laba_ditahan) : 0.0;
        $delta_prive        = $acc_prive        ? -$get_account_delta($acc_prive)       : 0.0;
        $laba_ditahan       = $delta_laba_ditahan + $delta_prive;
        $total_arus_kas_pendanaan = $delta_modal + $laba_ditahan;

        // 8. Rekapitulasi Kas & Setara Kas
        $kenaikan_bersih_kas = $total_arus_kas_operasi + $total_arus_kas_investasi + $total_arus_kas_pendanaan;

        // Kas awal periode (semua akun kas & bank ber-reportType ARUS_KAS atau nama kas/bank/bpd/bri/bni/mdr)
        $kas_awal_periode = 0.0;
        foreach ($all_accounts as $acc) {
            $is_kas_bank = ($acc['reportType'] === 'ARUS_KAS') || preg_match('/kas|bank|bri|bpd|bni|mdr/i', $acc['name']);
            if ($is_kas_bank) {
                $kas_awal_periode += $saldo_awal_map[$acc['id']] ?? 0.0;
            }
        }
        $kas_akhir_periode = $kas_awal_periode + $kenaikan_bersih_kas;

        // 9. Konstruksi Flat Rows sesuai format ArusKasRow
        $rows = [
            // Operasi
            ['label' => 'Arus Kas dan Setara Kas dari Aktivitas Operasi', 'amount' => 0.0, 'level' => 0, 'isHeader' => true],
            ['label' => 'Laba bersih setelah pajak', 'amount' => $laba_bersih_setelah_pajak, 'level' => 1],
            ['label' => 'Penyesuaian untuk merekonsiliasi laba bersih menjadi kas bersih diperoleh dari kegiatan operasi :', 'amount' => 0.0, 'level' => 1, 'isHeader' => true],
            ['label' => 'Penyusutan Aset Tetap', 'amount' => $penyusutan_aset_tetap, 'level' => 2],
            ['label' => 'Amortisasi aset tidak berwujud', 'amount' => $amortisasi_aset, 'level' => 2],
            ['label' => 'Cadangan Kerugian Penurunan Nilai', 'amount' => $cadangan_ckpn, 'level' => 2],
            ['label' => 'Laba Operasi setelah penyesuaian kas bersih', 'amount' => $laba_operasi_setelah_penyesuaian, 'level' => 1, 'isSubtotal' => true],

            // Modal Kerja
            ['label' => 'Perubahan Modal Kerja :', 'amount' => 0.0, 'level' => 1, 'isHeader' => true],
            ['label' => 'Piutang Usaha', 'amount' => $piutang_usaha, 'level' => 2, 'code' => '116'],
            ['label' => 'Piutang Pihak Berelasi :', 'amount' => 0.0, 'level' => 2, 'isHeader' => true],
            ['label' => 'Piutang KAK', 'amount' => $piutang_kak, 'level' => 3, 'code' => '111'],
            ['label' => 'Piutang GS',  'amount' => $piutang_gs,  'level' => 3, 'code' => '112'],
            ['label' => 'Piutang TB',  'amount' => $piutang_tb,  'level' => 3, 'code' => '113'],
            ['label' => 'Piutang KP',  'amount' => $piutang_kp,  'level' => 3, 'code' => '115'],
        ];

        if ($piutang_cad != 0) {
            $rows[] = ['label' => 'Piutang CAD', 'amount' => $piutang_cad, 'level' => 3, 'code' => '114'];
        }
        if ($piutang_lainnya != 0) {
            $rows[] = ['label' => 'Piutang Lainnya', 'amount' => $piutang_lainnya, 'level' => 3, 'code' => '118'];
        }

        $rows[] = ['label' => 'Utang Pajak', 'amount' => $utang_pajak, 'level' => 2, 'code' => '301'];
        $rows[] = ['label' => 'Utang Perusahaan Group :', 'amount' => 0.0, 'level' => 2, 'isHeader' => true];
        $rows[] = ['label' => 'Utang KAK', 'amount' => $utang_kak, 'level' => 3, 'code' => '311'];
        $rows[] = ['label' => 'Utang GS',  'amount' => $utang_gs,  'level' => 3, 'code' => '312'];
        $rows[] = ['label' => 'Utang TB',  'amount' => $utang_tb,  'level' => 3, 'code' => '313'];

        if ($utang_cad != 0) {
            $rows[] = ['label' => 'Utang CAD', 'amount' => $utang_cad, 'level' => 3, 'code' => '314'];
        }
        if ($utang_kp != 0) {
            $rows[] = ['label' => 'Utang KP', 'amount' => $utang_kp, 'level' => 3, 'code' => '315'];
        }

        $rows[] = ['label' => 'Titipan', 'amount' => $titipan, 'level' => 2, 'code' => '200'];
        $rows[] = ['label' => 'Utang Imbalan Pasca Kerja', 'amount' => $utang_imbalan_pasca_kerja, 'level' => 2, 'code' => '220'];
        $rows[] = [
            'label' => 'Arus Kas dan Setara Kas dari Aktivitas Operasi',
            'amount' => $total_arus_kas_operasi,
            'level' => 0,
            'isSubtotal' => true,
            'isTotal' => true,
        ];

        // Investasi
        $rows[] = ['label' => 'Arus Kas dan Setara Kas dari Aktivitas Investasi', 'amount' => 0.0, 'level' => 0, 'isHeader' => true];
        $rows[] = ['label' => 'Perolehan Aset Tetap', 'amount' => $perolehan_aset_tetap, 'level' => 1];
        $rows[] = ['label' => 'Perolehan Aset Tidak Berwujud', 'amount' => $perolehan_aset_tb, 'level' => 1];
        $rows[] = [
            'label' => 'Arus Kas dan Setara Kas dari Aktivitas Investasi',
            'amount' => $total_arus_kas_investasi,
            'level' => 0,
            'isSubtotal' => true,
            'isTotal' => true,
        ];

        // Pendanaan
        $rows[] = ['label' => 'Arus Kas dan Setara Kas dari Aktivitas Pendanaan', 'amount' => 0.0, 'level' => 0, 'isHeader' => true];
        if ($delta_modal != 0) {
            $rows[] = ['label' => 'Setoran Modal Saham', 'amount' => $delta_modal, 'level' => 1, 'code' => '320'];
        }
        if ($laba_ditahan != 0 || $delta_modal == 0) {
            $rows[] = ['label' => 'Laba Ditahan', 'amount' => $laba_ditahan, 'level' => 1, 'code' => '310'];
        }
        $rows[] = [
            'label' => 'Arus Kas dan Setara Kas dari Aktivitas Pendanaan',
            'amount' => $total_arus_kas_pendanaan,
            'level' => 0,
            'isSubtotal' => true,
            'isTotal' => true,
        ];

        // Rekapitulasi Akhir
        $rows[] = [
            'label' => 'Kenaikan/ Penurunan Bersih Kas & Setara Kas',
            'amount' => $kenaikan_bersih_kas,
            'level' => 0,
            'isSubtotal' => true,
            'isTotal' => true,
        ];
        $rows[] = ['label' => 'Kas & Setara Kas Pada Awal Periode', 'amount' => $kas_awal_periode, 'level' => 0];
        $rows[] = ['label' => 'Kas & Setara Kas Pada Akhir Periode', 'amount' => $kas_akhir_periode, 'level' => 0, 'isTotal' => true];

        json_response([
            'entityName'                   => $entity_name,
            'year'                         => $year,
            'version'                      => $norm_version,
            'labaBersihSetelahPajak'       => $laba_bersih_setelah_pajak,
            'penyusutanAsetTetap'          => $penyusutan_aset_tetap,
            'amortisasiAset'               => $amortisasi_aset,
            'cadanganCKPN'                 => $cadangan_ckpn,
            'labaOperasiSetelahPenyesuaian'=> $laba_operasi_setelah_penyesuaian,
            'piutangUsaha'                 => $piutang_usaha,
            'piutangKAK'                   => $piutang_kak,
            'piutangGS'                    => $piutang_gs,
            'piutangTB'                    => $piutang_tb,
            'piutangKP'                    => $piutang_kp,
            'piutangCAD'                   => $piutang_cad,
            'piutangLainnya'               => $piutang_lainnya,
            'utangPajak'                   => $utang_pajak,
            'utangKAK'                     => $utang_kak,
            'utangGS'                      => $utang_gs,
            'utangTB'                      => $utang_tb,
            'utangCAD'                     => $utang_cad,
            'utangKP'                      => $utang_kp,
            'titipan'                      => $titipan,
            'utangImbalanPascaKerja'       => $utang_imbalan_pasca_kerja,
            'totalModalKerja'              => $total_modal_kerja,
            'totalArusKasOperasi'          => $total_arus_kas_operasi,
            'perolehanAsetTetap'           => $perolehan_aset_tetap,
            'perolehanAsetTidakBerwujud'   => $perolehan_aset_tb,
            'totalArusKasInvestasi'        => $total_arus_kas_investasi,
            'labaDitahan'                  => $laba_ditahan,
            'totalArusKasPendanaan'        => $total_arus_kas_pendanaan,
            'kenaikanBersihKas'            => $kenaikan_bersih_kas,
            'kasAwalPeriode'               => $kas_awal_periode,
            'kasAkhirPeriode'              => $kas_akhir_periode,
            'rows'                         => $rows,
        ]);
    }

    // ──────────────────────────────────────────────────────────────────────────
    // MODE DEFAULT: Arus Kas Bulanan (12 Bulan)
    // ──────────────────────────────────────────────────────────────────────────
    $entity_id = $entity_ids[0];
    $cash_debit_sql=transitory_cash_sql($pdo,'debit'); $cash_credit_sql=transitory_cash_sql($pdo,'kredit');
    $ph_entities = implode(',', array_fill(0, count($entity_ids), '?'));

    $stmt = $pdo->prepare(
        "SELECT MONTH(t.tanggal) AS bulan,
                COALESCE(SUM($cash_debit_sql),  0) AS total_masuk,
                COALESCE(SUM($cash_credit_sql), 0) AS total_keluar
         FROM `Transaction` t
         JOIN CoaAccount c ON t.coaAccountId = c.id
         WHERE t.entityId IN ($ph_entities)
           AND YEAR(t.tanggal)   = ?
           AND c.reportType      = 'ARUS_KAS'
           AND (t.extraFieldsJson IS NULL OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') IS NULL OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') != 'true')
         GROUP BY MONTH(t.tanggal)
         ORDER BY bulan ASC"
    );
    $stmt->execute(array_merge($entity_ids, [$year]));
    $rows = $stmt->fetchAll();

    $bulan_map = [];
    foreach ($rows as $row) {
        $bulan_map[(int)$row['bulan']] = [
            'masuk'  => (float)$row['total_masuk'],
            'keluar' => (float)$row['total_keluar'],
        ];
    }

    $nama_bulan = [
        1=>'Januari',2=>'Februari',3=>'Maret',4=>'April',5=>'Mei',6=>'Juni',
        7=>'Juli',8=>'Agustus',9=>'September',10=>'Oktober',11=>'November',12=>'Desember',
    ];

    $monthly     = [];
    $total_masuk = 0.0;
    $total_keluar= 0.0;

    for ($m = 1; $m <= 12; $m++) {
        $masuk  = $bulan_map[$m]['masuk']  ?? 0.0;
        $keluar = $bulan_map[$m]['keluar'] ?? 0.0;
        $neto   = $masuk - $keluar;

        $monthly[]    = [
            'bulan'      => $m,
            'namaBulan'  => $nama_bulan[$m],
            'masuk'      => $masuk,
            'keluar'     => $keluar,
            'neto'       => $neto,
        ];
        $total_masuk  += $masuk;
        $total_keluar += $keluar;
    }

    json_response([
        'entityId'    => $entity_id,
        'year'        => $year,
        'monthly'     => $monthly,
        'totalMasuk'  => $total_masuk,
        'totalKeluar' => $total_keluar,
        'totalNeto'   => $total_masuk - $total_keluar,
    ]);
}

error_response('Endpoint tidak ditemukan.', 404);
