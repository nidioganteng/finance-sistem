<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

function is_debet_normal(string $kategori, string $code): bool {
    // ASET dan BEBAN adalah debet-normal
    if (in_array($kategori, ['ASET', 'BEBAN'])) return true;
    return false;
}

function hitung_saldo_akhir(string $kategori, string $code, float $saldo_awal, float $total_debit, float $total_kredit): float {
    if (is_debet_normal($kategori, $code)) {
        return $saldo_awal + $total_debit - $total_kredit;
    } else {
        // KEWAJIBAN, MODAL, PENDAPATAN: kredit-normal
        return $saldo_awal + $total_kredit - $total_debit;
    }
}

function is_contra_aset(string $code): bool {
    return in_array($code, ['1001', '502']) || preg_match('/^akumulasi/i', $code) > 0;
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
 * @param array $aset  Row dari tabel AsetTetap (tanggalPerolehan, hargaPerolehan, nilaiResidu, umurBulan)
 * @param int   $year  Tahun target perhitungan
 * @return array ['beban_periode' => float, 'akumulasi' => float]
 */
function hitung_penyusutan_aset(array $aset, int $year): array {
    $tanggal_perolehan = new DateTime($aset['tanggalPerolehan']);
    $harga   = (float)$aset['hargaPerolehan'];
    $residu  = (float)$aset['nilaiResidu'];
    $umur_bulan = (int)$aset['umurBulan'];
    $nilai_tersusut = $harga - $residu;

    if ($umur_bulan <= 0 || $nilai_tersusut <= 0) {
        return ['beban_periode' => 0.0, 'akumulasi' => 0.0];
    }

    $beban_per_bulan = $nilai_tersusut / $umur_bulan;

    $tahun_perolehan = (int)$tanggal_perolehan->format('Y');
    $bulan_perolehan = (int)$tanggal_perolehan->format('n');

    // Bulan absolut (year*12 + month_0indexed)
    $abs_mulai_aset      = $tahun_perolehan * 12 + ($bulan_perolehan - 1); // 0-indexed
    $abs_akhir_aset      = $abs_mulai_aset + $umur_bulan - 1;

    $abs_mulai_tahun_ini = $year * 12;       // Januari tahun target (0-indexed)
    $abs_akhir_tahun_ini = $year * 12 + 11;  // Desember tahun target

    // Irisan bulan aktif di tahun target
    $start_irisan = max($abs_mulai_tahun_ini, $abs_mulai_aset);
    $end_irisan   = min($abs_akhir_tahun_ini, $abs_akhir_aset);
    $bulan_aktif_tahun_ini = max(0, $end_irisan - $start_irisan + 1);

    $beban_periode = $beban_per_bulan * $bulan_aktif_tahun_ini;

    // Akumulasi s/d akhir tahun target
    $end_akumulasi   = min($abs_akhir_aset, $abs_akhir_tahun_ini);
    $bulan_akumulasi = max(0, $end_akumulasi - $abs_mulai_aset + 1);
    $akumulasi       = $beban_per_bulan * $bulan_akumulasi;

    return [
        'beban_periode' => round($beban_periode, 2),
        'akumulasi'     => round($akumulasi, 2),
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
