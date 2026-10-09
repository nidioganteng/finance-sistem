<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

require_once __DIR__ . '/../helpers/kas-helpers.php';

// ─── Router ───────────────────────────────────────────────────────────────────
// $segments[0] = 'jurnal'
// $segments[1] = '' (list) | 'kode-akun' | 'proyek'

$sub = $segments[1] ?? '';

// ─── GET /api/jurnal ───────────────────────────────────────────────────────────
// Logika: 1:1 dengan getJurnalRows() di src/lib/jurnal.ts
if ($method === 'GET' && $sub === '') {
    require_auth();
    $pdo = get_pdo();

    $entity_id       = $_GET['entityId']      ?? '';
    $dari            = $_GET['dari']          ?? null;   // format "YYYY-MM" atau "YYYY-MM-DD"
    $sampai          = $_GET['sampai']        ?? null;
    $jenis_input_key = $_GET['jenisInputKey'] ?? null;
    $akun_code       = $_GET['akunCode']      ?? null;
    $project_id      = $_GET['projectId']     ?? null;
    $page            = max(1, (int)($_GET['page'] ?? 1));

    if (!$entity_id) return error_response('entityId wajib diisi.', 400);

    // Bangun filter tanggal
    // Jika format "YYYY-MM" → filter satu bulan penuh
    $tanggal_gte = null;
    $tanggal_lt  = null;
    if ($dari && preg_match('/^\d{4}-\d{2}$/', $dari)) {
        [$y, $m] = explode('-', $dari);
        $tanggal_gte = "$y-$m-01 00:00:00";
        $next = mktime(0, 0, 0, (int)$m + 1, 1, (int)$y);
        $tanggal_lt  = date('Y-m-d', $next) . ' 00:00:00';
    } elseif ($dari || $sampai) {
        if ($dari)   $tanggal_gte = $dari . ' 00:00:00';
        if ($sampai) $tanggal_lt  = $sampai . ' 23:59:59';
    }

    // Kecualikan auto-posted rows (JSON_EXTRACT = true)
    $stmt_auto = $pdo->prepare(
        "SELECT id FROM `Transaction`
         WHERE entityId = ?
           AND JSON_EXTRACT(extraFieldsJson, '$.autoPostedFromJurnal') = true"
    );
    $stmt_auto->execute([$entity_id]);
    $exclude_ids = $stmt_auto->fetchAll(PDO::FETCH_COLUMN);

    // Bangun WHERE dinamis
    $where_parts = ['t.entityId = ?'];
    $params      = [$entity_id];

    if ($jenis_input_key && $jenis_input_key !== 'semua') {
        $where_parts[] = 'ji.`key` = ?';
        $params[]      = $jenis_input_key;
    }
    if ($tanggal_gte) {
        $where_parts[] = 't.tanggal >= ?';
        $params[]      = $tanggal_gte;
    }
    if ($tanggal_lt) {
        $where_parts[] = 't.tanggal < ?';
        $params[]      = $tanggal_lt;
    }
    if ($akun_code) {
        $where_parts[] = 'c.code = ?';
        $params[]      = $akun_code;
    }
    if ($project_id) {
        $where_parts[] = 't.projectId = ?';
        $params[]      = $project_id;
    }
    if (!empty($exclude_ids)) {
        $ex_ph         = implode(',', array_fill(0, count($exclude_ids), '?'));
        $where_parts[] = "t.id NOT IN ($ex_ph)";
        $params        = array_merge($params, $exclude_ids);
    }

    $where_sql = implode(' AND ', $where_parts);

    $page_size = 25;

    // Count total
    $count_sql = "SELECT COUNT(*) FROM `Transaction` t
                  LEFT JOIN JenisInputTransaksi ji ON t.jenisInputId = ji.id
                  LEFT JOIN CoaAccount c ON t.coaAccountId = c.id
                  WHERE $where_sql";
    $stmt_count = $pdo->prepare($count_sql);
    $stmt_count->execute($params);
    $total_count = (int)$stmt_count->fetchColumn();

    // Fetch halaman
    $sql = "SELECT t.id, t.tanggal, t.noBukti, t.keterangan, t.debit, t.kredit,
                   t.extraFieldsJson, t.projectId,
                   ji.`key` as jenis_key, ji.nama as jenis_nama,
                   c.id as coa_id, c.code as coa_code, c.name as coa_name, c.kategori as coa_kategori,
                   p.id as project_id_val, p.code as project_code, p.name as project_name,
                   s.name as staff_name
            FROM `Transaction` t
            LEFT JOIN JenisInputTransaksi ji ON t.jenisInputId = ji.id
            LEFT JOIN CoaAccount c ON t.coaAccountId = c.id
            LEFT JOIN Project p ON t.projectId = p.id
            LEFT JOIN User s ON t.staffId = s.id
            WHERE $where_sql
            ORDER BY t.tanggal DESC, t.noBukti DESC, t.createdAt DESC
            LIMIT ? OFFSET ?";
    $params[] = $page_size;
    $params[] = ($page - 1) * $page_size;

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Jika ada filter akun, tambahkan kasEntry pasangan supaya jurnal lengkap per transaksi
    // Logika: 1:1 dengan bagian akunCode di getJurnalRows() src/lib/jurnal.ts
    if ($akun_code && !empty($rows)) {
        $no_buktis = array_unique(array_column($rows, 'noBukti'));
        $nb_ph = implode(',', array_fill(0, count($no_buktis), '?'));

        // Hapus exclude & akun_code filter dari extra query
        $extra_params = array_merge([$entity_id], $no_buktis);
        $stmt_kas = $pdo->prepare(
            "SELECT t.id, t.tanggal, t.noBukti, t.keterangan, t.debit, t.kredit,
                    t.extraFieldsJson, t.projectId,
                    ji.`key` as jenis_key, ji.nama as jenis_nama,
                    c.id as coa_id, c.code as coa_code, c.name as coa_name, c.kategori as coa_kategori,
                    p.id as project_id_val, p.code as project_code, p.name as project_name,
                    s.name as staff_name
             FROM `Transaction` t
             LEFT JOIN JenisInputTransaksi ji ON t.jenisInputId = ji.id
             LEFT JOIN CoaAccount c ON t.coaAccountId = c.id
             LEFT JOIN Project p ON t.projectId = p.id
             LEFT JOIN User s ON t.staffId = s.id
             WHERE t.entityId = ? AND t.noBukti IN ($nb_ph)
               AND JSON_VALUE(t.extraFieldsJson, '$.isKasEntry') = 'true'
               AND (c.code IS NULL OR c.code <> ?)"
        );
        $extra_params[] = $akun_code;
        $stmt_kas->execute($extra_params);
        $kas_rows = $stmt_kas->fetchAll(PDO::FETCH_ASSOC);

        // Deduplikasi (by id)
        $existing_ids = array_column($rows, 'id');
        foreach ($kas_rows as $kr) {
            if (!in_array($kr['id'], $existing_ids)) $rows[] = $kr;
        }
    }

    // Sort: tanggal DESC, lalu dalam noBukti sama debit di atas kredit
    // Logika: 1:1 dengan sort di getJurnalRows() src/lib/jurnal.ts
    usort($rows, function($a, $b) {
        $date_diff = strtotime($b['tanggal']) - strtotime($a['tanggal']);
        if ($date_diff !== 0) return $date_diff;
        if ($a['noBukti'] !== $b['noBukti']) return strcmp($b['noBukti'], $a['noBukti']);
        $a_is_debit = (float)$a['debit'] > 0;
        $b_is_debit = (float)$b['debit'] > 0;
        if ($a_is_debit !== $b_is_debit) return $a_is_debit ? -1 : 1;
        return 0;
    });

    // Kumpulkan project per noBukti (fallback)
    $project_by_no_bukti = [];
    foreach ($rows as $r) {
        if ($r['project_code'] && !isset($project_by_no_bukti[$r['noBukti']])) {
            $project_by_no_bukti[$r['noBukti']] = [
                'id' => $r['project_id_val'], 'code' => $r['project_code'], 'name' => $r['project_name'],
            ];
        }
    }

    // Label sumber — dari SUMBER_STYLE di src/lib/jurnal.ts
    $sumber_style = [
        'kasKecil'       => ['bg' => '#fef3c7', 'color' => '#92400e', 'label' => 'Kas Kecil'],
        'kasBesar'       => ['bg' => '#dbeafe', 'color' => '#1e40af', 'label' => 'Kas Besar'],
        'bankBuku'       => ['bg' => '#dcfce7', 'color' => '#166534', 'label' => 'Buku Bank'],
        'jurnalTransaksi'=> ['bg' => '#ede9fe', 'color' => '#6d28d9', 'label' => 'Jurnal Transaksi'],
    ];
    $entity_label_map = [
        'kencana' => 'Kencana', 'gaharu' => 'Gaharu', 'tataring' => 'Tataring',
        'ciptaAsri' => 'Cipta Asri', 'umum' => 'Umum',
    ];

    $total_debit  = 0.0;
    $total_kredit = 0.0;

    $result_rows = [];
    foreach ($rows as $r) {
        $extra      = $r['extraFieldsJson'] ? json_decode($r['extraFieldsJson'], true) : [];
        $is_crossing= !empty($extra['isCrossingEntry']);
        $is_kas_entry = !empty($extra['isKasEntry']) && !$is_crossing;

        // Tentukan style sumber
        $style = $sumber_style[$r['jenis_key']] ?? ['bg' => '#ede9fe', 'color' => '#6d28d9', 'label' => $r['jenis_nama']];

        if ($is_crossing) {
            $from_key   = (string)($extra['crossingFromEntityKey']    ?? '');
            $from_jenis = (string)($extra['crossingFromJenisInputKey'] ?? '');
            if (!$from_jenis && (!empty($extra['crossingFromRekeningNama']) || !empty($extra['rekeningNama']))) {
                $from_jenis = 'bankBuku';
            } elseif (!$from_jenis) {
                $from_jenis = 'kasKecil';
            }
            $base_style = $sumber_style[$from_jenis] ?? $sumber_style['kasKecil'];
            $from_name  = $entity_label_map[$from_key] ?? $from_key;
            $rek_suffix = !empty($extra['crossingFromRekeningNama']) ? ' (' . $extra['crossingFromRekeningNama'] . ')' : '';
            $style = [
                'bg'    => $base_style['bg'],
                'color' => $base_style['color'],
                'label' => $from_name ? "{$base_style['label']} {$from_name}{$rek_suffix}" : $base_style['label'],
            ];
        }

        $kode_akun = $r['coa_code'] ?? '—';
        $nama_akun = $r['coa_name'] ?? '—';
        if ($is_kas_entry && !$r['coa_id']) {
            $kode_akun = '—';
            $nama_akun = match($r['jenis_key']) {
                'kasKecil' => 'Kas Kecil',
                'kasBesar' => 'Kas',
                default    => (string)($extra['rekeningNama'] ?? 'Rekening Bank'),
            };
        }

        $proj = null;
        if ($r['project_id_val']) {
            $proj = ['id' => $r['project_id_val'], 'code' => $r['project_code'], 'name' => $r['project_name']];
        } elseif (isset($project_by_no_bukti[$r['noBukti']])) {
            $proj = $project_by_no_bukti[$r['noBukti']];
        }

        $debit  = (float)$r['debit'];
        $kredit = (float)$r['kredit'];
        $total_debit  += $debit;
        $total_kredit += $kredit;

        $staff_name = $r['staff_name'] ?? '';
        $initials   = implode('', array_map(fn($p) => $p[0] ?? '', array_slice(explode(' ', $staff_name), 0, 2)));

        $result_rows[] = [
            'id'              => $r['id'],
            'tanggal'         => $r['tanggal'],
            'noBukti'         => $r['noBukti'],
            'keterangan'      => $r['keterangan'],
            'projectId'       => $proj['id']   ?? $r['projectId'] ?? null,
            'projectCode'     => $proj['code'] ?? null,
            'projectName'     => $proj['name'] ?? null,
            'sumberBg'        => $style['bg'],
            'sumberColor'     => $style['color'],
            'sumberLabel'     => $style['label'],
            'isKasEntry'      => $is_kas_entry,
            'isKredit'        => $kredit > 0 && $debit === 0.0,
            'kodeAkun'        => $kode_akun,
            'namaAkun'        => $nama_akun,
            'canEditKodeAkun' => !$is_kas_entry && !empty($r['coa_id']),
            'debit'           => $debit,
            'kredit'          => $kredit,
            'staffName'       => $staff_name,
            'staffInitial'    => $initials,
            'arahLaporan'     => is_array($extra['arahLaporan'] ?? null) ? $extra['arahLaporan'] : [],
        ];
    }

    $is_balanced = round($total_debit * 100) === round($total_kredit * 100);

    json_response([
        'rows'         => $result_rows,
        'totalDebit'   => $total_debit,
        'totalKredit'  => $total_kredit,
        'isBalanced'   => $is_balanced,
        'totalCount'   => $total_count,
        'totalPages'   => max(1, (int)ceil($total_count / $page_size)),
        'page'         => $page,
    ]);
}

// ─── PATCH /api/jurnal/kode-akun ──────────────────────────────────────────────
// Logika: 1:1 dengan updateKodeAkunJurnal() di src/lib/actions/jurnal.ts
elseif ($method === 'PATCH' && $sub === 'kode-akun') {
    $user = require_auth();
    $pdo  = get_pdo();

    $transaction_id = $body['transactionId'] ?? '';
    $entity_id      = $body['entityId']      ?? '';
    $new_code       = trim($body['newCode']  ?? '');

    if (!$transaction_id || !$entity_id) return error_response('transactionId dan entityId wajib diisi.', 400);
    if (!$new_code) return error_response('Kode akun wajib diisi.', 400);

    // Validasi akses entity
    $stmt = $pdo->prepare("SELECT id, `key`, name FROM Entity WHERE id = ?");
    $stmt->execute([$entity_id]);
    $entity = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$entity || !in_array($entity['key'], $user['entityKeys'] ?? [])) {
        return error_response('Kamu tidak punya akses ke entitas ini.', 403);
    }

    // Cari transaksi
    $stmt = $pdo->prepare(
        "SELECT t.id, c.code as old_code, c.name as old_name
         FROM `Transaction` t
         LEFT JOIN CoaAccount c ON t.coaAccountId = c.id
         WHERE t.id = ? AND t.entityId = ? LIMIT 1"
    );
    $stmt->execute([$transaction_id, $entity_id]);
    $tx = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$tx) return error_response('Transaksi tidak ditemukan di entitas ini.', 404);
    if (!$tx['old_code']) return error_response('Baris ini tidak punya akun yang bisa diedit.', 400);
    if ($tx['old_code'] === $new_code) {
        json_response(['success' => true]);
        return;
    }

    // Cari target COA
    $stmt = $pdo->prepare('SELECT id FROM CoaAccount WHERE code = ?');
    $stmt->execute([$new_code]);
    $target_coa_id = $stmt->fetchColumn();
    if (!$target_coa_id) {
        return error_response("Kode akun \"$new_code\" tidak ditemukan di Bagan Akun.", 404);
    }

    $stmt = $pdo->prepare("UPDATE `Transaction` SET coaAccountId = ? WHERE id = ? AND entityId = ?");
    $stmt->execute([$target_coa_id, $transaction_id, $entity_id]);
    if ($stmt->rowCount() === 0) return error_response('Transaksi tidak ditemukan.', 404);

    log_activity($user['id'], "Edit kode akun jurnal {$tx['old_code']} → $new_code ({$entity['name']})", 'FINANCIAL_CHANGE', [
        'transactionId' => $transaction_id, 'entityId' => $entity_id,
        'oldCode' => $tx['old_code'], 'newCode' => $new_code,
    ]);

    json_response(['success' => true]);
}

// ─── PATCH /api/jurnal/proyek ──────────────────────────────────────────────────
// Logika: 1:1 dengan updateProyekJurnal() di src/lib/actions/jurnal.ts
elseif ($method === 'PATCH' && $sub === 'proyek') {
    $user = require_auth();
    $pdo  = get_pdo();

    $transaction_id  = $body['transactionId'] ?? '';
    $entity_id       = $body['entityId']      ?? '';
    $new_project_id  = trim($body['newProjectId'] ?? '') ?: null;

    if (!$transaction_id || !$entity_id) return error_response('transactionId dan entityId wajib diisi.', 400);

    // Validasi akses entity
    $stmt = $pdo->prepare("SELECT id, `key`, name FROM Entity WHERE id = ?");
    $stmt->execute([$entity_id]);
    $entity = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$entity || !in_array($entity['key'], $user['entityKeys'] ?? [])) {
        return error_response('Kamu tidak punya akses ke entitas ini.', 403);
    }

    // Cari transaksi
    $stmt = $pdo->prepare("SELECT id, noBukti, projectId FROM `Transaction` WHERE id = ? AND entityId = ? LIMIT 1");
    $stmt->execute([$transaction_id, $entity_id]);
    $tx = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$tx) return error_response('Transaksi tidak ditemukan.', 404);

    // Validasi project baru
    $target_project = null;
    if ($new_project_id) {
        $stmt = $pdo->prepare('SELECT id, code, name FROM Project WHERE id = ?');
        $stmt->execute([$new_project_id]);
        $target_project = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$target_project) return error_response('Proyek tidak ditemukan.', 404);
    }

    // Update semua baris dengan noBukti yang sama di entitas ini
    $pdo->prepare("UPDATE `Transaction` SET projectId = ? WHERE entityId = ? AND noBukti = ?")
        ->execute([$new_project_id, $entity_id, $tx['noBukti']]);

    // Update auto-posted rows
    $pdo->prepare(
        "UPDATE `Transaction` SET projectId = ?
         WHERE noBukti = ? AND JSON_VALUE(extraFieldsJson, '$.autoPostedFromJurnal') = 'true'"
    )->execute([$new_project_id, $tx['noBukti']]);

    // Update faktur pendapatan
    $pdo->prepare("UPDATE FakturPendapatan SET projectId = ? WHERE noFaktur = ?")
        ->execute([$new_project_id, $tx['noBukti']]);

    $proj_label = $target_project ? $target_project['code'] : 'Bukan Proyek';
    log_activity($user['id'], "Update proyek transaksi {$tx['noBukti']} ({$entity['name']}): $proj_label", 'FINANCIAL_CHANGE', [
        'noBukti' => $tx['noBukti'], 'entityId' => $entity_id,
        'oldProjectId' => $tx['projectId'], 'newProjectId' => $new_project_id,
    ]);

    json_response(['success' => true]);
}

else {
    error_response('Endpoint tidak ditemukan.', 404);
}
