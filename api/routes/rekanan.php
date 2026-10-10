<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

// ─── Router ───────────────────────────────────────────────────────────────────
// $segments[0] = 'rekanan'
// $segments[1] = '' | 'search' | 'auto-register' | {id}

$sub = $segments[1] ?? '';

// Helper: format satu row Rekanan
function format_rekanan_row(array $r): array {
    return [
        'id'           => $r['id'],
        'nama'         => $r['nama'],
        'npwp'         => $r['npwp'] ?? null,
        'nik'          => $r['nik'] ?? null,
        'tipe'         => $r['tipe'],
        'kategori'     => $r['kategori'] ?? null,
        'alamat'       => $r['alamat'] ?? null,
        'telepon'      => $r['telepon'] ?? null,
        'email'        => $r['email'] ?? null,
        'namaBank'     => $r['namaBank'] ?? null,
        'noRekening'   => $r['noRekening'] ?? null,
        'atasNamaBank' => $r['atasNamaBank'] ?? null,
        'entityId'     => $r['entityId'] ?? null,
        'entityName'   => $r['entityName'] ?? null,
        'createdAt'    => $r['createdAt'],
        'updatedAt'    => $r['updatedAt'],
    ];
}

// Helper: normalisasi NPWP / NIK (hapus titik, strip, spasi)
function clean_identity_number(string $val): string {
    return preg_replace('/[\s.\-_\/]/', '', $val);
}

// ─── GET /api/rekanan/search?q=...&tipe=... ───────────────────────────────────
if ($method === 'GET' && $sub === 'search') {
    require_auth();
    $pdo  = get_pdo();
    $q    = trim($_GET['q'] ?? '');
    $tipe = trim($_GET['tipe'] ?? '');

    $where_parts = ['1=1'];
    $params      = [];

    if ($tipe && $tipe !== 'ALL') {
        $where_parts[] = 'r.tipe = ?';
        $params[]      = $tipe;
    }

    if ($q === '') {
        // Default: top 15
        $where_sql = implode(' AND ', $where_parts);
        $stmt = $pdo->prepare(
            "SELECT r.*, e.name AS entityName
             FROM Rekanan r
             LEFT JOIN Entity e ON r.entityId = e.id
             WHERE $where_sql
             ORDER BY r.nama ASC
             LIMIT 15"
        );
        $stmt->execute($params);
    } else {
        $cleaned = clean_identity_number($q);
        $like_q  = '%' . $q . '%';
        $like_c  = '%' . $cleaned . '%';

        $or_parts = ['r.nama LIKE ?', 'r.npwp LIKE ?', 'r.nik LIKE ?'];
        $params_search = array_merge($params, [$like_q, $like_q, $like_q]);

        if (strlen($cleaned) >= 3) {
            $or_parts[]     = 'r.npwp LIKE ?';
            $or_parts[]     = 'r.nik LIKE ?';
            $params_search[] = $like_c;
            $params_search[] = $like_c;
        }

        $where_parts[] = '(' . implode(' OR ', $or_parts) . ')';
        $where_sql = implode(' AND ', $where_parts);

        $stmt = $pdo->prepare(
            "SELECT r.*, e.name AS entityName
             FROM Rekanan r
             LEFT JOIN Entity e ON r.entityId = e.id
             WHERE $where_sql
             ORDER BY r.nama ASC
             LIMIT 15"
        );
        $stmt->execute($params_search);
    }

    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    json_response(['data' => array_map('format_rekanan_row', $rows)]);
}

// ─── GET /api/rekanan?search=...&tipe=...&entityId=... ───────────────────────
elseif ($method === 'GET' && $sub === '') {
    require_auth();
    $pdo       = get_pdo();
    $search    = trim($_GET['search'] ?? '');
    $tipe      = trim($_GET['tipe'] ?? '');
    $entity_id = trim($_GET['entityId'] ?? '');

    $where_parts = ['1=1'];
    $params      = [];

    if ($tipe && $tipe !== 'ALL') {
        $where_parts[] = 'r.tipe = ?';
        $params[]      = $tipe;
    }
    if ($entity_id) {
        $where_parts[] = 'r.entityId = ?';
        $params[]      = $entity_id;
    }
    if ($search !== '') {
        $like = '%' . $search . '%';
        $where_parts[] = '(r.nama LIKE ? OR r.npwp LIKE ? OR r.nik LIKE ? OR r.kategori LIKE ? OR r.noRekening LIKE ?)';
        $params = array_merge($params, [$like, $like, $like, $like, $like]);
    }

    $where_sql = implode(' AND ', $where_parts);
    $stmt = $pdo->prepare(
        "SELECT r.*, e.name AS entityName
         FROM Rekanan r
         LEFT JOIN Entity e ON r.entityId = e.id
         WHERE $where_sql
         ORDER BY r.tipe ASC, r.nama ASC"
    );
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    json_response(['data' => array_map('format_rekanan_row', $rows)]);
}

// ─── POST /api/rekanan/auto-register ─────────────────────────────────────────
elseif ($method === 'POST' && $sub === 'auto-register') {
    require_auth();
    $pdo  = get_pdo();

    $npwp = trim($body['npwp'] ?? '');
    $nama = trim($body['nama'] ?? '');
    $tipe = $body['tipe'] ?? 'KLIEN';

    if (!$nama) {
        json_response(['success' => true]); // Abaikan jika nama kosong
    }

    // Cek existing
    $conditions = [];
    $params     = ['tipe' => 'TENAGA_AHLI']; // unused, just structure
    $or_sql     = [];
    $bind       = [];

    if ($npwp) {
        $or_sql[] = 'npwp = ?';
        $bind[]   = $npwp;
    }
    $or_sql[] = 'nama = ?';
    $bind[]   = $nama;

    $where_or = implode(' OR ', $or_sql);
    $stmt = $pdo->prepare("SELECT id, npwp FROM Rekanan WHERE $where_or LIMIT 1");
    $stmt->execute($bind);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$existing) {
        // Buat baru
        $id  = uuid4();
        $now = date('Y-m-d H:i:s');
        $pdo->prepare(
            "INSERT INTO Rekanan (id, nama, npwp, tipe, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?)"
        )->execute([$id, $nama, $npwp ?: null, $tipe, $now, $now]);
    } elseif (!$existing['npwp'] && $npwp) {
        // Perbarui NPWP jika sebelumnya kosong
        $now = date('Y-m-d H:i:s');
        $pdo->prepare("UPDATE Rekanan SET npwp = ?, updatedAt = ? WHERE id = ?")
            ->execute([$npwp, $now, $existing['id']]);
    }

    json_response(['success' => true]);
}

// ─── POST /api/rekanan ────────────────────────────────────────────────────────
elseif ($method === 'POST' && $sub === '') {
    $user = require_auth();
    $pdo  = get_pdo();

    $nama         = trim($body['nama'] ?? '');
    $npwp         = trim($body['npwp'] ?? '') ?: null;
    $nik          = trim($body['nik'] ?? '') ?: null;
    $tipe         = $body['tipe'] ?? 'VENDOR';
    $kategori     = trim($body['kategori'] ?? '') ?: null;
    $alamat       = trim($body['alamat'] ?? '') ?: null;
    $telepon      = trim($body['telepon'] ?? '') ?: null;
    $email        = trim($body['email'] ?? '') ?: null;
    $nama_bank    = trim($body['namaBank'] ?? '') ?: null;
    $no_rekening  = trim($body['noRekening'] ?? '') ?: null;
    $atas_nama    = trim($body['atasNamaBank'] ?? '') ?: null;
    $entity_id    = trim($body['entityId'] ?? '') ?: null;

    if (!$nama) return error_response('Nama rekanan wajib diisi.', 400);

    // Cek duplikasi NPWP
    if ($npwp) {
        $cleaned = clean_identity_number($npwp);
        $stmt = $pdo->prepare(
            "SELECT id, nama FROM Rekanan WHERE npwp = ? OR npwp = ? LIMIT 1"
        );
        $stmt->execute([$npwp, $cleaned]);
        $dup = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($dup) {
            return error_response("Rekanan dengan NPWP ini sudah terdaftar: {$dup['nama']}", 409);
        }
    }

    $id  = uuid4();
    $now = date('Y-m-d H:i:s');
    $pdo->prepare(
        "INSERT INTO Rekanan
         (id, nama, npwp, nik, tipe, kategori, alamat, telepon, email,
          namaBank, noRekening, atasNamaBank, entityId, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )->execute([
        $id, $nama, $npwp, $nik, $tipe, $kategori, $alamat, $telepon, $email,
        $nama_bank, $no_rekening, $atas_nama, $entity_id, $now, $now,
    ]);

    log_activity($user['id'], "Tambah master rekanan: $nama ($tipe)", 'FINANCIAL_CHANGE', [
        'rekananId' => $id, 'nama' => $nama, 'tipe' => $tipe, 'npwp' => $npwp, 'nik' => $nik,
    ]);

    json_response(['success' => true, 'id' => $id]);
}

// ─── PUT /api/rekanan/{id} ────────────────────────────────────────────────────
elseif ($method === 'PUT' && $sub !== '') {
    $user = require_auth();
    $pdo  = get_pdo();
    $id   = $sub;

    $stmt = $pdo->prepare("SELECT id, nama, tipe FROM Rekanan WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$existing) return error_response('Rekanan tidak ditemukan.', 404);

    $sets   = [];
    $params = [];
    $fields = [
        'nama', 'npwp', 'nik', 'tipe', 'kategori', 'alamat',
        'telepon', 'email', 'namaBank', 'noRekening', 'atasNamaBank', 'entityId',
    ];
    foreach ($fields as $f) {
        if (array_key_exists($f, $body)) {
            $val = is_string($body[$f]) ? (trim($body[$f]) ?: null) : $body[$f];
            if ($f === 'nama' && $val === null) continue; // nama tidak boleh null
            $sets[]   = "`$f` = ?";
            $params[] = $val;
        }
    }
    if (empty($sets)) return error_response('Tidak ada field yang diubah.', 400);

    $sets[]   = 'updatedAt = ?';
    $params[] = date('Y-m-d H:i:s');
    $params[] = $id;

    $pdo->prepare("UPDATE Rekanan SET " . implode(', ', $sets) . " WHERE id = ?")
        ->execute($params);

    // Re-fetch
    $stmt = $pdo->prepare("SELECT r.*, e.name AS entityName FROM Rekanan r LEFT JOIN Entity e ON r.entityId = e.id WHERE r.id = ?");
    $stmt->execute([$id]);
    $updated = $stmt->fetch(PDO::FETCH_ASSOC);

    log_activity($user['id'], "Ubah master rekanan: {$updated['nama']} ({$updated['tipe']})", 'FINANCIAL_CHANGE', [
        'rekananId' => $id, 'nama' => $updated['nama'], 'tipe' => $updated['tipe'],
    ]);

    json_response(['success' => true, 'id' => $id]);
}

// ─── DELETE /api/rekanan/{id} ─────────────────────────────────────────────────
elseif ($method === 'DELETE' && $sub !== '') {
    $user = require_auth();
    $pdo  = get_pdo();
    $id   = $sub;

    $stmt = $pdo->prepare("SELECT id, nama FROM Rekanan WHERE id = ? LIMIT 1");
    $stmt->execute([$id]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$existing) return error_response('Rekanan tidak ditemukan.', 404);

    $pdo->prepare("DELETE FROM Rekanan WHERE id = ?")->execute([$id]);

    log_activity($user['id'], "Hapus master rekanan: {$existing['nama']}", 'FINANCIAL_CHANGE', [
        'rekananId' => $id, 'nama' => $existing['nama'],
    ]);

    json_response(['success' => true]);
}

else {
    error_response('Endpoint tidak ditemukan.', 404);
}
