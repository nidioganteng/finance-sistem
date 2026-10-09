<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

$user = require_auth();

// GET /api/pajak?entityId=...&year=...
if ($method === 'GET') {
    $entity_id = $_GET['entityId'] ?? null;
    $year      = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');

    if (!$entity_id) error_response('entityId diperlukan.', 400);

    $pdo = get_pdo();

    $date_from = "$year-01-01 00:00:00";
    $date_to   = "$year-12-31 23:59:59";

    // ── Pendapatan dari akun COA ──────────────────────────────────────────────
    $stmt_pend = $pdo->prepare(
        'SELECT c.id, c.code, c.name,
                COALESCE(SUM(t.kredit), 0) - COALESCE(SUM(t.debit), 0) AS nilai
         FROM `Transaction` t
         JOIN CoaAccount c ON t.coaAccountId = c.id
         WHERE t.entityId   = ?
           AND t.tanggal BETWEEN ? AND ?
           AND c.kategori   = \'PENDAPATAN\'
         GROUP BY c.id, c.code, c.name
         ORDER BY c.code ASC'
    );
    $stmt_pend->execute([$entity_id, $date_from, $date_to]);
    $pendapatan_coa = $stmt_pend->fetchAll();
    foreach ($pendapatan_coa as &$p) { $p['nilai'] = (float)$p['nilai']; }
    unset($p);

    // ── Beban dari akun COA ───────────────────────────────────────────────────
    $stmt_beban = $pdo->prepare(
        'SELECT c.id, c.code, c.name,
                COALESCE(SUM(t.debit), 0) - COALESCE(SUM(t.kredit), 0) AS nilai
         FROM `Transaction` t
         JOIN CoaAccount c ON t.coaAccountId = c.id
         WHERE t.entityId   = ?
           AND t.tanggal BETWEEN ? AND ?
           AND c.kategori   = \'BEBAN\'
         GROUP BY c.id, c.code, c.name
         ORDER BY c.code ASC'
    );
    $stmt_beban->execute([$entity_id, $date_from, $date_to]);
    $beban_coa = $stmt_beban->fetchAll();
    foreach ($beban_coa as &$b) { $b['nilai'] = (float)$b['nilai']; }
    unset($b);

    // ── Rekap pajak dari FakturPendapatan ────────────────────────────────────
    $stmt_fp = $pdo->prepare(
        'SELECT masaPajak,
                SUM(dpp)          AS total_dpp,
                SUM(dppNilaiLain) AS total_dpp_nilai_lain,
                SUM(ppn)          AS total_ppn,
                SUM(pph)          AS total_pph,
                SUM(nilaiProyek)  AS total_nilai_proyek,
                SUM(labaSetelahPajak) AS total_laba_setelah_pajak,
                COUNT(*)          AS jumlah_faktur
         FROM FakturPendapatan
         WHERE entityId = ? AND tahunPajak = ?
         GROUP BY masaPajak
         ORDER BY masaPajak ASC'
    );
    $stmt_fp->execute([$entity_id, $year]);
    $faktur_per_bulan = $stmt_fp->fetchAll();

    $nama_bulan = [
        1=>'Januari',2=>'Februari',3=>'Maret',4=>'April',5=>'Mei',6=>'Juni',
        7=>'Juli',8=>'Agustus',9=>'September',10=>'Oktober',11=>'November',12=>'Desember',
    ];

    $rekap_pajak = [];
    foreach ($faktur_per_bulan as $fp) {
        $masa = (int)$fp['masaPajak'];
        $rekap_pajak[$masa] = [
            'masa'                => $masa,
            'namaBulan'           => $nama_bulan[$masa] ?? "Bulan $masa",
            'totalDpp'            => (float)$fp['total_dpp'],
            'totalDppNilaiLain'   => (float)$fp['total_dpp_nilai_lain'],
            'totalPpn'            => (float)$fp['total_ppn'],
            'totalPph'            => (float)$fp['total_pph'],
            'totalNilaiProyek'    => (float)$fp['total_nilai_proyek'],
            'totalLabaSetelahPajak' => (float)$fp['total_laba_setelah_pajak'],
            'jumlahFaktur'        => (int)$fp['jumlah_faktur'],
        ];
    }

    // ── Rekonsiliasi pajak (data SPT yang dilaporkan) ────────────────────────
    $stmt_rekon = $pdo->prepare(
        'SELECT month, dppTerlapor, pajakTerlapor, keterangan, updatedAt
         FROM RekonsiliasiPajakBulanan
         WHERE entityId = ? AND year = ?
         ORDER BY month ASC'
    );
    $stmt_rekon->execute([$entity_id, $year]);
    $rekonsiliasi_rows = $stmt_rekon->fetchAll();

    $rekonsiliasi_map = [];
    foreach ($rekonsiliasi_rows as $r) {
        $rekonsiliasi_map[(int)$r['month']] = [
            'dppTerlapor'   => (float)$r['dppTerlapor'],
            'pajakTerlapor' => (float)$r['pajakTerlapor'],
            'keterangan'    => $r['keterangan'],
            'updatedAt'     => $r['updatedAt'],
        ];
    }

    // ── Ringkasan rekonsiliasi (sistem vs SPT) ───────────────────────────────
    $rekonsiliasi_detail = [];
    for ($m = 1; $m <= 12; $m++) {
        $faktur = $rekap_pajak[$m]   ?? null;
        $spt    = $rekonsiliasi_map[$m] ?? null;

        $dpp_sistem   = $faktur ? $faktur['totalDpp']   : 0.0;
        $pajak_sistem = $faktur ? ($faktur['totalPpn'] + $faktur['totalPph']) : 0.0;
        $dpp_spt      = $spt   ? $spt['dppTerlapor']   : null;
        $pajak_spt    = $spt   ? $spt['pajakTerlapor'] : null;

        $rekonsiliasi_detail[] = [
            'bulan'          => $m,
            'namaBulan'      => $nama_bulan[$m],
            'dppSistem'      => $dpp_sistem,
            'pajakSistem'    => $pajak_sistem,
            'dppSpt'         => $dpp_spt,
            'pajakSpt'       => $pajak_spt,
            'selisihDpp'     => $dpp_spt !== null ? ($dpp_sistem - $dpp_spt)   : null,
            'selisihPajak'   => $pajak_spt !== null ? ($pajak_sistem - $pajak_spt) : null,
            'keterangan'     => $spt['keterangan'] ?? null,
        ];
    }

    // ── Totals ────────────────────────────────────────────────────────────────
    $total_pendapatan_coa = array_sum(array_column($pendapatan_coa, 'nilai'));
    $total_beban_coa      = array_sum(array_column($beban_coa,      'nilai'));
    $laba_komersial       = $total_pendapatan_coa - $total_beban_coa;

    $total_dpp_faktur   = array_sum(array_column($rekap_pajak, 'totalDpp'));
    $total_ppn_faktur   = array_sum(array_column($rekap_pajak, 'totalPpn'));
    $total_pph_faktur   = array_sum(array_column($rekap_pajak, 'totalPph'));
    $total_pajak_faktur = $total_ppn_faktur + $total_pph_faktur;

    json_response([
        'entityId'           => $entity_id,
        'year'               => $year,
        'pendapatanCoa'      => $pendapatan_coa,
        'bebanCoa'           => $beban_coa,
        'labaKomersial'      => $laba_komersial,
        'rekapPajakPerBulan' => array_values($rekap_pajak),
        'rekonsiliasiDetail' => $rekonsiliasi_detail,
        'summary'            => [
            'totalPendapatanCoa' => $total_pendapatan_coa,
            'totalBebanCoa'      => $total_beban_coa,
            'labaKomersial'      => $laba_komersial,
            'totalDppFaktur'     => $total_dpp_faktur,
            'totalPpnFaktur'     => $total_ppn_faktur,
            'totalPphFaktur'     => $total_pph_faktur,
            'totalPajakFaktur'   => $total_pajak_faktur,
        ],
    ]);
}

error_response('Endpoint tidak ditemukan.', 404);
