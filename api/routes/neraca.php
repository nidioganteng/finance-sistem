<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');
require_once __DIR__.'/../helpers/kas-transitory.php';

require_once __DIR__ . '/../helpers/akuntansi-helpers.php';

$user = require_auth();

// GET /api/neraca?entityId=...&year=...&version=INTERNAL|UMUM
if ($method === 'GET') {
    $entity_id = $_GET['entityId'] ?? null;
    $year      = isset($_GET['year'])    ? (int)$_GET['year']    : (int)date('Y');
    $version   = strtoupper($_GET['version'] ?? 'INTERNAL');

    if (!$entity_id) error_response('entityId diperlukan.', 400);
    if (!in_array($version, ['INTERNAL', 'UMUM'])) error_response("version tidak valid. Pilihan: INTERNAL, UMUM", 400);

    $pdo = get_pdo();

    // Filter reportCategory berdasarkan versi
    $report_cat_filter = $version === 'INTERNAL'
        ? "c.report_category IN ('INTERNAL','SEMUA')"
        : "(c.report_category IN ('UMUM','SEMUA') OR c.code = '628')";

    $date_from = "$year-01-01 00:00:00";
    $date_to   = "$year-12-31 23:59:59";

    // ── Handler Khusus: type=utang-aset ──────────────────────────────────────
    $type = $_GET['type'] ?? '';
    if ($type === 'utang-aset') {
        $stmt_res = $pdo->prepare('SELECT id FROM Entity WHERE id = ? OR `key` = ?');
        $stmt_res->execute([$entity_id, $entity_id]);
        $resolved_entity_id = $stmt_res->fetchColumn() ?: $entity_id;

        $stmt_kewajiban = $pdo->query("SELECT id, code, name FROM CoaAccount WHERE kategori = 'KEWAJIBAN' ORDER BY code ASC");
        $all_kewajiban = $stmt_kewajiban->fetchAll(PDO::FETCH_ASSOC);

        $stmt_aset = $pdo->query("SELECT id, code, name FROM CoaAccount WHERE kategori = 'ASET' ORDER BY code ASC");
        $all_aset = $stmt_aset->fetchAll(PDO::FETCH_ASSOC);

        $stmt_sa = $pdo->prepare("SELECT coaAccountId, COALESCE(nominal, 0) as nominal FROM SaldoAwal WHERE entityId = ? AND year = ?");
        $stmt_sa->execute([$resolved_entity_id, $year]);
        $sa_map = [];
        foreach ($stmt_sa->fetchAll(PDO::FETCH_ASSOC) as $sa) {
            $sa_map[$sa['coaAccountId']] = (float)$sa['nominal'];
        }

        $stmt_tx = $pdo->prepare(
            "SELECT t.coaAccountId, c.kategori,
                    COALESCE(SUM(t.debit),  0) AS total_debit,
                    COALESCE(SUM(t.kredit), 0) AS total_kredit
             FROM `Transaction` t
             JOIN CoaAccount c ON t.coaAccountId = c.id
             WHERE t.entityId = ?
               AND t.tanggal BETWEEN ? AND ?
               AND c.kategori IN ('KEWAJIBAN','ASET')
               AND (t.extraFieldsJson IS NULL OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') IS NULL OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') != 'true')
             GROUP BY t.coaAccountId, c.kategori"
        );
        $stmt_tx->execute([$resolved_entity_id, $date_from, $date_to]);
        $tx_map = [];
        foreach ($stmt_tx->fetchAll(PDO::FETCH_ASSOC) as $tx) {
            $tx_map[$tx['coaAccountId']] = [
                'debit'  => (float)$tx['total_debit'],
                'kredit' => (float)$tx['total_kredit'],
            ];
        }

        $fmt_rp = function(float $n): string {
            return 'Rp ' . number_format(abs($n), 0, ',', '.');
        };

        $utang_rows = [];
        $total_utang = 0.0;
        foreach ($all_kewajiban as $coa) {
            $sa = $sa_map[$coa['id']] ?? 0.0;
            $mut = $tx_map[$coa['id']] ?? ['debit' => 0.0, 'kredit' => 0.0];
            $masuk = $mut['kredit'];
            $keluar = $mut['debit'];
            $saldo = $sa + $masuk - $keluar;
            $total_utang += $saldo;

            $utang_rows[] = [
                'code'         => $coa['code'],
                'name'         => $coa['name'],
                'saldoAwal'    => $sa,
                'masuk'        => $masuk,
                'keluar'       => $keluar,
                'saldo'        => $saldo,
                'saldoAwalFmt' => $fmt_rp($sa),
                'masukFmt'     => $fmt_rp($masuk),
                'keluarFmt'    => $fmt_rp($keluar),
                'saldoFmt'     => $fmt_rp($saldo),
                'saldoPositif' => $saldo >= 0,
            ];
        }

        usort($utang_rows, function($a, $b) {
            $hasA = $a['saldoAwal'] != 0 || $a['masuk'] != 0 || $a['keluar'] != 0;
            $hasB = $b['saldoAwal'] != 0 || $b['masuk'] != 0 || $b['keluar'] != 0;
            if ($hasA && !$hasB) return -1;
            if (!$hasA && $hasB) return 1;
            return strcmp($a['code'], $b['code']);
        });

        $aset_rows = [];
        $total_aset = 0.0;
        foreach ($all_aset as $coa) {
            $sa = $sa_map[$coa['id']] ?? 0.0;
            $mut = $tx_map[$coa['id']] ?? ['debit' => 0.0, 'kredit' => 0.0];
            $masuk = $mut['debit'];
            $keluar = $mut['kredit'];
            $saldo = $sa + $masuk - $keluar;

            if ($sa != 0 || $masuk != 0 || $keluar != 0) {
                $total_aset += $saldo;
                $aset_rows[] = [
                    'code'         => $coa['code'],
                    'name'         => $coa['name'],
                    'saldoAwal'    => $sa,
                    'masuk'        => $masuk,
                    'keluar'       => $keluar,
                    'saldo'        => $saldo,
                    'saldoAwalFmt' => $fmt_rp($sa),
                    'masukFmt'     => $fmt_rp($masuk),
                    'keluarFmt'    => $fmt_rp($keluar),
                    'saldoFmt'     => $fmt_rp($saldo),
                    'saldoPositif' => $saldo >= 0,
                ];
            }
        }

        $networth = $total_aset - $total_utang;

        json_response([
            'utang' => [
                'rows'     => $utang_rows,
                'total'    => $total_utang,
                'totalFmt' => $fmt_rp($total_utang),
            ],
            'aset' => [
                'rows'     => $aset_rows,
                'total'    => $total_aset,
                'totalFmt' => $fmt_rp($total_aset),
            ],
            'networth'        => $networth,
            'networthFmt'     => $fmt_rp($networth),
            'networthPositif' => $networth >= 0,
            'year'            => $year,
        ]);
    }

    // ── Ambil exclusion list noBukti untuk isolasi versi ──────────────────────
    $excluded_nobukti = get_excluded_no_bukti_for_version($pdo, $entity_id, $year, $version);
    $nobukti_sql = '';
    $nobukti_params = [];
    if (!empty($excluded_nobukti)) {
        $placeholders = implode(',', array_fill(0, count($excluded_nobukti), '?'));
        $nobukti_sql = " AND (t.noBukti IS NULL OR t.noBukti NOT IN ($placeholders))";
        $nobukti_params = $excluded_nobukti;
    }

    // ── Ambil semua akun COA yang valid untuk versi ini ───────────────────────
    $stmt_coa = $pdo->prepare(
        "SELECT id, code, name, kategori, reportType, report_category AS reportCategory, urutan
         FROM CoaAccount c
         WHERE $report_cat_filter
         ORDER BY c.urutan ASC, c.code ASC"
    );
    $stmt_coa->execute();
    $all_coa = $stmt_coa->fetchAll(PDO::FETCH_ASSOC);

    // ── Ambil Saldo Awal per coaAccountId ────────────────────────────────────
    $stmt_sa = $pdo->prepare(
        "SELECT coaAccountId, COALESCE(nominal, 0) AS nominal
         FROM SaldoAwal
         WHERE entityId = ? AND year = ?"
    );
    $stmt_sa->execute([$entity_id, $year]);
    $saldo_awal_map = [];
    foreach ($stmt_sa->fetchAll(PDO::FETCH_ASSOC) as $sa) {
        $saldo_awal_map[$sa['coaAccountId']] = (float)$sa['nominal'];
    }

    // ── Ambil total debit & kredit per coaAccountId (tanpa mirror row) ─────────
    $tx_sql = "SELECT t.coaAccountId,
                      COALESCE(SUM(t.debit), 0) AS debit,
                      COALESCE(SUM(t.kredit), 0) AS kredit
               FROM `Transaction` t
               JOIN CoaAccount c ON t.coaAccountId = c.id
               WHERE t.entityId = ?
                 AND t.tanggal BETWEEN ? AND ?
                 AND $report_cat_filter
                 AND (t.extraFieldsJson IS NULL OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') IS NULL OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') != 'true')
                 $nobukti_sql
               GROUP BY t.coaAccountId";
    $stmt_tx = $pdo->prepare($tx_sql);
    $stmt_tx->execute(array_merge([$entity_id, $date_from, $date_to], $nobukti_params));
    $tx_totals = [];
    foreach ($stmt_tx->fetchAll(PDO::FETCH_ASSOC) as $tx) {
        $tx_totals[$tx['coaAccountId']] = [
            'debit'  => (float)$tx['debit'],
            'kredit' => (float)$tx['kredit'],
        ];
    }

    // ── Modul Aktiva Tetap: ringkasan perolehan, akumulasi, dan beban ─────────
    $penyusutan_summary    = get_penyusutan_summary($entity_id, $year);
    $beban_penyusutan      = (float)($penyusutan_summary['total_beban'] ?? 0);
    $akumulasi_penyusutan  = (float)($penyusutan_summary['total_akumulasi'] ?? 0);
    $total_harga_perolehan = (float)($penyusutan_summary['total_harga_perolehan'] ?? 0);

    // ── Hitung Laba Bersih Tahun Berjalan dari akun nominal (PENDAPATAN & BEBAN)
    $total_pendapatan = 0.0;
    $total_beban      = 0.0;

    foreach ($all_coa as $coa) {
        $cur = $tx_totals[$coa['id']] ?? ['debit' => 0.0, 'kredit' => 0.0];
        $debit  = $cur['debit'];
        $kredit = $cur['kredit'];

        if ($coa['kategori'] === 'PENDAPATAN') {
            $total_pendapatan += ($kredit - $debit);
        } elseif ($coa['kategori'] === 'BEBAN') {
            // Hindari dobel hitung jika akun penyusutan manual sudah ada transaksi
            $is_depr_coa = in_array($coa['code'], ['512', '540']) || preg_match('/penyusutan/i', $coa['name']);
            if ($is_depr_coa && $beban_penyusutan > 0) {
                // Diperhitungkan via beban_penyusutan modul di bawah
            } else {
                $total_beban += ($debit - $kredit);
            }
        }
    }

    if ($beban_penyusutan > 0) {
        $total_beban += $beban_penyusutan;
    }

    // Sinkronisasi unlinked FakturPendapatan ke total pendapatan (seperti Laba-Rugi)
    $stmt_rec = $pdo->prepare(
        "SELECT DISTINCT t.noBukti, t.fakturId, JSON_VALUE(t.extraFieldsJson, '$.fakturId') AS extraFakturId
         FROM `Transaction` t
         JOIN CoaAccount c ON t.coaAccountId = c.id
         WHERE t.entityId = ? AND t.tanggal BETWEEN ? AND ? AND c.kategori = 'PENDAPATAN'
           AND (t.extraFieldsJson IS NULL OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') IS NULL OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') != 'true')"
    );
    $stmt_rec->execute([$entity_id, $date_from, $date_to]);
    $rec_nobukti = [];
    $rec_faktur_ids = [];
    foreach ($stmt_rec->fetchAll(PDO::FETCH_ASSOC) as $rec) {
        if (!empty($rec['noBukti'])) $rec_nobukti[] = $rec['noBukti'];
        if (!empty($rec['fakturId'])) $rec_faktur_ids[] = $rec['fakturId'];
        if (!empty($rec['extraFakturId'])) $rec_faktur_ids[] = $rec['extraFakturId'];
    }
    $rec_nobukti = array_unique(array_filter($rec_nobukti));
    $rec_faktur_ids = array_unique(array_filter($rec_faktur_ids));

    $faktur_conds = ["f.entityId = ?", "f.tahunPajak = ?"];
    $faktur_params = [$entity_id, $year];
    if (!empty($rec_nobukti)) {
        $ph = implode(',', array_fill(0, count($rec_nobukti), '?'));
        $faktur_conds[] = "f.noFaktur NOT IN ($ph)";
        $faktur_params = array_merge($faktur_params, $rec_nobukti);
    }
    if (!empty($rec_faktur_ids)) {
        $ph = implode(',', array_fill(0, count($rec_faktur_ids), '?'));
        $faktur_conds[] = "f.id NOT IN ($ph)";
        $faktur_params = array_merge($faktur_params, $rec_faktur_ids);
    }
    $stmt_faktur = $pdo->prepare(
        "SELECT COALESCE(SUM(f.nilaiProyek), 0) FROM FakturPendapatan f WHERE " . implode(' AND ', $faktur_conds)
    );
    $stmt_faktur->execute($faktur_params);
    $unlinked_faktur = (float)$stmt_faktur->fetchColumn();
    $total_pendapatan += $unlinked_faktur;

    $laba_bersih = $total_pendapatan - $total_beban;

    // ── Pengelompokan Akun Neraca (ASET, KEWAJIBAN, MODAL) ────────────────────
    $aktiva_lancar      = [];
    $aktiva_tetap       = [];
    $kewajiban          = [];
    $modal              = [];
    $laba_ditahan_saldo = 0.0;
    $laba_ditahan_item  = null;

    foreach ($all_coa as $coa) {
        $sa    = $saldo_awal_map[$coa['id']] ?? 0.0;
        $cur   = $tx_totals[$coa['id']] ?? ['debit' => 0.0, 'kredit' => 0.0];
        $debit = $cur['debit'];
        $kredit= $cur['kredit'];

        $saldo        = hitung_saldo_akhir($coa['kategori'], $coa['code'], $sa, $debit, $kredit);
        $has_activity = ($sa != 0.0 || $debit != 0.0 || $kredit != 0.0);
        $is_contra    = is_contra_aset($coa['code']);

        $line = [
            'id'       => $coa['id'],
            'code'     => $coa['code'],
            'name'     => $coa['name'],
            'kategori' => $coa['kategori'],
            'saldo'    => $saldo,
            'isContra' => $is_contra,
        ];

        if ($coa['kategori'] === 'ASET') {
            if (is_aktiva_tetap($coa['code'], $coa['name'])) {
                if ($has_activity || $coa['code'] === '100' || $coa['code'] === '1001') {
                    $aktiva_tetap[] = $line;
                }
            } else {
                if ($has_activity) {
                    $aktiva_lancar[] = $line;
                }
            }
        } elseif ($coa['kategori'] === 'KEWAJIBAN') {
            if ($has_activity) {
                $kewajiban[] = $line;
            }
        } elseif ($coa['kategori'] === 'MODAL') {
            if (is_laba_ditahan($coa['code'], $coa['name'])) {
                $laba_ditahan_saldo = $saldo;
                $laba_ditahan_item  = $line;
            } else {
                if ($has_activity || $coa['code'] === '320') {
                    $modal[] = $line;
                }
            }
        }
    }

    // ── Sinkronkan Saldo Aktiva Tetap & Akumulasi dari Modul Aset Tetap ──────
    if (!empty($penyusutan_summary['rekap']) || $total_harga_perolehan > 0 || $akumulasi_penyusutan > 0) {
        // 1. Akun Akumulasi Penyusutan (kontra aset)
        $akm_found = false;
        foreach ($aktiva_tetap as &$at) {
            if (!empty($at['isContra']) || $at['code'] === '1001' || preg_match('/penyusutan/i', $at['name'])) {
                $at['saldo']    = $akumulasi_penyusutan;
                $at['isContra'] = true;
                $akm_found      = true;
                break;
            }
        }
        unset($at);

        if (!$akm_found && $akumulasi_penyusutan > 0) {
            $aktiva_tetap[] = [
                'id'       => null,
                'code'     => '1001',
                'name'     => 'Akumulasi Penyusutan Aset',
                'kategori' => 'ASET',
                'saldo'    => $akumulasi_penyusutan,
                'isContra' => true,
            ];
        }

        // 2. Akun Perolehan Aktiva Tetap
        $perolehan_found = false;
        foreach ($aktiva_tetap as &$at) {
            if (empty($at['isContra']) && ($at['code'] === '100' || preg_match('/aktiva tetap|aset tetap/i', $at['name']))) {
                if ($at['saldo'] == 0 || $at['saldo'] < $total_harga_perolehan) {
                    $at['saldo'] = $total_harga_perolehan;
                }
                $perolehan_found = true;
                break;
            }
        }
        unset($at);

        if (!$perolehan_found && $total_harga_perolehan > 0) {
            array_unshift($aktiva_tetap, [
                'id'       => null,
                'code'     => '100',
                'name'     => 'Aktiva Tetap (Perolehan)',
                'kategori' => 'ASET',
                'saldo'    => $total_harga_perolehan,
                'isContra' => false,
            ]);
        }
    }

    // ── Presentasi Netted Saldo Antar Entitas (Sisi lebih besar mempertahankan kode) ──
    $inter_entity_pairs = [
        ['111', '311'], // KAK (Kencana)
        ['112', '312'], // GS (Gaharu)
        ['113', '313'], // TB (Tataring)
        ['114', '314'], // CAD (Cipta Asri)
        ['115', '315'], // KP (Umum)
        ['117', '317'], // PS (Pemegang Saham)
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

    // ── Laba Ditahan & Ekuitas ────────────────────────────────────────────────
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

    // ── Hitung Total-Total Neraca Sesuai Standar Akuntansi ───────────────────
    $held_summary=transitory_cash_summary($pdo,[$entity_id],substr($date_to,0,10));
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

    $total_kewajiban_modal = $total_kewajiban + $total_modal;
    $selisih = round($total_aktiva - $total_kewajiban_modal, 2);

    json_response([
        'entityId'              => $entity_id,
        'year'                  => $year,
        'version'               => $version,
        'aktivaLancar'          => $aktiva_lancar,
        'aktivaTetap'           => $aktiva_tetap,
        'kewajiban'             => $kewajiban,
        'modal'                 => $modal,
        'totalAktivaLancar'     => $total_aktiva_lancar,
        'totalAktivaTetap'      => $total_aktiva_tetap,
        'totalAktiva'           => $total_aktiva,
        'totalKewajiban'        => $total_kewajiban,
        'totalModal'            => $total_modal,
        'totalKewajibanModal'   => $total_kewajiban_modal,
        'labaDitahan'           => $laba_ditahan_saldo,
        'totalLabaDitahan'      => $total_laba_ditahan,
        'labaBersih'            => $laba_bersih,
        'totalPendapatan'       => $total_pendapatan,
        'totalBeban'            => $total_beban,
        'bebanPenyusutan'       => $beban_penyusutan,
        'akumulasiPenyusutan'   => $akumulasi_penyusutan,
        'rekapPerKategoriAset'  => $penyusutan_summary['rekap'],
        'selisih'               => $selisih,
        'balanced'              => abs($selisih) < 1,
    ]);
}

error_response('Endpoint tidak ditemukan.', 404);
