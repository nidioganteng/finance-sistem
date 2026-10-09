<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

$auth_user = require_auth();
$id_param  = $segments[1] ?? null;

$DOKUMEN_UPLOAD_DIR      = __DIR__ . '/../../uploads/dokumen/';
$DOKUMEN_UPLOAD_MAX_BYTES = 10 * 1024 * 1024; // 10 MB
$DOKUMEN_ALLOWED_MIME    = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
];
$DOKUMEN_ALLOWED_EXT     = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png'];

// GET /api/dokumen?kategori=SOP
if ($method === 'GET' && !$id_param) {
    $kategori = $_GET['kategori'] ?? null; // SOP | DOKUMEN_PENDUKUNG | null = semua

    $pdo = get_pdo();

    $whereClause = '';
    $params      = [];

    if ($kategori && in_array($kategori, ['SOP', 'DOKUMEN_PENDUKUNG'], true)) {
        $whereClause = 'WHERE d.kategori = ?';
        $params[]    = $kategori;
    }

    $stmt = $pdo->prepare(
        "SELECT d.id, d.judul, d.kategori, d.fileUrl, d.uploadedById, d.createdAt,
                u.name AS uploadedByName
         FROM Dokumen d
         LEFT JOIN User u ON d.uploadedById = u.id
         $whereClause
         ORDER BY d.createdAt DESC"
    );
    $stmt->execute($params);
    $rows = $stmt->fetchAll();

    json_response(['data' => $rows]);
}

// POST /api/dokumen  (multipart/form-data)
if ($method === 'POST' && !$id_param) {
    $judul    = trim($_POST['judul']    ?? $body['judul']    ?? '');
    $kategori = trim($_POST['kategori'] ?? $body['kategori'] ?? '');

    if (!$judul) {
        error_response('judul wajib diisi.', 400);
    }

    $validKategori = ['SOP', 'DOKUMEN_PENDUKUNG'];
    if (!in_array($kategori, $validKategori, true)) {
        error_response('kategori tidak valid. Pilih SOP atau DOKUMEN_PENDUKUNG.', 400);
    }

    if (empty($_FILES['file'])) {
        error_response('File wajib diunggah (multipart field: file).', 400);
    }

    $file = $_FILES['file'];

    if ($file['error'] !== UPLOAD_ERR_OK) {
        $errMap = [
            UPLOAD_ERR_INI_SIZE   => 'File melebihi upload_max_filesize.',
            UPLOAD_ERR_FORM_SIZE  => 'File melebihi MAX_FILE_SIZE form.',
            UPLOAD_ERR_PARTIAL    => 'File hanya terupload sebagian.',
            UPLOAD_ERR_NO_FILE    => 'Tidak ada file yang diunggah.',
            UPLOAD_ERR_NO_TMP_DIR => 'Folder temp tidak ditemukan.',
            UPLOAD_ERR_CANT_WRITE => 'Gagal menulis file ke disk.',
            UPLOAD_ERR_EXTENSION  => 'Upload dihentikan oleh ekstensi PHP.',
        ];
        error_response($errMap[$file['error']] ?? 'Gagal upload file.', 400);
    }

    if ($file['size'] > $DOKUMEN_UPLOAD_MAX_BYTES) {
        error_response('Ukuran file maksimal 10 MB.', 400);
    }

    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
    if (!in_array($ext, $DOKUMEN_ALLOWED_EXT, true)) {
        error_response('Tipe file tidak diizinkan. Diizinkan: pdf, doc, docx, xls, xlsx, jpg, png.', 400);
    }

    // Validasi MIME type via finfo
    $finfo    = new finfo(FILEINFO_MIME_TYPE);
    $mimeType = $finfo->file($file['tmp_name']);
    if (!in_array($mimeType, $DOKUMEN_ALLOWED_MIME, true)) {
        error_response('Tipe MIME file tidak diizinkan.', 400);
    }

    // Buat direktori upload kalau belum ada
    if (!is_dir($DOKUMEN_UPLOAD_DIR)) {
        if (!mkdir($DOKUMEN_UPLOAD_DIR, 0755, true)) {
            error_response('Gagal membuat direktori upload.', 500);
        }
    }

    // Nama file unik
    $safeBaseName = preg_replace('/[^a-zA-Z0-9_\-]/', '_', pathinfo($file['name'], PATHINFO_FILENAME));
    $filename     = date('Ymd_His') . '_' . $safeBaseName . '.' . $ext;
    $destPath     = $DOKUMEN_UPLOAD_DIR . $filename;

    if (!move_uploaded_file($file['tmp_name'], $destPath)) {
        error_response('Gagal memindahkan file yang diunggah.', 500);
    }

    $fileUrl = 'uploads/dokumen/' . $filename;
    $id      = uuid4();
    $now     = date('Y-m-d H:i:s');

    $pdo = get_pdo();
    $pdo->prepare(
        "INSERT INTO Dokumen (id, judul, kategori, fileUrl, uploadedById, createdAt)
         VALUES (?, ?, ?, ?, ?, ?)"
    )->execute([$id, $judul, $kategori, $fileUrl, $auth_user['id'], $now]);

    // Log aktivitas
    if (function_exists('log_activity')) {
        log_activity($auth_user['id'], "Upload dokumen: $judul", 'USER_ACTIVITY', [
            'dokumenId' => $id,
            'judul'     => $judul,
            'kategori'  => $kategori,
            'fileUrl'   => $fileUrl,
        ]);
    }

    json_response(['message' => 'Dokumen berhasil diunggah.', 'id' => $id, 'fileUrl' => $fileUrl], 201);
}

// DELETE /api/dokumen/:id
if ($method === 'DELETE' && $id_param) {
    // Hanya MANAJER_KEUANGAN yang boleh hapus dokumen
    if ($auth_user['role'] !== 'MANAJER_KEUANGAN') {
        error_response('Akses ditolak. Hanya Manajer Keuangan yang dapat menghapus dokumen.', 403);
    }

    $pdo = get_pdo();

    $stmt = $pdo->prepare("SELECT id, judul, fileUrl FROM Dokumen WHERE id = ?");
    $stmt->execute([$id_param]);
    $doc = $stmt->fetch();
    if (!$doc) {
        error_response('Dokumen tidak ditemukan.', 404);
    }

    // Hapus file fisik
    $filePath = __DIR__ . '/../../' . $doc['fileUrl'];
    if (file_exists($filePath)) {
        @unlink($filePath);
    }

    $pdo->prepare("DELETE FROM Dokumen WHERE id = ?")->execute([$id_param]);

    // Log aktivitas
    if (function_exists('log_activity')) {
        log_activity($auth_user['id'], "Hapus dokumen: {$doc['judul']}", 'USER_ACTIVITY', [
            'dokumenId' => $id_param,
            'judul'     => $doc['judul'],
        ]);
    }

    json_response(['message' => "Dokumen '{$doc['judul']}' berhasil dihapus."]);
}

error_response('Endpoint tidak ditemukan.', 404);
