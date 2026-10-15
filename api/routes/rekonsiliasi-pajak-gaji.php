<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

// ─── Router: /api/rekonsiliasi-pajak-gaji ──────────────────────────────────
// GET  ?entityId=...&year=...     → ambil 12-bulan agregasi + SPT terlapor
// GET  ?entityIds=a,b,c&year=...  → agregasi lintas entitas (grup)
// POST                              → upsert satu baris SPT terlapor
// DELETE /{id}                      → hapus satu baris SPT

// ── Helper formatter ──────────────────────────────────────────────────────
function fmt_rp_rekpph(float $val): string {
    $abs = (int)abs($val);
    $prefix = $val < 0 ? '-Rp ' : 'Rp ';
    return $prefix . number_format($abs, 0, ',', '.');
}

$sub = $segments[1] ?? '';

// ───────────────────────────────────────────────────────────────────────────
// GET /api/rekonsiliasi-pajak-gaji?entityId=...&year=...
// ───────────────────────────────────────────────────────────────────────────
if ($method === 'GET' && $sub === '') {
    $user = require_auth();
    $pdo  = get_pdo();

    $entity_id_param  = trim($_GET['entityId']  ?? '');
    $entity_ids_param = trim($_GET['entityIds'] ?? '');
    $year             = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');

    $ids = [];
    if ($entity_ids_param !== '') {
        $ids = array_filter(array_map('trim', explode(',', $entity_ids_param)));
    } elseif ($entity_id_param !== '') {
        $ids = [$entity_id_param];
    }

    if (empty($ids)) {
        return error_response('entityId atau entityIds wajib diisi.', 400);
    }

    $is_grup = count($ids) > 1;

    // Resolve entity name (satu entitas) atau label grup
    $entity_name   = 'Semua Entitas (Konsolidasi Grup)';
    $primary_id    = $ids[0];
    if (!$is_grup) {
        $stmt = $pdo->prepare('SELECT name FROM Entity WHERE id = ? LIMIT 1');
        $stmt->execute([$primary_id]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($row) $entity_name = $row['name'];
    }

    $date_from = "$year-01-01 00:00:00";
    $date_to   = "$year-12-31 23:59:59";

    // Build placeholder list untuk IN (?, ?, ...)
    $placeholders = implode(',', array_fill(0, count($ids), '?'));

    // 1. Agregasi Transaksi Jurnal Umum (filter akun 511, 612, 533 + name match)
    //    Lewati auto-posted mirror (dari Jurnal Transaksi) agar tidak dobel.
    $tx_sql =
        "SELECT t.id, t.tanggal, t.debit, t.kredit,
                c.code AS coa_code, c.name AS coa_name
         FROM `Transaction` t
         JOIN CoaAccount c ON t.coaAccountId = c.id
         WHERE t.entityId IN ($placeholders)
           AND t.tanggal BETWEEN ? AND ?
           AND (c.code = '511' OR c.code = '612' OR c.code = '533'
                OR c.name LIKE '%Gaji%'
                OR c.name LIKE '%Honor%'
                OR c.name LIKE '%Tenaga Ahli%'
                OR c.name LIKE '%PPH 21%'
                OR c.name LIKE '%PPh 21%')
           AND (JSON_VALUE(t.extraFieldsJson, '\$.autoPostedFromJurnal') IS NULL
                OR JSON_VALUE(t.extraFieldsJson, '\$.autoPostedFromJurnal') != 'true')";
    $stmt = $pdo->prepare($tx_sql);
    $stmt->execute(array_merge($ids, [$date_from, $date_to]));
    $tx_rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 2. Payroll pegawai bulanan
    $gaji_sql =
        "SELECT bulan, totalGajiKotor, pph21
         FROM GajiPegawaiBulanan
         WHERE entityId IN ($placeholders) AND tahun = ?";
    $stmt = $pdo->prepare($gaji_sql);
    $stmt->execute(array_merge($ids, [$year]));
    $gaji_rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 3. Honor Tenaga Ahli
    $honor_sql =
        "SELECT bulan, nominalHonor, pph21
         FROM HonorTenagaAhli
         WHERE entityId IN ($placeholders) AND tahun = ?";
    $stmt = $pdo->prepare($honor_sql);
    $stmt->execute(array_merge($ids, [$year]));
    $honor_rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // 4. SPT Terlapor (RekonsiliasiGajiPph21)
    $spt_sql =
        "SELECT id, entityId, year, month,
                gajiTerlapor, pph21Terlapor,
                gajiPegawaiTerlapor, gajiTaTerlapor,
                pph21PegawaiTerlapor, pph21TaTerlapor,
                ntpn, keterangan
         FROM RekonsiliasiGajiPph21
         WHERE entityId IN ($placeholders) AND `year` = ?
         ORDER BY `month` ASC";
    $stmt = $pdo->prepare($spt_sql);
    $stmt->execute(array_merge($ids, [$year]));
    $spt_rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // ── Bucket per bulan (1..12) ──────────────────────────────────────────
    $buckets = [];
    for ($m = 1; $m <= 12; $m++) {
        $buckets[$m] = [
            'gajiPegawaiJurnal'    => 0.0,
            'gajiTaJurnal'         => 0.0,
            'pph21Jurnal'          => 0.0,
            'gajiPegawaiPayroll'   => 0.0,
            'pph21PegawaiPayroll'  => 0.0,
            'gajiTaPayroll'        => 0.0,
            'pph21TaPayroll'       => 0.0,
            'gajiTerlapor'         => 0.0,
            'pph21Terlapor'        => 0.0,
            'gajiPegawaiTerlapor'  => 0.0,
            'gajiTaTerlapor'       => 0.0,
            'pph21PegawaiTerlapor' => 0.0,
            'pph21TaTerlapor'      => 0.0,
            'ntpn'                 => null,
            'keterangan'           => null,
        ];
    }

    // Agregasi Transaksi
    foreach ($tx_rows as $t) {
        $m = (int)date('n', strtotime($t['tanggal']));
        if ($m < 1 || $m > 12) continue;
        $code  = $t['coa_code'] ?? '';
        $name  = strtolower($t['coa_name'] ?? '');
        $debit = (float)$t['debit'];

        if ($code === '612' || preg_match('/tenaga ahli|honor/i', $name)) {
            $buckets[$m]['gajiTaJurnal'] += $debit;
        } elseif ($code === '511'
                  || (preg_match('/gaji/i', $name) && !preg_match('/tenaga ahli|honor/i', $name))) {
            $buckets[$m]['gajiPegawaiJurnal'] += $debit;
        }
        if ($code === '533' || preg_match('/pph 21/i', $name)) {
            $buckets[$m]['pph21Jurnal'] += $debit;
        }
    }

    // Agregasi Payroll Pegawai
    foreach ($gaji_rows as $g) {
        $m = (int)$g['bulan'];
        if ($m < 1 || $m > 12) continue;
        $buckets[$m]['gajiPegawaiPayroll']  += (float)$g['totalGajiKotor'];
        $buckets[$m]['pph21PegawaiPayroll'] += (float)$g['pph21'];
    }

    // Agregasi Honor TA
    foreach ($honor_rows as $h) {
        $m = (int)$h['bulan'];
        if ($m < 1 || $m > 12) continue;
        $buckets[$m]['gajiTaPayroll']  += (float)$h['nominalHonor'];
        $buckets[$m]['pph21TaPayroll'] += (float)$h['pph21'];
    }

    // Agregasi SPT Terlapor
    foreach ($spt_rows as $s) {
        $m = (int)$s['month'];
        if ($m < 1 || $m > 12) continue;
        $buckets[$m]['gajiTerlapor']         += (float)$s['gajiTerlapor'];
        $buckets[$m]['pph21Terlapor']        += (float)$s['pph21Terlapor'];
        $buckets[$m]['gajiPegawaiTerlapor']  += (float)$s['gajiPegawaiTerlapor'];
        $buckets[$m]['gajiTaTerlapor']       += (float)$s['gajiTaTerlapor'];
        $buckets[$m]['pph21PegawaiTerlapor'] += (float)$s['pph21PegawaiTerlapor'];
        $buckets[$m]['pph21TaTerlapor']      += (float)$s['pph21TaTerlapor'];
        if (!empty($s['ntpn']))       $buckets[$m]['ntpn']       = $s['ntpn'];
        if (!empty($s['keterangan'])) $buckets[$m]['keterangan'] = $s['keterangan'];
    }

    // ── Build items + summary ─────────────────────────────────────────────
    $nama_bulan = ['Januari','Februari','Maret','April','Mei','Juni',
                   'Juli','Agustus','September','Oktober','November','Desember'];

    $items = [];

    // Summary counters (gabungan)
    $tot_gaji_jurnal   = 0.0;
    $tot_gaji_payroll  = 0.0;
    $tot_gaji_terlapor = 0.0;
    $tot_selisih_gaji  = 0.0;
    $tot_pph_basis     = 0.0;
    $tot_pph_terlapor  = 0.0;
    $tot_selisih_pph   = 0.0;
    $cnt_match = $cnt_selisih = $cnt_belum = $cnt_nihil = 0;

    // Summary counters pegawai
    $tot_peg_gaji_jurnal   = 0.0;
    $tot_peg_gaji_terlapor = 0.0;
    $tot_peg_selisih_gaji  = 0.0;
    $tot_peg_pph_basis     = 0.0;
    $tot_peg_pph_terlapor  = 0.0;
    $tot_peg_selisih_pph   = 0.0;
    $cnt_peg_match = $cnt_peg_selisih = $cnt_peg_belum = $cnt_peg_nihil = 0;

    // Summary counters tenaga ahli
    $tot_ta_gaji_jurnal   = 0.0;
    $tot_ta_gaji_terlapor = 0.0;
    $tot_ta_selisih_gaji  = 0.0;
    $tot_ta_pph_basis     = 0.0;
    $tot_ta_pph_terlapor  = 0.0;
    $tot_ta_selisih_pph   = 0.0;
    $cnt_ta_match = $cnt_ta_selisih = $cnt_ta_belum = $cnt_ta_nihil = 0;

    $derive_status = function (bool $hasInt, bool $hasSPT, float $diffG, float $diffP): string {
        if (!$hasInt && !$hasSPT) return 'NIHIL';
        if ($hasInt && !$hasSPT) return 'BELUM_DILAPORKAN';
        if (abs($diffG) > 0.01 || abs($diffP) > 0.01) return 'SELISIH';
        return 'MATCH';
    };

    for ($m = 1; $m <= 12; $m++) {
        $b = $buckets[$m];

        // ── Pegawai Tetap ────────────────────────────────────────────
        $gaji_peg_jurnal   = (float)$b['gajiPegawaiJurnal'];
        $gaji_peg_payroll  = (float)$b['gajiPegawaiPayroll'];
        $gaji_peg_terlapor = $b['gajiPegawaiTerlapor'] > 0
            ? (float)$b['gajiPegawaiTerlapor']
            : ($b['gajiTerlapor'] > 0 && $b['gajiTaTerlapor'] == 0 ? (float)$b['gajiTerlapor'] : 0.0);
        $selisih_gaji_peg  = $gaji_peg_jurnal - $gaji_peg_terlapor;

        $pph_peg_basis     = (float)$b['pph21PegawaiPayroll'];
        $pph_peg_terlapor  = $b['pph21PegawaiTerlapor'] > 0
            ? (float)$b['pph21PegawaiTerlapor']
            : ($b['pph21Terlapor'] > 0 && $b['pph21TaTerlapor'] == 0 ? (float)$b['pph21Terlapor'] : 0.0);
        $selisih_pph_peg   = $pph_peg_basis - $pph_peg_terlapor;

        $status_peg = $derive_status(
            $gaji_peg_jurnal > 0 || $pph_peg_basis > 0,
            $gaji_peg_terlapor > 0 || $pph_peg_terlapor > 0,
            $selisih_gaji_peg,
            $selisih_pph_peg
        );

        // ── Tenaga Ahli ──────────────────────────────────────────────
        $gaji_ta_jurnal   = (float)$b['gajiTaJurnal'];
        $gaji_ta_payroll  = (float)$b['gajiTaPayroll'];
        $gaji_ta_terlapor = (float)$b['gajiTaTerlapor'];
        $selisih_gaji_ta  = $gaji_ta_jurnal - $gaji_ta_terlapor;

        $pph_ta_basis    = (float)$b['pph21TaPayroll'];
        $pph_ta_terlapor = (float)$b['pph21TaTerlapor'];
        $selisih_pph_ta  = $pph_ta_basis - $pph_ta_terlapor;

        $status_ta = $derive_status(
            $gaji_ta_jurnal > 0 || $pph_ta_basis > 0,
            $gaji_ta_terlapor > 0 || $pph_ta_terlapor > 0,
            $selisih_gaji_ta,
            $selisih_pph_ta
        );

        // ── Total Gabungan ───────────────────────────────────────────
        $gaji_total_jurnal  = $gaji_peg_jurnal + $gaji_ta_jurnal;
        $gaji_total_payroll = $gaji_peg_payroll + $gaji_ta_payroll;
        $gaji_terlapor      = $b['gajiTerlapor'] > 0
            ? (float)$b['gajiTerlapor']
            : ($gaji_peg_terlapor + $gaji_ta_terlapor);
        $selisih_gaji = $gaji_total_jurnal - $gaji_terlapor;

        $pph21_payroll_total = $pph_peg_basis + $pph_ta_basis;
        $pph21_basis         = $b['pph21Jurnal'] > 0 ? (float)$b['pph21Jurnal'] : $pph21_payroll_total;
        $pph21_terlapor      = $b['pph21Terlapor'] > 0
            ? (float)$b['pph21Terlapor']
            : ($pph_peg_terlapor + $pph_ta_terlapor);
        $selisih_pph21       = $pph21_basis - $pph21_terlapor;

        $status_total = $derive_status(
            $gaji_total_jurnal > 0 || $pph21_basis > 0,
            $gaji_terlapor > 0 || $pph21_terlapor > 0,
            $selisih_gaji,
            $selisih_pph21
        );

        // Akumulasi
        $tot_gaji_jurnal   += $gaji_total_jurnal;
        $tot_gaji_payroll  += $gaji_total_payroll;
        $tot_gaji_terlapor += $gaji_terlapor;
        $tot_selisih_gaji  += $selisih_gaji;
        $tot_pph_basis     += $pph21_basis;
        $tot_pph_terlapor  += $pph21_terlapor;
        $tot_selisih_pph   += $selisih_pph21;
        if      ($status_total === 'MATCH')             $cnt_match++;
        elseif  ($status_total === 'SELISIH')           $cnt_selisih++;
        elseif  ($status_total === 'BELUM_DILAPORKAN')  $cnt_belum++;
        else                                            $cnt_nihil++;

        $tot_peg_gaji_jurnal   += $gaji_peg_jurnal;
        $tot_peg_gaji_terlapor += $gaji_peg_terlapor;
        $tot_peg_selisih_gaji  += $selisih_gaji_peg;
        $tot_peg_pph_basis     += $pph_peg_basis;
        $tot_peg_pph_terlapor  += $pph_peg_terlapor;
        $tot_peg_selisih_pph   += $selisih_pph_peg;
        if      ($status_peg === 'MATCH')             $cnt_peg_match++;
        elseif  ($status_peg === 'SELISIH')           $cnt_peg_selisih++;
        elseif  ($status_peg === 'BELUM_DILAPORKAN')  $cnt_peg_belum++;
        else                                          $cnt_peg_nihil++;

        $tot_ta_gaji_jurnal   += $gaji_ta_jurnal;
        $tot_ta_gaji_terlapor += $gaji_ta_terlapor;
        $tot_ta_selisih_gaji  += $selisih_gaji_ta;
        $tot_ta_pph_basis     += $pph_ta_basis;
        $tot_ta_pph_terlapor  += $pph_ta_terlapor;
        $tot_ta_selisih_pph   += $selisih_pph_ta;
        if      ($status_ta === 'MATCH')             $cnt_ta_match++;
        elseif  ($status_ta === 'SELISIH')           $cnt_ta_selisih++;
        elseif  ($status_ta === 'BELUM_DILAPORKAN')  $cnt_ta_belum++;
        else                                         $cnt_ta_nihil++;

        $items[] = [
            'month'     => $m,
            'namaBulan' => $nama_bulan[$m - 1],

            // Pegawai Tetap
            'gajiPegawaiJurnal'       => $gaji_peg_jurnal,
            'gajiPegawaiPayroll'      => $gaji_peg_payroll,
            'gajiPegawaiTerlapor'     => $gaji_peg_terlapor,
            'selisihGajiPegawai'      => $selisih_gaji_peg,
            'pph21PegawaiBasis'       => $pph_peg_basis,
            'pph21PegawaiTerlapor'    => $pph_peg_terlapor,
            'selisihPph21Pegawai'     => $selisih_pph_peg,
            'statusPegawai'           => $status_peg,
            'gajiPegawaiJurnalFmt'    => fmt_rp_rekpph($gaji_peg_jurnal),
            'gajiPegawaiPayrollFmt'   => fmt_rp_rekpph($gaji_peg_payroll),
            'gajiPegawaiTerlaporFmt'  => fmt_rp_rekpph($gaji_peg_terlapor),
            'selisihGajiPegawaiFmt'   => fmt_rp_rekpph($selisih_gaji_peg),
            'pph21PegawaiBasisFmt'    => fmt_rp_rekpph($pph_peg_basis),
            'pph21PegawaiTerlaporFmt' => fmt_rp_rekpph($pph_peg_terlapor),
            'selisihPph21PegawaiFmt'  => fmt_rp_rekpph($selisih_pph_peg),

            // Tenaga Ahli
            'gajiTaJurnal'       => $gaji_ta_jurnal,
            'gajiTaPayroll'      => $gaji_ta_payroll,
            'gajiTaTerlapor'     => $gaji_ta_terlapor,
            'selisihGajiTa'      => $selisih_gaji_ta,
            'pph21TaBasis'       => $pph_ta_basis,
            'pph21TaTerlapor'    => $pph_ta_terlapor,
            'selisihPph21Ta'     => $selisih_pph_ta,
            'statusTa'           => $status_ta,
            'gajiTaJurnalFmt'    => fmt_rp_rekpph($gaji_ta_jurnal),
            'gajiTaPayrollFmt'   => fmt_rp_rekpph($gaji_ta_payroll),
            'gajiTaTerlaporFmt'  => fmt_rp_rekpph($gaji_ta_terlapor),
            'selisihGajiTaFmt'   => fmt_rp_rekpph($selisih_gaji_ta),
            'pph21TaBasisFmt'    => fmt_rp_rekpph($pph_ta_basis),
            'pph21TaTerlaporFmt' => fmt_rp_rekpph($pph_ta_terlapor),
            'selisihPph21TaFmt'  => fmt_rp_rekpph($selisih_pph_ta),

            // Total Konsolidasi
            'gajiTotalJurnal'    => $gaji_total_jurnal,
            'gajiTotalPayroll'   => $gaji_total_payroll,
            'gajiTerlapor'       => $gaji_terlapor,
            'selisihGaji'        => $selisih_gaji,
            'pph21Jurnal'        => (float)$b['pph21Jurnal'],
            'pph21Payroll'       => $pph21_payroll_total,
            'pph21Basis'         => $pph21_basis,
            'pph21Terlapor'      => $pph21_terlapor,
            'selisihPph21'       => $selisih_pph21,
            'status'             => $status_total,
            'gajiTotalJurnalFmt' => fmt_rp_rekpph($gaji_total_jurnal),
            'gajiTotalPayrollFmt'=> fmt_rp_rekpph($gaji_total_payroll),
            'gajiTerlaporFmt'    => fmt_rp_rekpph($gaji_terlapor),
            'selisihGajiFmt'     => fmt_rp_rekpph($selisih_gaji),
            'pph21BasisFmt'      => fmt_rp_rekpph($pph21_basis),
            'pph21TerlaporFmt'   => fmt_rp_rekpph($pph21_terlapor),
            'selisihPph21Fmt'    => fmt_rp_rekpph($selisih_pph21),

            'ntpn'       => $b['ntpn'],
            'keterangan' => $b['keterangan'],
        ];
    }

    $resolve_overall = function (int $cS, int $cB, int $cM, int $cN): string {
        if ($cS > 0) return 'HAS_DIFF';
        if ($cB > 0) return 'UNREPORTED';
        if ($cM === 0 && $cN === 12) return 'NO_DATA';
        return 'ALL_BALANCED';
    };

    json_response([
        'entityId'   => $primary_id,
        'entityName' => $entity_name,
        'isGrup'     => $is_grup,
        'year'       => $year,
        'items'      => $items,
        'summary'    => [
            'totalGajiJurnal'     => $tot_gaji_jurnal,
            'totalGajiJurnalFmt'  => fmt_rp_rekpph($tot_gaji_jurnal),
            'totalGajiPayroll'    => $tot_gaji_payroll,
            'totalGajiPayrollFmt' => fmt_rp_rekpph($tot_gaji_payroll),
            'totalGajiTerlapor'   => $tot_gaji_terlapor,
            'totalGajiTerlaporFmt'=> fmt_rp_rekpph($tot_gaji_terlapor),
            'totalSelisihGaji'    => $tot_selisih_gaji,
            'totalSelisihGajiFmt' => fmt_rp_rekpph($tot_selisih_gaji),

            'totalPph21Basis'     => $tot_pph_basis,
            'totalPph21BasisFmt'  => fmt_rp_rekpph($tot_pph_basis),
            'totalPph21Terlapor'  => $tot_pph_terlapor,
            'totalPph21TerlaporFmt'=> fmt_rp_rekpph($tot_pph_terlapor),
            'totalSelisihPph21'   => $tot_selisih_pph,
            'totalSelisihPph21Fmt'=> fmt_rp_rekpph($tot_selisih_pph),

            'jumlahBulanMatch'     => $cnt_match,
            'jumlahBulanSelisih'   => $cnt_selisih,
            'jumlahBulanBelumLapor'=> $cnt_belum,
            'jumlahBulanNihil'     => $cnt_nihil,
            'overallStatus'        => $resolve_overall($cnt_selisih, $cnt_belum, $cnt_match, $cnt_nihil),

            'pegawai' => [
                'totalGajiJurnal'      => $tot_peg_gaji_jurnal,
                'totalGajiJurnalFmt'   => fmt_rp_rekpph($tot_peg_gaji_jurnal),
                'totalGajiTerlapor'    => $tot_peg_gaji_terlapor,
                'totalGajiTerlaporFmt' => fmt_rp_rekpph($tot_peg_gaji_terlapor),
                'totalSelisihGaji'     => $tot_peg_selisih_gaji,
                'totalSelisihGajiFmt'  => fmt_rp_rekpph($tot_peg_selisih_gaji),
                'totalPphBasis'        => $tot_peg_pph_basis,
                'totalPphBasisFmt'     => fmt_rp_rekpph($tot_peg_pph_basis),
                'totalPphTerlapor'     => $tot_peg_pph_terlapor,
                'totalPphTerlaporFmt'  => fmt_rp_rekpph($tot_peg_pph_terlapor),
                'totalSelisihPph'      => $tot_peg_selisih_pph,
                'totalSelisihPphFmt'   => fmt_rp_rekpph($tot_peg_selisih_pph),
                'jumlahBulanMatch'     => $cnt_peg_match,
                'jumlahBulanSelisih'   => $cnt_peg_selisih,
                'jumlahBulanBelumLapor'=> $cnt_peg_belum,
                'jumlahBulanNihil'     => $cnt_peg_nihil,
                'status'               => $resolve_overall($cnt_peg_selisih, $cnt_peg_belum, $cnt_peg_match, $cnt_peg_nihil),
            ],

            'tenagaAhli' => [
                'totalGajiJurnal'      => $tot_ta_gaji_jurnal,
                'totalGajiJurnalFmt'   => fmt_rp_rekpph($tot_ta_gaji_jurnal),
                'totalGajiTerlapor'    => $tot_ta_gaji_terlapor,
                'totalGajiTerlaporFmt' => fmt_rp_rekpph($tot_ta_gaji_terlapor),
                'totalSelisihGaji'     => $tot_ta_selisih_gaji,
                'totalSelisihGajiFmt'  => fmt_rp_rekpph($tot_ta_selisih_gaji),
                'totalPphBasis'        => $tot_ta_pph_basis,
                'totalPphBasisFmt'     => fmt_rp_rekpph($tot_ta_pph_basis),
                'totalPphTerlapor'     => $tot_ta_pph_terlapor,
                'totalPphTerlaporFmt'  => fmt_rp_rekpph($tot_ta_pph_terlapor),
                'totalSelisihPph'      => $tot_ta_selisih_pph,
                'totalSelisihPphFmt'   => fmt_rp_rekpph($tot_ta_selisih_pph),
                'jumlahBulanMatch'     => $cnt_ta_match,
                'jumlahBulanSelisih'   => $cnt_ta_selisih,
                'jumlahBulanBelumLapor'=> $cnt_ta_belum,
                'jumlahBulanNihil'     => $cnt_ta_nihil,
                'status'               => $resolve_overall($cnt_ta_selisih, $cnt_ta_belum, $cnt_ta_match, $cnt_ta_nihil),
            ],
        ],
    ]);
}

// ───────────────────────────────────────────────────────────────────────────
// POST /api/rekonsiliasi-pajak-gaji  (upsert SPT Terlapor)
// Body: { entityId, year, month, gajiTerlapor, pph21Terlapor,
//         gajiPegawaiTerlapor, gajiTaTerlapor,
//         pph21PegawaiTerlapor, pph21TaTerlapor,
//         ntpn?, keterangan? }
// ───────────────────────────────────────────────────────────────────────────
elseif ($method === 'POST' && $sub === '') {
    $user = require_auth();
    $pdo  = get_pdo();

    $entity_id = trim($body['entityId'] ?? '');
    $year      = (int)($body['year']  ?? 0);
    $month     = (int)($body['month'] ?? 0);

    if (!$entity_id || !$year || $month < 1 || $month > 12) {
        return error_response('entityId, year, dan month (1-12) wajib diisi.', 400);
    }

    // Verifikasi entity ada
    $stmt = $pdo->prepare('SELECT id, name FROM Entity WHERE id = ? LIMIT 1');
    $stmt->execute([$entity_id]);
    $entity = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$entity) return error_response('Entitas tidak ditemukan.', 404);

    $gaji_peg = max(0.0, (float)($body['gajiPegawaiTerlapor']  ?? 0));
    $gaji_ta  = max(0.0, (float)($body['gajiTaTerlapor']        ?? 0));
    $pph_peg  = max(0.0, (float)($body['pph21PegawaiTerlapor']  ?? 0));
    $pph_ta   = max(0.0, (float)($body['pph21TaTerlapor']       ?? 0));

    // Auto-sum ke total kalau tidak dikirim
    $gaji_tot_input = isset($body['gajiTerlapor']) ? (float)$body['gajiTerlapor'] : 0.0;
    $pph_tot_input  = isset($body['pph21Terlapor']) ? (float)$body['pph21Terlapor'] : 0.0;
    $gaji_tot = max(0.0, $gaji_tot_input > 0 ? $gaji_tot_input : ($gaji_peg + $gaji_ta));
    $pph_tot  = max(0.0, $pph_tot_input  > 0 ? $pph_tot_input  : ($pph_peg + $pph_ta));

    $ntpn       = isset($body['ntpn']) && trim((string)$body['ntpn']) !== ''
                  ? trim((string)$body['ntpn']) : null;
    $keterangan = isset($body['keterangan']) && trim((string)$body['keterangan']) !== ''
                  ? trim((string)$body['keterangan']) : null;

    // UPSERT berdasarkan (entityId, year, month)
    $stmt = $pdo->prepare(
        'SELECT id FROM RekonsiliasiGajiPph21
         WHERE entityId = ? AND `year` = ? AND `month` = ? LIMIT 1'
    );
    $stmt->execute([$entity_id, $year, $month]);
    $existing_id = $stmt->fetchColumn();

    if ($existing_id) {
        $pdo->prepare(
            'UPDATE RekonsiliasiGajiPph21
             SET gajiTerlapor = ?, pph21Terlapor = ?,
                 gajiPegawaiTerlapor = ?, gajiTaTerlapor = ?,
                 pph21PegawaiTerlapor = ?, pph21TaTerlapor = ?,
                 ntpn = ?, keterangan = ?
             WHERE id = ?'
        )->execute([
            $gaji_tot, $pph_tot,
            $gaji_peg, $gaji_ta,
            $pph_peg,  $pph_ta,
            $ntpn, $keterangan, $existing_id,
        ]);
        $saved_id = $existing_id;
    } else {
        $saved_id = cuid();
        $pdo->prepare(
            'INSERT INTO RekonsiliasiGajiPph21
             (id, entityId, `year`, `month`,
              gajiTerlapor, pph21Terlapor,
              gajiPegawaiTerlapor, gajiTaTerlapor,
              pph21PegawaiTerlapor, pph21TaTerlapor,
              ntpn, keterangan)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        )->execute([
            $saved_id, $entity_id, $year, $month,
            $gaji_tot, $pph_tot,
            $gaji_peg, $gaji_ta,
            $pph_peg,  $pph_ta,
            $ntpn, $keterangan,
        ]);
    }

    log_activity(
        $user['id'],
        "Update Rekonsiliasi Pajak Gaji & PPh 21 Bulan $month/$year ({$entity['name']})",
        'FINANCIAL_CHANGE',
        [
            'rekonsiliasiId'      => $saved_id,
            'entityId'            => $entity_id,
            'year'                => $year,
            'month'               => $month,
            'gajiTerlapor'        => $gaji_tot,
            'pph21Terlapor'       => $pph_tot,
            'gajiPegawaiTerlapor' => $gaji_peg,
            'gajiTaTerlapor'      => $gaji_ta,
        ]
    );

    json_response(['success' => true, 'id' => $saved_id]);
}

// ───────────────────────────────────────────────────────────────────────────
// DELETE /api/rekonsiliasi-pajak-gaji/{id}
// ───────────────────────────────────────────────────────────────────────────
elseif ($method === 'DELETE' && $sub !== '') {
    $user = require_auth();
    $pdo  = get_pdo();
    $id   = $sub;

    $stmt = $pdo->prepare('SELECT id, entityId, `year`, `month` FROM RekonsiliasiGajiPph21 WHERE id = ? LIMIT 1');
    $stmt->execute([$id]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$existing) return error_response('Data SPT tidak ditemukan.', 404);

    $pdo->prepare('DELETE FROM RekonsiliasiGajiPph21 WHERE id = ?')->execute([$id]);

    log_activity(
        $user['id'],
        "Hapus Rekonsiliasi SPT Pajak Gaji Bulan {$existing['month']}/{$existing['year']}",
        'FINANCIAL_CHANGE',
        ['rekonsiliasiId' => $id, 'entityId' => $existing['entityId']]
    );

    json_response(['success' => true]);
}

else {
    error_response('Endpoint rekonsiliasi-pajak-gaji tidak ditemukan.', 404);
}
