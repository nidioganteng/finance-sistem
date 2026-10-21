<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

function ensure_tenaga_ahli_gaji_table(PDO $pdo): void {
    static $done = false;
    if ($done) return;
    $pdo->exec(file_get_contents(__DIR__ . '/../../database/migrations/2026-10-21-tenaga-ahli-gaji-negosiasi.sql'));
    $done = true;
}

function tenaga_ahli_valid_date($value): ?string {
    if ($value === null || $value === '') return null;
    if (!is_string($value)) throw new InvalidArgumentException('Tanggal SPMK tidak valid.');
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', $value);
    if (!$date || $date->format('Y-m-d') !== $value) {
        throw new InvalidArgumentException('Tanggal SPMK harus berformat YYYY-MM-DD.');
    }
    return $value;
}

function tenaga_ahli_nominal($value, bool $nullable = true): ?float {
    if ($nullable && ($value === null || $value === '')) return null;
    if (!is_numeric($value) || !is_finite((float)$value) || (float)$value < 0 || (float)$value > 999999999999.99) {
        throw new InvalidArgumentException('Nominal harus berupa angka positif atau nol (maksimal 999.999.999.999,99).');
    }
    return round((float)$value, 2);
}

// Daftar bulan eksplisit: bulan yang dihapus tidak muncul lagi saat sinkronisasi ulang.
function tenaga_ahli_validate_jadwal($rows): array {
    if (!is_array($rows) || !array_is_list($rows) || count($rows) > 600) {
        throw new InvalidArgumentException('Daftar bulan tidak valid (maksimal 600 bulan).');
    }
    $seen = [];
    $result = [];
    foreach ($rows as $row) {
        if (!is_array($row)) throw new InvalidArgumentException('Baris gaji tidak valid.');
        $bulan = $row['bulan'] ?? '';
        if (!is_string($bulan) || !preg_match('/^(20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/', $bulan)) {
            throw new InvalidArgumentException('Bulan harus berformat YYYY-MM (tahun 2000–2199).');
        }
        if (isset($seen[$bulan])) throw new InvalidArgumentException('Bulan gaji tidak boleh duplikat.');
        $catatan = $row['catatan'] ?? '';
        if (!is_string($catatan) || strlen($catatan) > 4000) {
            throw new InvalidArgumentException('Catatan terlalu panjang (maksimal 4.000 byte).');
        }
        $seen[$bulan] = true;
        $result[] = ['bulan' => $bulan, 'nominal' => tenaga_ahli_nominal($row['nominal'] ?? null), 'catatan' => trim($catatan)];
    }
    usort($result, fn($a, $b) => strcmp($a['bulan'], $b['bulan']));
    return $result;
}

function tenaga_ahli_gaji_format(array $row): array {
    foreach (['manMonth', 'gajiRab', 'gajiNegosiasi'] as $key) {
        $row[$key] = isset($row[$key]) ? (float)$row[$key] : null;
    }
    $row['revision'] = (int)$row['revision'];
    $row['jadwal'] = $row['jadwalJson'] === null ? null : json_decode($row['jadwalJson'], true, 512, JSON_THROW_ON_ERROR);
    unset($row['jadwalJson']);
    return $row;
}

function tenaga_ahli_merge_riwayat(array $by_nik, array $by_id): array {
    $unique = [];
    foreach (array_merge($by_nik, $by_id) as $payment) {
        $unique[$payment['id']] = $payment;
    }
    $payments = array_values($unique);
    usort($payments, fn($a, $b) => strcmp($b['tanggal'], $a['tanggal']));
    return $payments;
}

function tenaga_ahli_payment_for_tracking(array $row): array {
    return [
        'id' => $row['id'], 'rekananId' => $row['rekananId'] ?? null,
        'nik' => $row['nik'] ?? null, 'nama' => $row['nama'],
        'entityId' => $row['entityId'], 'entityName' => $row['ename'],
        'projectId' => $row['projectId'] ?? null,
        'projectCode' => $row['projCode'] ?? null, 'projectName' => $row['projName'] ?? null,
        'tahun' => (int)$row['tahun'], 'bulan' => (int)$row['bulan'],
        'tanggal' => substr($row['tanggal'], 0, 10),
        'nominalHonor' => (float)$row['nominalHonor'], 'pph21' => (float)$row['pph21'],
        'nominalBersih' => (float)$row['nominalBersih'],
    ];
}

function tenaga_ahli_periode_honor(array $body, string $tanggal): array {
    $date = tenaga_ahli_valid_date($tanggal);
    if ($date === null) throw new InvalidArgumentException('Tanggal pembayaran wajib diisi.');
    $has_month = isset($body['bulan']);
    $has_year = isset($body['tahun']);
    if ($has_month !== $has_year) throw new InvalidArgumentException('Bulan dan tahun periode gaji harus diisi bersamaan.');
    $month = $has_month ? filter_var($body['bulan'], FILTER_VALIDATE_INT) : (int)substr($date, 5, 2);
    $year = $has_year ? filter_var($body['tahun'], FILTER_VALIDATE_INT) : (int)substr($date, 0, 4);
    if ($month === false || $month < 1 || $month > 12 || $year === false || $year < 2000 || $year > 2199) {
        throw new InvalidArgumentException('Periode gaji tidak valid (bulan 1–12, tahun 2000–2199).');
    }
    return [$month, $year, $date . ' 00:00:00'];
}
