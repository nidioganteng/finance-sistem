<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

function ensure_tenaga_ahli_gaji_table(PDO $pdo): void {
    static $done = false;
    if ($done) return;
    $pdo->exec(file_get_contents(__DIR__ . '/tenaga-ahli-gaji-schema.sql'));
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
        if (array_key_exists('pph21', $row)) {
            $tax = tenaga_ahli_nominal($row['pph21']);
            if ($tax !== null && $tax > (float)($row['nominal'] ?? 0)) throw new InvalidArgumentException('PPh tidak boleh melebihi gaji bruto bulan tersebut.');
            $result[count($result) - 1]['pph21'] = $tax;
        }
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

// ID tetap membuat simpan ulang memperbarui pembayaran otomatis, bukan menambah transaksi.
function tenaga_ahli_auto_payment_id(string $person_id, string $project_id, string $period): string {
    return 'gaji-' . substr(hash('sha256', json_encode([$person_id, $project_id, $period])), 0, 31);
}

function tenaga_ahli_sync_pembayaran(PDO $pdo, array $person, string $person_id, string $project_id, array $jadwal, array $old_jadwal = [], ?float $budget = null): void {
    if (!$pdo->inTransaction()) throw new LogicException('Sinkronisasi pembayaran wajib dalam transaksi gaji.');
    $stmt = $pdo->prepare('SELECT * FROM HonorTenagaAhli WHERE projectId = ? AND (rekananId = ? OR (nik = ? AND nik <> \'\'))');
    $stmt->execute([$project_id, $person_id, $person['nik'] ?? '']);
    $history = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $periods = array_column($jadwal, 'bulan');
    $old_periods = array_column($old_jadwal, 'bulan');
    if ($budget !== null) {
        $total = array_sum(array_map(fn($row) => (float)($row['nominal'] ?? 0), $jadwal));
        $paid_total = array_sum(array_column($history, 'nominalHonor'));
        foreach ($history as $payment) {
            $period = sprintf('%04d-%02d', $payment['tahun'], $payment['bulan']);
            if (!in_array($period, $periods, true) && $payment['id'] !== tenaga_ahli_auto_payment_id($person_id, $project_id, $period)) {
                $total += (float)$payment['nominalHonor'];
            }
        }
        if ($total > $budget + 0.001) throw new InvalidArgumentException('Total gaji dan pembayaran tidak boleh melebihi total gaji negosiasi kontrak.');
        if (array_diff($periods, $old_periods) && $paid_total >= $budget - 0.001) {
            throw new InvalidArgumentException('Gaji sudah balance dengan total negosiasi. Bulan tidak dapat ditambah.');
        }
    }
    foreach ($history as $payment) {
        $period = sprintf('%04d-%02d', $payment['tahun'], $payment['bulan']);
        if (in_array($period, $periods, true)) continue;
        if ($payment['id'] !== tenaga_ahli_auto_payment_id($person_id, $project_id, $period)) {
            if (in_array($period, $old_periods, true)) throw new InvalidArgumentException('Bulan yang memiliki pembayaran manual tidak dapat dihapus dari jadwal.');
            continue;
        }
        $pdo->prepare('DELETE FROM HonorTenagaAhli WHERE id = ?')->execute([$payment['id']]);
    }
    foreach ($jadwal as $row) {
        [$year, $month] = array_map('intval', explode('-', $row['bulan']));
        $id = tenaga_ahli_auto_payment_id($person_id, $project_id, $row['bulan']);
        $automatic = null;
        $manual = 0.0;
        $manual_tax = 0.0;
        foreach ($history as $payment) {
            if ((int)$payment['tahun'] !== $year || (int)$payment['bulan'] !== $month) continue;
            if ($payment['id'] === $id) $automatic = $payment;
            else { $manual += (float)$payment['nominalHonor']; $manual_tax += (float)$payment['pph21']; }
        }
        if ($manual > (float)($row['nominal'] ?? 0) + 0.001) {
            throw new InvalidArgumentException("Gaji {$row['bulan']} tidak boleh kurang dari pembayaran manual yang sudah tercatat.");
        }
        $amount = round(max(0, (float)($row['nominal'] ?? 0) - $manual), 2);
        $explicit_tax = $row['pph21'] ?? null;
        if ($explicit_tax !== null && ($explicit_tax < $manual_tax - 0.001 || $explicit_tax > (float)($row['nominal'] ?? 0) + 0.001)) throw new InvalidArgumentException("PPh {$row['bulan']} harus mencakup pajak pembayaran manual dan tidak melebihi gaji bruto.");
        if ($amount <= 0) {
            if ($explicit_tax !== null && abs($explicit_tax - $manual_tax) > 0.001) throw new InvalidArgumentException('PPh pembayaran manual diubah melalui rekonsiliasi, bukan dengan menimpa riwayat.');
            if ($automatic) $pdo->prepare('DELETE FROM HonorTenagaAhli WHERE id = ?')->execute([$id]);
            continue;
        }
        if (!trim($person['nik'] ?? '')) throw new InvalidArgumentException('Lengkapi NIK tenaga ahli sebelum menyimpan gaji dan pembayaran.');
        $entity = $person['projectEntityId'] ?: $person['entityId'];
        if (!$entity) throw new InvalidArgumentException('Entitas proyek wajib tersedia untuk pembayaran gaji.');
        if ($explicit_tax !== null) $tax = round($explicit_tax - $manual_tax, 2);
        elseif (!array_key_exists('pph21', $row) && $automatic && abs((float)$automatic['nominalHonor'] - $amount) < 0.001) $tax = (float)$automatic['pph21'];
        else throw new InvalidArgumentException("Isi PPh {$row['bulan']} secara manual (isi 0 bila tanpa potongan).");
        $rate = round($tax / $amount * 100, 2);
        $description = tenaga_ahli_honor_description($person['nama'], $year, $month);
        $now = date('Y-m-d H:i:s');
        if ($automatic) {
            $pdo->prepare('UPDATE HonorTenagaAhli SET uraian = ?, entityId = ?, nominalHonor = ?, tarifPph21Persen = ?, pph21 = ?, nominalBersih = ?, updatedAt = ? WHERE id = ?')
                ->execute([$description, $entity, $amount, $rate, $tax, $amount, $now, $id]);
        } else {
            $pdo->prepare('INSERT INTO HonorTenagaAhli (id, entityId, rekananId, nik, nama, npwp, uraian, tanggal, bulan, tahun, nominalHonor, tarifPph21Persen, pph21, nominalBersih, projectId, namaProyek, noBukti, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
                ->execute([$id, $entity, $person_id, $person['nik'], $person['nama'], $person['npwp'] ?? null,
                    $description, date('Y-m-d') . ' 00:00:00', $month, $year,
                    $amount, $rate, $tax, $amount, $project_id, $person['projectName'] ?? null, null, $now, $now]);
        }
    }
}

function tenaga_ahli_honor_description(string $name, int $year, int $month): string {
    $months = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
    if ($month < 1 || $month > 12) throw new InvalidArgumentException('Bulan pembayaran tidak valid.');
    return "Honorarium Tenaga Ahli: $name - Bulan {$months[$month-1]} $year";
}
