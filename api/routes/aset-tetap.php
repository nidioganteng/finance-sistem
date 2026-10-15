<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

require_once __DIR__ . '/../helpers/akuntansi-helpers.php';

$user      = require_auth();
$record_id = $segments[1] ?? null;

$allowed_kategori = ['TANAH', 'BANGUNAN', 'KENDARAAN', 'PERALATAN_KANTOR'];

// ─── GET /api/aset-tetap?entityId=...&year=... ───────────────────────────────
if ($method === 'GET' && $record_id === null) {
    $entity_id = $_GET['entityId'] ?? null;
    $year      = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');

    if (!$entity_id) error_response('entityId diperlukan.', 400);

    $pdo  = get_pdo();
    $stmt = $pdo->prepare(
        'SELECT id, entityId, kode, nama, kategori, tanggalPerolehan,
                hargaPerolehan, nilaiResidu, umurBulan, metode, keterangan, createdAt
         FROM AsetTetap
         WHERE entityId = ?
         ORDER BY tanggalPerolehan ASC, kode ASC'
    );
    $stmt->execute([$entity_id]);
    $rows = $stmt->fetchAll();

    $result             = [];
    $rekap_per_kategori = [
        'TANAH'            => ['count' => 0, 'hargaPerolehan' => 0.0, 'akumulasi' => 0.0, 'nilaiBuku' => 0.0],
        'BANGUNAN'         => ['count' => 0, 'hargaPerolehan' => 0.0, 'akumulasi' => 0.0, 'nilaiBuku' => 0.0],
        'KENDARAAN'        => ['count' => 0, 'hargaPerolehan' => 0.0, 'akumulasi' => 0.0, 'nilaiBuku' => 0.0],
        'PERALATAN_KANTOR' => ['count' => 0, 'hargaPerolehan' => 0.0, 'akumulasi' => 0.0, 'nilaiBuku' => 0.0],
    ];

    foreach ($rows as $row) {
        $penyusutan = hitung_penyusutan_aset($row, $year);
        $harga      = (float)$row['hargaPerolehan'];
        $akum       = $penyusutan['akumulasi'];
        $kat        = $row['kategori'];
        if (!array_key_exists($kat, $rekap_per_kategori)) $kat = 'PERALATAN_KANTOR';

        $rekap_per_kategori[$kat]['count']++;
        $rekap_per_kategori[$kat]['hargaPerolehan'] += $harga;
        $rekap_per_kategori[$kat]['akumulasi']      += $akum;
        $rekap_per_kategori[$kat]['nilaiBuku']      += $harga - $akum;

        $result[] = [
            'id'                          => $row['id'],
            'entityId'                    => $row['entityId'],
            'kode'                        => $row['kode'],
            'nama'                        => $row['nama'],
            'kategori'                    => $row['kategori'],
            'tanggalPerolehan'            => $row['tanggalPerolehan'],
            'hargaPerolehan'              => $harga,
            'nilaiResidu'                 => (float)$row['nilaiResidu'],
            'umurBulan'                   => (int)$row['umurBulan'],
            'metode'                      => $row['metode'],
            'keterangan'                  => $row['keterangan'],
            'createdAt'                   => $row['createdAt'],
            'bebanPenyusutan'             => $penyusutan['beban_periode'],
            'akumulasiPenyusutan'         => $akum,
            'akumulasiPenyusutanAwalTahun'=> $penyusutan['akumulasi_awal_tahun'],
            'nilaiBukuAwalTahun'          => $penyusutan['nilai_buku_awal_tahun'],
            'nilaiBuku'                   => $harga - $akum,
        ];
    }

    json_response(['aset' => $result, 'rekapPerKategori' => $rekap_per_kategori]);
}

// ─── POST /api/aset-tetap ────────────────────────────────────────────────────
if ($method === 'POST' && $record_id === null) {
    $required = ['entityId','kode','nama','tanggalPerolehan','hargaPerolehan'];
    foreach ($required as $field) {
        if (empty($body[$field])) error_response("Field '$field' diperlukan.", 400);
    }

    $kategori = $body['kategori'] ?? 'BANGUNAN';
    if (!in_array($kategori, $allowed_kategori)) {
        error_response('Kategori tidak valid. Pilihan: ' . implode(', ', $allowed_kategori), 400);
    }

    // PSAK 16: Tanah tidak disusutkan
    $umur_bulan = $kategori === 'TANAH' ? 0 : (int)($body['umurBulan'] ?? 48);

    $pdo = get_pdo();
    $id  = uuid4();
    $now = date('Y-m-d H:i:s');

    $pdo->prepare(
        'INSERT INTO AsetTetap
         (id, entityId, kode, nama, kategori, tanggalPerolehan, hargaPerolehan,
          nilaiResidu, umurBulan, metode, keterangan, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    )->execute([
        $id,
        $body['entityId'],
        $body['kode'],
        $body['nama'],
        $kategori,
        $body['tanggalPerolehan'],
        (float)$body['hargaPerolehan'],
        (float)($body['nilaiResidu'] ?? 0),
        $umur_bulan,
        $body['metode'] ?? 'GARIS_LURUS',
        $body['keterangan'] ?? null,
        $now,
        $now,
    ]);

    log_activity($user['id'], 'aset_tetap.create', 'FINANCIAL_CHANGE', [
        'asetId' => $id,
        'kode'   => $body['kode'],
        'nama'   => $body['nama'],
    ]);

    json_response(['message' => 'Aset tetap berhasil ditambahkan.', 'id' => $id], 201);
}

// ─── PUT /api/aset-tetap/:id ─────────────────────────────────────────────────
if ($method === 'PUT' && $record_id !== null) {
    $pdo  = get_pdo();
    $stmt = $pdo->prepare('SELECT id, kategori FROM AsetTetap WHERE id = ?');
    $stmt->execute([$record_id]);
    $existing = $stmt->fetch();
    if (!$existing) error_response('Aset tetap tidak ditemukan.', 404);

    if (isset($body['kategori']) && !in_array($body['kategori'], $allowed_kategori)) {
        error_response('Kategori tidak valid. Pilihan: ' . implode(', ', $allowed_kategori), 400);
    }

    // PSAK 16: Tanah tidak disusutkan — paksa umurBulan=0 jika kategori efektif adalah TANAH
    $effective_kategori = $body['kategori'] ?? $existing['kategori'];
    if ($effective_kategori === 'TANAH') {
        $body['umurBulan'] = 0;
    }

    $updatable = ['kode','nama','kategori','tanggalPerolehan','hargaPerolehan','nilaiResidu','umurBulan','metode','keterangan'];
    $set_parts  = [];
    $set_values = [];
    foreach ($updatable as $field) {
        if (array_key_exists($field, $body)) {
            $set_parts[]  = "`$field` = ?";
            $set_values[] = $body[$field] !== '' ? $body[$field] : null;
        }
    }

    if (empty($set_parts)) error_response('Tidak ada field yang diperbarui.', 400);

    $set_parts[]  = 'updatedAt = ?';
    $set_values[] = date('Y-m-d H:i:s');
    $set_values[] = $record_id;

    $pdo->prepare('UPDATE AsetTetap SET ' . implode(', ', $set_parts) . ' WHERE id = ?')
        ->execute($set_values);

    log_activity($user['id'], 'aset_tetap.update', 'FINANCIAL_CHANGE', ['asetId' => $record_id]);

    json_response(['message' => 'Aset tetap berhasil diperbarui.']);
}

// ─── DELETE /api/aset-tetap/:id ──────────────────────────────────────────────
if ($method === 'DELETE' && $record_id !== null) {
    $pdo  = get_pdo();
    $stmt = $pdo->prepare('DELETE FROM AsetTetap WHERE id = ?');
    $stmt->execute([$record_id]);
    if ($stmt->rowCount() === 0) error_response('Aset tetap tidak ditemukan.', 404);

    log_activity($user['id'], 'aset_tetap.delete', 'FINANCIAL_CHANGE', ['asetId' => $record_id]);

    json_response(['message' => 'Aset tetap berhasil dihapus.']);
}

error_response('Endpoint tidak ditemukan.', 404);
