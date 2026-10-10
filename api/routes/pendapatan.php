<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

$user       = require_auth();
$sub_action = $segments[1] ?? null; // null | 'faktur' | 'rekonsiliasi'
$record_id  = $segments[2] ?? null; // faktur/:id

// ─── GET /api/pendapatan?entityId=...&year=...&month=... ─────────────────────
if ($method === 'GET' && $sub_action === null) {
    $entity_id = $_GET['entityId'] ?? null;
    $year      = isset($_GET['year'])  ? (int)$_GET['year']  : null;
    $month     = isset($_GET['month']) ? (int)$_GET['month'] : null;

    if (!$entity_id) error_response('entityId diperlukan.', 400);
    if (!$year)      error_response('year diperlukan.', 400);

    $pdo = get_pdo();

    // Faktur pendapatan
    $sql    = 'SELECT f.*, e.name AS entity_name, p.code AS project_code
               FROM FakturPendapatan f
               JOIN Entity e ON f.entityId = e.id
               LEFT JOIN Project p ON f.projectId = p.id
               WHERE f.entityId = ? AND f.tahunPajak = ?';
    $params = [$entity_id, $year];

    if ($month !== null) {
        $sql    .= ' AND f.masaPajak = ?';
        $params[] = $month;
    }

    $sql .= ' ORDER BY f.tanggalTerima DESC';

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $faktur = $stmt->fetchAll();

    foreach ($faktur as &$f) {
        $f['dpp']                  = (float)$f['dpp'];
        $f['dppNilaiLain']         = (float)$f['dppNilaiLain'];
        $f['ppn']                  = (float)$f['ppn'];
        $f['pph']                  = (float)$f['pph'];
        $f['nilaiProyek']          = (float)$f['nilaiProyek'];
        $f['labaSetelahPajak']     = (float)$f['labaSetelahPajak'];
        $f['pekerjaanPerusahaan']  = (float)$f['pekerjaanPerusahaan'];
        $f['pekerjaanYangDipinjam']= (float)$f['pekerjaanYangDipinjam'];
        $f['nominalDiterima']      = (float)$f['nominalDiterima'];
        $f['tarifPpnPersen']       = (float)$f['tarifPpnPersen'];
        $f['tarifPphPersen']       = (float)$f['tarifPphPersen'];
        $f['ceklisPpn']            = (bool)$f['ceklisPpn'];
        $f['ceklisPph']            = (bool)$f['ceklisPph'];
        $f['ceklisBuktiPotong']    = (bool)$f['ceklisBuktiPotong'];
    }
    unset($f);

    // Rekonsiliasi pajak bulanan
    $rekon_params = [$entity_id, $year];
    $rekon_sql    = 'SELECT * FROM RekonsiliasiPajakBulanan WHERE entityId = ? AND year = ?';
    if ($month !== null) {
        $rekon_sql    .= ' AND month = ?';
        $rekon_params[] = $month;
    }
    $rekon_sql .= ' ORDER BY month ASC';

    $stmt_rekon = $pdo->prepare($rekon_sql);
    $stmt_rekon->execute($rekon_params);
    $rekonsiliasi = $stmt_rekon->fetchAll();

    foreach ($rekonsiliasi as &$r) {
        $r['dppTerlapor']   = (float)$r['dppTerlapor'];
        $r['pajakTerlapor'] = (float)$r['pajakTerlapor'];
        $r['pphTerlapor']   = (float)($r['pphTerlapor'] ?? 0);
    }
    unset($r);

    json_response([
        'faktur'       => $faktur,
        'rekonsiliasi' => $rekonsiliasi,
    ]);
}

// ─── GET /api/pendapatan/projects?entityId=... ───────────────────────────────
// Returns projects with termins for the given entity (used by frontend for form dropdowns).
if ($method === 'GET' && $sub_action === 'projects') {
    $entity_id = $_GET['entityId'] ?? null;
    if (!$entity_id) error_response('entityId diperlukan.', 400);

    $pdo = get_pdo();

    $stmt = $pdo->prepare(
        'SELECT p.id, p.code, p.name, p.contractValue
           FROM Project p
          WHERE p.entityId = ?
          ORDER BY p.createdAt DESC'
    );
    $stmt->execute([$entity_id]);
    $projects = $stmt->fetchAll();

    // Fetch termins for all projects in one query
    if (!empty($projects)) {
        $project_ids  = array_column($projects, 'id');
        $placeholders = implode(',', array_fill(0, count($project_ids), '?'));

        $stmt_t = $pdo->prepare(
            "SELECT id, projectId, name, percentage, nominal
               FROM Termin
              WHERE projectId IN ($placeholders)
              ORDER BY percentage ASC"
        );
        $stmt_t->execute($project_ids);
        $all_termins = $stmt_t->fetchAll();

        // Group termins by projectId
        $termins_by_project = [];
        foreach ($all_termins as $t) {
            $termins_by_project[$t['projectId']][] = [
                'id'         => $t['id'],
                'name'       => $t['name'],
                'percentage' => (int)$t['percentage'],
                'nominal'    => (float)$t['nominal'],
            ];
        }

        $result = [];
        foreach ($projects as $p) {
            $result[] = [
                'id'            => $p['id'],
                'code'          => $p['code'],
                'name'          => $p['name'],
                'contractValue' => (float)$p['contractValue'],
                'termins'       => $termins_by_project[$p['id']] ?? [],
            ];
        }
    } else {
        $result = [];
    }

    json_response($result);
}

// ─── GET /api/pendapatan/faktur?entityId=... ────────────────────────────────
// Returns all faktur for entity (no year filter) — used by jurnal-transaksi dropdown.
if ($method === 'GET' && $sub_action === 'faktur') {
    $entity_id = $_GET['entityId'] ?? null;
    if (!$entity_id) error_response('entityId diperlukan.', 400);

    $pdo  = get_pdo();
    $stmt = $pdo->prepare(
        'SELECT f.id, f.noFaktur, f.namaRekanan, f.namaJkp,
                f.dpp, f.dppNilaiLain, f.ppn, f.pph,
                f.nilaiProyek, f.labaSetelahPajak, f.nominalDiterima,
                f.bank, f.projectId, f.tahunPajak, f.masaPajak,
                p.code AS project_code, p.name AS project_name
           FROM FakturPendapatan f
           LEFT JOIN Project p ON f.projectId = p.id
          WHERE f.entityId = ?
          ORDER BY f.tahunPajak DESC, f.masaPajak DESC, f.createdAt DESC'
    );
    $stmt->execute([$entity_id]);
    $rows = $stmt->fetchAll();

    foreach ($rows as &$f) {
        $f['dpp']               = (float)$f['dpp'];
        $f['dppNilaiLain']      = (float)$f['dppNilaiLain'];
        $f['ppn']               = (float)$f['ppn'];
        $f['pph']               = (float)$f['pph'];
        $f['nilaiProyek']       = (float)$f['nilaiProyek'];
        $f['labaSetelahPajak']  = (float)$f['labaSetelahPajak'];
        $f['nominalDiterima']   = (float)$f['nominalDiterima'];
        $f['ceklisPpn']         = (bool)($f['ceklisPpn'] ?? false);
        $f['ceklisPph']         = (bool)($f['ceklisPph'] ?? false);
        $f['ceklisBuktiPotong'] = (bool)($f['ceklisBuktiPotong'] ?? false);
        $f['projectCode']       = $f['project_code'] ?? null;
        $f['projectName']       = $f['project_name'] ?? null;
        unset($f['project_code'], $f['project_name']);
    }
    unset($f);

    json_response(['data' => $rows]);
}

// ─── Helper: hitung pajak dari input faktur ──────────────────────────────────
function hitung_pajak_faktur(array $b): array {
    $dpp            = (float)($b['dpp']            ?? 0);
    $dpp_nilai_lain = (float)($b['dppNilaiLain']   ?? $b['dpp_nilai_lain'] ?? 0);
    $tarif_ppn      = (float)($b['tarifPpnPersen'] ?? $b['tarif_ppn_persen'] ?? 11.00);
    $tarif_pph      = (float)($b['tarifPphPersen'] ?? $b['tarif_pph_persen'] ?? 3.50);

    $ppn              = round($dpp_nilai_lain * $tarif_ppn / 100);
    $pph              = round($dpp * $tarif_pph / 100);
    $nilai_proyek     = $dpp + $ppn;
    $laba_setelah_pajak = $dpp - $pph;

    return compact('ppn', 'pph', 'nilai_proyek', 'laba_setelah_pajak');
}

// ─── POST /api/pendapatan/faktur ─────────────────────────────────────────────
if ($method === 'POST' && $sub_action === 'faktur' && $record_id === null) {
    $required = ['entityId','npwp','noFaktur','masaPajak','tahunPajak','namaRekanan','namaJkp',
                 'dpp','dppNilaiLain','tarifPpnPersen','tarifPphPersen','tanggalTerima','bank','nominalDiterima'];
    foreach ($required as $field) {
        if (!isset($body[$field]) || $body[$field] === '') {
            error_response("Field '$field' diperlukan.", 400);
        }
    }

    $kalkulasi = hitung_pajak_faktur($body);
    $pdo       = get_pdo();
    $id        = uuid4();
    $now       = date('Y-m-d H:i:s');

    $pdo->prepare(
        'INSERT INTO FakturPendapatan
         (id, entityId, npwp, noFaktur, masaPajak, tahunPajak, namaRekanan, namaJkp,
          dpp, dppNilaiLain, tarifPpnPersen, tarifPphPersen, ppn, pph, nilaiProyek,
          labaSetelahPajak, kodeJenisProyek, pekerjaanPerusahaan, pekerjaanYangDipinjam,
          tanggalTerima, bank, nominalDiterima, projectId, bankTransactionId, createdById, createdAt, updatedAt)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
    )->execute([
        $id,
        $body['entityId'],
        $body['npwp'],
        $body['noFaktur'],
        (int)$body['masaPajak'],
        (int)$body['tahunPajak'],
        $body['namaRekanan'],
        $body['namaJkp'],
        (float)$body['dpp'],
        (float)$body['dppNilaiLain'],
        (float)$body['tarifPpnPersen'],
        (float)$body['tarifPphPersen'],
        $kalkulasi['ppn'],
        $kalkulasi['pph'],
        $kalkulasi['nilai_proyek'],
        $kalkulasi['laba_setelah_pajak'],
        (int)($body['kodeJenisProyek'] ?? 1),
        (float)($body['pekerjaanPerusahaan'] ?? 0),
        (float)($body['pekerjaanYangDipinjam'] ?? 0),
        $body['tanggalTerima'],
        $body['bank'],
        (float)$body['nominalDiterima'],
        $body['projectId'] ?? null,
        $body['bankTransactionId'] ?? null,
        $user['id'],
        $now,
        $now,
    ]);

    log_activity($user['id'], 'faktur_pendapatan.create', 'FINANCIAL_CHANGE', [
        'fakturId' => $id,
        'noFaktur' => $body['noFaktur'],
    ]);

    json_response(['message' => 'Faktur pendapatan berhasil ditambahkan.', 'id' => $id], 201);
}

// ─── PUT /api/pendapatan/faktur/:id ──────────────────────────────────────────
if ($method === 'PUT' && $sub_action === 'faktur' && $record_id !== null) {
    $pdo  = get_pdo();
    $stmt = $pdo->prepare('SELECT id FROM FakturPendapatan WHERE id = ?');
    $stmt->execute([$record_id]);
    if (!$stmt->fetch()) error_response('Faktur tidak ditemukan.', 404);

    $kalkulasi = hitung_pajak_faktur($body);
    $now       = date('Y-m-d H:i:s');

    // Bangun SET clause dinamis dari field yang dikirim
    $allowed_fields = [
        'npwp','noFaktur','masaPajak','tahunPajak','namaRekanan','namaJkp',
        'dpp','dppNilaiLain','tarifPpnPersen','tarifPphPersen',
        'kodeJenisProyek','pekerjaanPerusahaan','pekerjaanYangDipinjam',
        'tanggalTerima','bank','nominalDiterima','projectId','bankTransactionId',
    ];

    $set_parts  = [];
    $set_values = [];
    foreach ($allowed_fields as $field) {
        if (array_key_exists($field, $body)) {
            $set_parts[]  = "`$field` = ?";
            $set_values[] = $body[$field] !== '' ? $body[$field] : null;
        }
    }

    // Selalu update nilai kalkulasi pajak
    $set_parts[]  = 'ppn = ?';
    $set_values[] = $kalkulasi['ppn'];
    $set_parts[]  = 'pph = ?';
    $set_values[] = $kalkulasi['pph'];
    $set_parts[]  = 'nilaiProyek = ?';
    $set_values[] = $kalkulasi['nilai_proyek'];
    $set_parts[]  = 'labaSetelahPajak = ?';
    $set_values[] = $kalkulasi['laba_setelah_pajak'];
    $set_parts[]  = 'updatedAt = ?';
    $set_values[] = $now;

    $set_values[] = $record_id;

    $pdo->prepare('UPDATE FakturPendapatan SET ' . implode(', ', $set_parts) . ' WHERE id = ?')
        ->execute($set_values);

    log_activity($user['id'], 'faktur_pendapatan.update', 'FINANCIAL_CHANGE', ['fakturId' => $record_id]);

    json_response(['message' => 'Faktur pendapatan berhasil diperbarui.']);
}

// ─── DELETE /api/pendapatan/faktur/:id ───────────────────────────────────────
if ($method === 'DELETE' && $sub_action === 'faktur' && $record_id !== null) {
    $pdo  = get_pdo();
    $stmt = $pdo->prepare('DELETE FROM FakturPendapatan WHERE id = ?');
    $stmt->execute([$record_id]);
    if ($stmt->rowCount() === 0) error_response('Faktur tidak ditemukan.', 404);

    log_activity($user['id'], 'faktur_pendapatan.delete', 'FINANCIAL_CHANGE', ['fakturId' => $record_id]);

    json_response(['message' => 'Faktur pendapatan berhasil dihapus.']);
}

// ─── PATCH /api/pendapatan/faktur/:id  body: {field, value} ──────────────────
// Toggle ceklis dokumen fisik (ceklisPpn, ceklisPph, ceklisBuktiPotong)
if ($method === 'PATCH' && $sub_action === 'faktur' && $record_id !== null) {
    $field = $body['field'] ?? null; // 'ppn' | 'pph' | 'buktiPotong'
    $value = isset($body['value']) ? (bool)$body['value'] : null;

    $map = ['ppn' => 'ceklisPpn', 'pph' => 'ceklisPph', 'buktiPotong' => 'ceklisBuktiPotong'];
    if (!isset($map[$field])) error_response("Field tidak valid. Gunakan: ppn, pph, buktiPotong.", 400);
    if ($value === null) error_response("value diperlukan.", 400);

    $col = $map[$field];
    $pdo = get_pdo();

    $stmt = $pdo->prepare("SELECT id FROM FakturPendapatan WHERE id = ?");
    $stmt->execute([$record_id]);
    if (!$stmt->fetch()) error_response('Faktur tidak ditemukan.', 404);

    $pdo->prepare("UPDATE FakturPendapatan SET `$col` = ? WHERE id = ?")
        ->execute([$value ? 1 : 0, $record_id]);

    log_activity($user['id'], "faktur_pendapatan.toggle_ceklis.$field", 'FINANCIAL_CHANGE', [
        'fakturId' => $record_id, 'field' => $col, 'value' => $value,
    ]);

    json_response(['message' => 'Status ceklis diperbarui.', 'field' => $col, 'value' => $value]);
}

// ─── POST /api/pendapatan/rekonsiliasi ───────────────────────────────────────
if ($method === 'POST' && $sub_action === 'rekonsiliasi') {
    $required = ['entityId','year','month','dppTerlapor','pajakTerlapor'];
    foreach ($required as $field) {
        if (!isset($body[$field]) || $body[$field] === '') {
            error_response("Field '$field' diperlukan.", 400);
        }
    }

    $pdo = get_pdo();
    $now = date('Y-m-d H:i:s');

    // UPSERT: INSERT ... ON DUPLICATE KEY UPDATE
    $pdo->prepare(
        'INSERT INTO RekonsiliasiPajakBulanan
         (id, entityId, year, month, dppTerlapor, pajakTerlapor, pphTerlapor, keterangan, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           dppTerlapor   = VALUES(dppTerlapor),
           pajakTerlapor = VALUES(pajakTerlapor),
           pphTerlapor   = VALUES(pphTerlapor),
           keterangan    = VALUES(keterangan),
           updatedAt     = VALUES(updatedAt)'
    )->execute([
        uuid4(),
        $body['entityId'],
        (int)$body['year'],
        (int)$body['month'],
        (float)$body['dppTerlapor'],
        (float)$body['pajakTerlapor'],
        (float)($body['pphTerlapor'] ?? 0),
        $body['keterangan'] ?? null,
        $now,
    ]);

    log_activity($user['id'], 'rekonsiliasi_pajak.upsert', 'FINANCIAL_CHANGE', [
        'entityId' => $body['entityId'],
        'year'     => $body['year'],
        'month'    => $body['month'],
    ]);

    json_response(['message' => 'Rekonsiliasi pajak berhasil disimpan.'], 201);
}

error_response('Endpoint tidak ditemukan.', 404);
