<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

function is_debet_normal(string $kategori, string $code): bool {
    // Akun kontra-aset (210 CKPN & 1001 Akumulasi Penyusutan): Kredit-Normal
    if (in_array($code, ['210', '1001'])) return false;
    // ASET dan BEBAN adalah debet-normal
    if (in_array($kategori, ['ASET', 'BEBAN'])) return true;
    return false;
}

function hitung_saldo_akhir(string $kategori, string $code, float $saldo_awal, float $total_debit, float $total_kredit): float {
    if (is_debet_normal($kategori, $code)) {
        return $saldo_awal + $total_debit - $total_kredit;
    } else {
        // KEWAJIBAN, MODAL, PENDAPATAN, serta kontra-aset (210, 1001): kredit-normal
        return $saldo_awal + $total_kredit - $total_debit;
    }
}

function is_contra_aset(string $code): bool {
    return in_array($code, ['210', '1001']) || preg_match('/^akumulasi/i', $code) > 0;
}

/**
 * Mengembalikan daftar noBukti yang menyentuh akun terlarang untuk versi laporan tertentu.
 * Jika versi = UMUM, transaksi yang menyentuh akun INTERNAL dikecualikan.
 * Jika versi = INTERNAL, transaksi yang menyentuh akun UMUM dikecualikan.
 */
function get_excluded_no_bukti_for_version(PDO $pdo, array|string $entity_ids, int $year, string $version): array {
    $ids = is_array($entity_ids) ? $entity_ids : [$entity_ids];
    $ids = array_values(array_filter(array_map('trim', $ids)));
    if (empty($ids)) return [];
    $target_cat = strtoupper($version) === 'UMUM' ? 'INTERNAL' : 'UMUM';
    $placeholders = implode(',', array_fill(0, count($ids), '?'));
    $date_start = "$year-01-01 00:00:00";
    $date_end   = "$year-12-31 23:59:59";

    $stmt = $pdo->prepare(
        "SELECT DISTINCT t.noBukti
         FROM `Transaction` t
         JOIN CoaAccount c ON t.coaAccountId = c.id
         WHERE t.entityId IN ($placeholders)
           AND t.tanggal BETWEEN ? AND ?
           AND c.report_category = ?
           AND c.code != '628'
           AND t.noBukti IS NOT NULL AND t.noBukti != ''"
    );
    $stmt->execute(array_merge($ids, [$date_start, $date_end, $target_cat]));
    return array_values(array_filter($stmt->fetchAll(PDO::FETCH_COLUMN)));
}

function is_aktiva_tetap(string $code, string $name): bool {
    if (in_array($code, ['100', '101', '102', '103', '104', '1001'])) return true;
    if (preg_match('/aktiva tetap|aset tetap|kendaraan|peralatan|mesin|gedung|inventaris|penyusutan/i', $name)) return true;
    return false;
}

function is_laba_ditahan(string $code, string $name): bool {
    if ($code === '310') return true;
    if (preg_match('/laba.*ditahan|retained.*earning/i', $name)) return true;
    return false;
}

/**
 * Hitung beban penyusutan aset tetap untuk periode tertentu (metode garis lurus).
 *
 * @param array $aset  Row dari tabel AsetTetap (tanggalPerolehan, hargaPerolehan, nilaiResidu, umurBulan, kategori)
 * @param int   $year  Tahun target perhitungan
 * @return array ['beban_periode' => float, 'akumulasi' => float, 'akumulasi_awal_tahun' => float, 'nilai_buku_awal_tahun' => float]
 */
function hitung_penyusutan_aset(array $aset, int $year): array {
    $harga = (float)$aset['hargaPerolehan'];

    // TANAH tidak disusutkan (PSAK 16)
    if (isset($aset['kategori']) && $aset['kategori'] === 'TANAH') {
        return [
            'beban_periode'         => 0.0,
            'akumulasi'             => 0.0,
            'akumulasi_awal_tahun'  => 0.0,
            'nilai_buku_awal_tahun' => $harga,
        ];
    }

    $tanggal_perolehan = new DateTime($aset['tanggalPerolehan']);
    $residu            = (float)$aset['nilaiResidu'];
    $umur_bulan        = (int)$aset['umurBulan'];
    $nilai_tersusut    = $harga - $residu;

    if ($umur_bulan <= 0 || $nilai_tersusut <= 0) {
        return [
            'beban_periode'         => 0.0,
            'akumulasi'             => 0.0,
            'akumulasi_awal_tahun'  => 0.0,
            'nilai_buku_awal_tahun' => $harga,
        ];
    }

    $beban_per_bulan = $nilai_tersusut / $umur_bulan;

    $tahun_perolehan = (int)$tanggal_perolehan->format('Y');
    $bulan_perolehan = (int)$tanggal_perolehan->format('n');

    // Bulan absolut (year*12 + month_0indexed)
    $abs_mulai_aset      = $tahun_perolehan * 12 + ($bulan_perolehan - 1);
    $abs_akhir_aset      = $abs_mulai_aset + $umur_bulan - 1;

    $abs_mulai_tahun_ini = $year * 12;
    $abs_akhir_tahun_ini = $year * 12 + 11;

    // Irisan bulan aktif di tahun target
    $start_irisan          = max($abs_mulai_tahun_ini, $abs_mulai_aset);
    $end_irisan            = min($abs_akhir_tahun_ini, $abs_akhir_aset);
    $bulan_aktif_tahun_ini = max(0, $end_irisan - $start_irisan + 1);

    $beban_periode = $beban_per_bulan * $bulan_aktif_tahun_ini;

    // Akumulasi s/d akhir tahun target
    $end_akumulasi   = min($abs_akhir_aset, $abs_akhir_tahun_ini);
    $bulan_akumulasi = max(0, $end_akumulasi - $abs_mulai_aset + 1);
    $akumulasi       = $beban_per_bulan * $bulan_akumulasi;

    // Akumulasi awal tahun (s/d akhir tahun sebelumnya) — untuk year-end rollover
    $abs_akhir_tahun_lalu = ($year - 1) * 12 + 11;
    $end_akum_lalu        = min($abs_akhir_aset, $abs_akhir_tahun_lalu);
    $bulan_akum_lalu      = max(0, $end_akum_lalu - $abs_mulai_aset + 1);
    $akumulasi_awal_tahun = round($beban_per_bulan * $bulan_akum_lalu, 2);

    return [
        'beban_periode'         => round($beban_periode, 2),
        'akumulasi'             => round($akumulasi, 2),
        'akumulasi_awal_tahun'  => $akumulasi_awal_tahun,
        'nilai_buku_awal_tahun' => round($harga - $akumulasi_awal_tahun, 2),
    ];
}

/**
 * Ambil semua AsetTetap milik satu entity dan hitung penyusutan per aset untuk tahun tertentu.
 *
 * @return array  [['aset' => row, 'beban_periode' => float, 'akumulasi' => float], ...]
 */
function get_penyusutan_entity(string $entity_id, int $year): array {
    $pdo  = get_pdo();
    $stmt = $pdo->prepare(
        'SELECT id, entityId, kode, nama, kategori, tanggalPerolehan,
                hargaPerolehan, nilaiResidu, umurBulan, metode, keterangan
         FROM AsetTetap
         WHERE entityId = ?'
    );
    $stmt->execute([$entity_id]);
    $rows = $stmt->fetchAll();

    $result = [];
    foreach ($rows as $row) {
        $penyusutan = hitung_penyusutan_aset($row, $year);
        $result[]   = array_merge($row, $penyusutan);
    }
    return $result;
}

/**
 * Jumlah total beban penyusutan seluruh aset entity untuk satu tahun.
 */
function total_beban_penyusutan(string $entity_id, int $year): float {
    $rows  = get_penyusutan_entity($entity_id, $year);
    $total = 0.0;
    foreach ($rows as $r) {
        $total += (float)$r['beban_periode'];
    }
    return $total;
}

/**
 * Jumlah total akumulasi penyusutan seluruh aset entity s/d akhir tahun.
 */
function total_akumulasi_penyusutan(string $entity_id, int $year): float {
    $rows  = get_penyusutan_entity($entity_id, $year);
    $total = 0.0;
    foreach ($rows as $r) {
        $total += (float)$r['akumulasi'];
    }
    return $total;
}

/**
 * Ringkasan penyusutan per kategori PSAK (4 kategori) untuk satu entity dan tahun.
 * Lebih efisien dari memanggil total_beban + total_akumulasi secara terpisah.
 *
 * @return array ['total_beban' => float, 'total_akumulasi' => float, 'rekap' => [kategori => ['beban', 'akumulasi', 'count', 'harga_perolehan', 'nilai_buku']]]
 */
function get_penyusutan_summary(string $entity_id, int $year): array {
    $rows  = get_penyusutan_entity($entity_id, $year);
    $rekap = [
        'TANAH'            => ['beban' => 0.0, 'akumulasi' => 0.0, 'count' => 0, 'harga_perolehan' => 0.0, 'nilai_buku' => 0.0],
        'BANGUNAN'         => ['beban' => 0.0, 'akumulasi' => 0.0, 'count' => 0, 'harga_perolehan' => 0.0, 'nilai_buku' => 0.0],
        'KENDARAAN'        => ['beban' => 0.0, 'akumulasi' => 0.0, 'count' => 0, 'harga_perolehan' => 0.0, 'nilai_buku' => 0.0],
        'PERALATAN_KANTOR' => ['beban' => 0.0, 'akumulasi' => 0.0, 'count' => 0, 'harga_perolehan' => 0.0, 'nilai_buku' => 0.0],
    ];
    $total_beban     = 0.0;
    $total_akumulasi = 0.0;

    foreach ($rows as $r) {
        $beban = (float)$r['beban_periode'];
        $akum  = (float)$r['akumulasi'];
        $harga = (float)$r['hargaPerolehan'];
        $kat   = $r['kategori'] ?? 'PERALATAN_KANTOR';
        if (!array_key_exists($kat, $rekap)) $kat = 'PERALATAN_KANTOR';

        $total_beban     += $beban;
        $total_akumulasi += $akum;
        $rekap[$kat]['beban']            += $beban;
        $rekap[$kat]['akumulasi']        += $akum;
        $rekap[$kat]['count']++;
        $rekap[$kat]['harga_perolehan']  += $harga;
        $rekap[$kat]['nilai_buku']       += max(0.0, $harga - $akum);
    }

    foreach ($rekap as &$rv) {
        $rv['beban']           = round($rv['beban'],           2);
        $rv['akumulasi']       = round($rv['akumulasi'],       2);
        $rv['harga_perolehan'] = round($rv['harga_perolehan'], 2);
        $rv['nilai_buku']      = round($rv['nilai_buku'],      2);
    }
    unset($rv);

    return [
        'total_beban'     => round($total_beban,     2),
        'total_akumulasi' => round($total_akumulasi, 2),
        'rekap'           => $rekap,
    ];
}
