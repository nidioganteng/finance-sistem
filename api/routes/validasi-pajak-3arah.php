<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

// ─── GET /api/validasi-pajak-3arah?entityIds[]=...&year=...&version=... ───────
// Logika: 1:1 dengan getValidasiPajak3Arah() di src/lib/validasi-pajak-3arah.ts

if ($method !== 'GET') error_response('Method tidak didukung.', 405);

require_auth();
$pdo = get_pdo();

$entity_ids = array_values(array_filter((array)($_GET['entityIds'] ?? [])));
$year       = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');
$version    = $_GET['version'] ?? 'INTERNAL';

if (empty($entity_ids)) return error_response('entityIds wajib diisi.', 400);

function fmt_rp(float $val): string {
    return 'Rp ' . number_format((int)$val, 0, ',', '.');
}

// ── SECTION 1: Data dari Laporan Pendapatan (Faktur) ─────────────────────────
$id_ph = implode(',', array_fill(0, count($entity_ids), '?'));
$stmt = $pdo->prepare(
    "SELECT dpp, ppn, pph, nilaiProyek, nominalDiterima
     FROM FakturPendapatan
     WHERE entityId IN ($id_ph) AND tahunPajak = ?"
);
$stmt->execute(array_merge($entity_ids, [$year]));
$fakturs = $stmt->fetchAll(PDO::FETCH_ASSOC);

$total_faktur_dpp = 0.0;
$total_faktur_ppn = 0.0;
$total_faktur_pph = 0.0;
foreach ($fakturs as $f) {
    $nil_proyek = (float)$f['nilaiProyek'];
    $dpp_f      = (float)$f['dpp'];
    $total_faktur_dpp += ($nil_proyek > 0 ? $nil_proyek : $dpp_f);
    $total_faktur_ppn += (float)$f['ppn'];
    $total_faktur_pph += (float)$f['pph'];
}

// ── SECTION 2: Data dari Jurnal Umum ─────────────────────────────────────────
// Ambil hanya transaksi non-mirror (bukan auto-posted mirror bank buku)
$date_start = "$year-01-01 00:00:00";
$date_end   = "$year-12-31 23:59:59";
$stmt = $pdo->prepare(
    "SELECT t.debit, t.kredit, t.extraFieldsJson, c.code, c.name, c.kategori
     FROM `Transaction` t
     JOIN CoaAccount c ON t.coaAccountId = c.id
     WHERE t.entityId IN ($id_ph)
       AND t.tanggal BETWEEN ? AND ?
       AND (JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') IS NULL
            OR JSON_VALUE(t.extraFieldsJson, '$.isKasEntry') = 'true')"
);
$stmt->execute(array_merge($entity_ids, [$date_start, $date_end]));
$tx_rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

$total_jurnal_dpp = 0.0;
$total_jurnal_ppn = 0.0;
$total_jurnal_pph = 0.0;

foreach ($tx_rows as $t) {
    $debit  = (float)$t['debit'];
    $kredit = (float)$t['kredit'];
    $cat    = $t['kategori'];
    $code   = $t['code'];
    $name   = strtolower($t['name']);

    // DPP / Pendapatan Usaha
    if ($cat === 'PENDAPATAN') {
        $total_jurnal_dpp += $kredit - $debit;
    }
    // PPN (Akun 535 atau nama mengandung 'ppn')
    if ($code === '535' || strpos($code, '535') === 0 || stripos($name, 'ppn') !== false) {
        $total_jurnal_ppn += $debit - $kredit;
    }
    // PPh Final (Akun 534 atau nama mengandung 'pph' dan 'final')
    if ($code === '534' || strpos($code, '534') === 0 || (stripos($name, 'pph') !== false && stripos($name, 'final') !== false)) {
        $total_jurnal_pph += $debit - $kredit;
    }
}

// ── SECTION 3: Data dari Laba Rugi (SQL langsung, tanpa HTTP call) ────────────
$total_lr_dpp = 0.0;
$total_lr_ppn = 0.0;
$total_lr_pph = 0.0;

foreach ($entity_ids as $eid) {
    // Pendapatan (DPP)
    $stmt = $pdo->prepare(
        "SELECT COALESCE(SUM(CASE WHEN t.kredit > t.debit THEN t.kredit - t.debit ELSE 0 END), 0) AS total
         FROM `Transaction` t
         JOIN CoaAccount c ON t.coaAccountId = c.id
         WHERE t.entityId = ? AND c.kategori = 'PENDAPATAN'
           AND t.tanggal BETWEEN ? AND ?
           AND (JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') IS NULL
                OR JSON_VALUE(t.extraFieldsJson, '$.isKasEntry') = 'true')"
    );
    $stmt->execute([$eid, $date_start, $date_end]);
    $total_lr_dpp += (float)$stmt->fetchColumn();

    // PPN (Akun 535 atau nama LIKE '%ppn%')
    $stmt = $pdo->prepare(
        "SELECT COALESCE(SUM(t.debit - t.kredit), 0) AS total
         FROM `Transaction` t
         JOIN CoaAccount c ON t.coaAccountId = c.id
         WHERE t.entityId = ?
           AND (c.code = '535' OR c.name LIKE '%ppn%')
           AND t.tanggal BETWEEN ? AND ?"
    );
    $stmt->execute([$eid, $date_start, $date_end]);
    $total_lr_ppn += (float)$stmt->fetchColumn();

    // PPh Final (Akun 534 atau nama LIKE '%pph%final%')
    $stmt = $pdo->prepare(
        "SELECT COALESCE(SUM(t.debit - t.kredit), 0) AS total
         FROM `Transaction` t
         JOIN CoaAccount c ON t.coaAccountId = c.id
         WHERE t.entityId = ?
           AND (c.code = '534' OR (c.name LIKE '%pph%' AND c.name LIKE '%final%'))
           AND t.tanggal BETWEEN ? AND ?"
    );
    $stmt->execute([$eid, $date_start, $date_end]);
    $total_lr_pph += (float)$stmt->fetchColumn();
}

// ── Build ValidasiPajakItem ───────────────────────────────────────────────────
function build_validasi_item(
    string $key,
    string $label,
    string $sublabel,
    float $faktur_val,
    float $jurnal_val,
    float $lr_val
): array {
    $diff_fj  = abs($faktur_val - $jurnal_val);
    $diff_jl  = abs($jurnal_val - $lr_val);
    $diff_fl  = abs($faktur_val - $lr_val);
    $max_diff = max($diff_fj, $diff_jl, $diff_fl);
    $is_balance = $max_diff < 1;

    $keterangan = 'Ketiga laporan seimbang (cocok 100%)';
    if (!$is_balance) {
        if ($diff_fj >= 1 && $diff_jl < 1) {
            $keterangan = 'Jurnal & Laba Rugi cocok, namun berbeda dengan Laporan Pendapatan';
        } elseif ($diff_jl >= 1) {
            $keterangan = 'Terdapat selisih antara Jurnal Umum dan Laba Rugi';
        } else {
            $keterangan = 'Terdapat selisih pada rekapitulasi data';
        }
    }

    return [
        'key'              => $key,
        'label'            => $label,
        'sublabel'         => $sublabel,
        'nilaiFaktur'      => $faktur_val,
        'nilaiJurnal'      => $jurnal_val,
        'nilaiLabaRugi'    => $lr_val,
        'selisih'          => $max_diff,
        'isBalance'        => $is_balance,
        'nilaiFakturFmt'   => fmt_rp(round($faktur_val)),
        'nilaiJurnalFmt'   => fmt_rp(round($jurnal_val)),
        'nilaiLabaRugiFmt' => fmt_rp(round($lr_val)),
        'selisihFmt'       => fmt_rp(round($max_diff)),
        'keterangan'       => $keterangan,
    ];
}

$items = [
    build_validasi_item(
        'dpp',
        'DPP / Pendapatan Usaha',
        'Basis Dasar Pengenaan Pajak & Nilai Kontrak Bersih',
        $total_faktur_dpp, $total_jurnal_dpp, $total_lr_dpp
    ),
    build_validasi_item(
        'ppn',
        'PPN Realisasi',
        'Pajak Pertambahan Nilai (Akun 535)',
        $total_faktur_ppn, $total_jurnal_ppn, $total_lr_ppn
    ),
    build_validasi_item(
        'pph',
        'PPh Final (Pasal 4 Ayat 2)',
        'Pajak Penghasilan Jasa Konstruksi / Konsultansi (Akun 534)',
        $total_faktur_pph, $total_jurnal_pph, $total_lr_pph
    ),
];

$all_balanced   = count(array_filter($items, fn($i) => !$i['isBalance'])) === 0;
$jumlah_selisih = count(array_filter($items, fn($i) => !$i['isBalance']));

json_response([
    'year'          => $year,
    'allBalanced'   => $all_balanced,
    'jumlahSelisih' => $jumlah_selisih,
    'items'         => $items,
]);
