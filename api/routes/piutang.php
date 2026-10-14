<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

$user       = require_auth();
$sub_action = $segments[1] ?? null; // null | 'pelunasan' | 'termin' | 'proyek'
$sub_sub    = $segments[2] ?? null; // 'audit' | 'status' | 'complete' | 'cancel' | 'reopen'

// ─── Helper: cari entityId dari entityKey ───────────────────────────────────
function resolve_entity_by_key(string $key): ?array {
    $pdo  = get_pdo();
    $stmt = $pdo->prepare('SELECT id, `key`, name FROM Entity WHERE `key` = ?');
    $stmt->execute([$key]);
    return $stmt->fetch() ?: null;
}

// ─── GET /api/piutang?entityKey=... ─────────────────────────────────────────
if ($method === 'GET' && $sub_action === null) {
    $entity_key = $_GET['entityKey'] ?? null;
    if (!$entity_key) error_response('entityKey diperlukan.', 400);

    $entity = resolve_entity_by_key($entity_key);
    if (!$entity) error_response('Entitas tidak ditemukan.', 404);

    $entity_id = $entity['id'];
    $pdo       = get_pdo();

    // --- Saldo piutang/hutang antar entitas (akun kode 111-115, 311-315) ---
    $stmt = $pdo->prepare(
        'SELECT c.code, SUM(t.debit) - SUM(t.kredit) AS saldo
         FROM `Transaction` t
         JOIN CoaAccount c ON t.coaAccountId = c.id
         WHERE t.entityId = ?
           AND c.code IN (\'111\',\'112\',\'113\',\'114\',\'115\',\'311\',\'312\',\'313\',\'314\',\'315\')
         GROUP BY c.code'
    );
    $stmt->execute([$entity_id]);
    $saldo_antar_entitas_rows = $stmt->fetchAll();

    $saldo_map = [];
    foreach ($saldo_antar_entitas_rows as $row) {
        $saldo_map[$row['code']] = (float)$row['saldo'];
    }

    // --- Proyek ACTIVE milik entitas ini ---
    $stmt = $pdo->prepare(
        'SELECT p.id, p.code, p.name, p.contractValue, p.spend, p.deadline, p.status,
                e.`key` AS entity_key, e.name AS entity_name
         FROM Project p
         JOIN Entity e ON p.entityId = e.id
         WHERE p.entityId = ? AND p.status = \'ACTIVE\'
         ORDER BY p.createdAt DESC'
    );
    $stmt->execute([$entity_id]);
    $projects = $stmt->fetchAll();

    // Ambil semua termin sekaligus untuk proyek di atas
    if (!empty($projects)) {
        $project_ids   = array_column($projects, 'id');
        $placeholders  = implode(',', array_fill(0, count($project_ids), '?'));
        $stmt = $pdo->prepare(
            "SELECT id, projectId, name, percentage, nominal, status, auditedAt, auditedById, createdAt
             FROM Termin
             WHERE projectId IN ($placeholders)
             ORDER BY percentage ASC"
        );
        $stmt->execute($project_ids);
        $all_termin = $stmt->fetchAll();

        // Indeks termin per projectId
        $termin_by_project = [];
        foreach ($all_termin as $t) {
            $t['nominal']     = (float)$t['nominal'];
            $t['percentage']  = (float)$t['percentage'];
            $termin_by_project[$t['projectId']][] = $t;
        }

        // Gabungkan termin ke proyek
        foreach ($projects as &$p) {
            $p['termin']          = $termin_by_project[$p['id']] ?? [];
            $p['contractValue']   = (float)$p['contractValue'];
            $p['spend']           = (float)$p['spend'];
        }
        unset($p);
    }

    // --- LoadingDock (khusus entitas Umum) ---
    $loading_dock = [];
    if ($entity['key'] === 'umum' || $entity['key'] === 'Umum') {
        $stmt = $pdo->prepare(
            'SELECT ld.id, ld.nama, ld.total, ld.status, ld.reviewedAt, ld.createdAt,
                    e.`key` AS entity_key, e.name AS entity_name
             FROM LoadingDockTransaksi ld
             JOIN Entity e ON ld.entityId = e.id
             WHERE ld.entityId = ?
             ORDER BY ld.createdAt DESC'
        );
        $stmt->execute([$entity_id]);
        $loading_dock = $stmt->fetchAll();
        foreach ($loading_dock as &$ld) {
            $ld['total'] = (float)$ld['total'];
        }
        unset($ld);
    }

    json_response([
        'entity'              => $entity,
        'saldoAntarEntitas'   => $saldo_map,
        'projects'            => $projects,
        'loadingDock'         => $loading_dock,
    ]);
}

// ─── GET /api/piutang/metrics?entityKeys[]=... ───────────────────────────────
if ($method === 'GET' && $sub_action === 'metrics') {
    $entity_keys_raw = $_GET['entityKeys'] ?? [];
    if (!is_array($entity_keys_raw)) $entity_keys_raw = [$entity_keys_raw];
    $entity_keys = array_filter(array_map('trim', $entity_keys_raw));

    $pdo = get_pdo();

    // Resolve entityIds dari keys
    $entity_ids = [];
    if (!empty($entity_keys)) {
        $pk = implode(',', array_fill(0, count($entity_keys), '?'));
        $stmt = $pdo->prepare("SELECT id, `key`, name FROM Entity WHERE `key` IN ($pk)");
        $stmt->execute($entity_keys);
        $entities_map = [];
        foreach ($stmt->fetchAll() as $e) {
            $entity_ids[]            = $e['id'];
            $entities_map[$e['id']]  = $e;
        }
    } else {
        $stmt = $pdo->query("SELECT id, `key`, name FROM Entity");
        $entities_map = [];
        foreach ($stmt->fetchAll() as $e) {
            $entity_ids[]           = $e['id'];
            $entities_map[$e['id']] = $e;
        }
    }

    if (empty($entity_ids)) {
        json_response(['terminPerluPerhatian' => 0, 'totalPiutangBelumTertagih' => 0, 'overdueProjects' => []]);
    }

    $id_ph = implode(',', array_fill(0, count($entity_ids), '?'));
    $today = date('Y-m-d');

    // Proyek aktif yang overdue (deadline < today & status ACTIVE)
    $stmt = $pdo->prepare(
        "SELECT p.id, p.code, p.name, p.entityId, p.contractValue, p.deadline,
                COALESCE(SUM(CASE WHEN t.status IN ('LUNAS','DITERIMA') THEN t.percentage ELSE 0 END), 0) AS pct_dibayar,
                COALESCE(SUM(CASE WHEN t.status IN ('LUNAS','DITERIMA') THEN COALESCE(t.nominal,0) ELSE 0 END), 0) AS dibayar
         FROM Project p
         LEFT JOIN Termin t ON t.projectId = p.id
         WHERE p.entityId IN ($id_ph)
           AND p.status = 'ACTIVE'
           AND p.deadline IS NOT NULL AND p.deadline < ?
         GROUP BY p.id, p.code, p.name, p.entityId, p.contractValue, p.deadline"
    );
    $stmt->execute(array_merge($entity_ids, [$today]));
    $overdue_rows = $stmt->fetchAll();

    $overdue_projects = [];
    $total_piutang    = 0;

    foreach ($overdue_rows as $row) {
        $ent          = $entities_map[$row['entityId']] ?? ['key' => '', 'name' => ''];
        $contract     = (float)$row['contractValue'];
        $dibayar      = (float)$row['dibayar'];
        $sisa         = max(0, $contract - $dibayar);
        $pct          = (float)$row['pct_dibayar'];
        $days_overdue = (int)round((strtotime($today) - strtotime($row['deadline'])) / 86400);

        $total_piutang += $sisa;
        $overdue_projects[] = [
            'id'             => $row['id'],
            'code'           => $row['code'],
            'name'           => $row['name'],
            'entityKey'      => $ent['key'],
            'entityName'     => $ent['name'],
            'contractValue'  => $contract,
            'contractValueFmt'=> 'Rp ' . number_format($contract, 0, ',', '.'),
            'deadline'       => $row['deadline'],
            'deadlineFmt'    => date('d/m/Y', strtotime($row['deadline'])),
            'daysOverdue'    => $days_overdue,
            'maxPercentage'  => $pct,
            'terminTagih'    => $sisa,
            'terminTagihFmt' => 'Rp ' . number_format($sisa, 0, ',', '.'),
            'sisaPiutang'    => $sisa,
            'sisaPiutangFmt' => 'Rp ' . number_format($sisa, 0, ',', '.'),
        ];
    }

    // terminPerluPerhatian = proyek aktif yang punya termin belum lunas dan deadline sudah lewat
    $stmt2 = $pdo->prepare(
        "SELECT COUNT(DISTINCT p.id) AS cnt
         FROM Project p
         JOIN Termin t ON t.projectId = p.id
         WHERE p.entityId IN ($id_ph)
           AND p.status = 'ACTIVE'
           AND t.status NOT IN ('LUNAS','DITERIMA')
           AND p.deadline IS NOT NULL AND p.deadline < ?"
    );
    $stmt2->execute(array_merge($entity_ids, [$today]));
    $termin_perlu_perhatian = (int)$stmt2->fetchColumn();

    json_response([
        'terminPerluPerhatian'      => $termin_perlu_perhatian,
        'totalPiutangBelumTertagih' => $total_piutang,
        'overdueProjects'           => $overdue_projects,
    ]);
}

// ─── POST /api/piutang/pelunasan ─────────────────────────────────────────────
if ($method === 'POST' && $sub_action === 'pelunasan') {
    $required = ['currentEntityKey','balanceType','counterpartyEntityKey','tanggal','noBukti','keterangan','nominal','jenisKasSumber'];
    foreach ($required as $field) {
        if (empty($body[$field])) error_response("Field '$field' diperlukan.", 400);
    }

    $nominal = (float)$body['nominal'];
    if ($nominal <= 0) error_response('Nominal harus lebih dari 0.', 400);

    $current_entity      = resolve_entity_by_key($body['currentEntityKey']);
    $counterparty_entity = resolve_entity_by_key($body['counterpartyEntityKey']);
    if (!$current_entity)      error_response('Entitas sumber tidak ditemukan.', 404);
    if (!$counterparty_entity) error_response('Entitas rekanan tidak ditemukan.', 404);

    $pdo          = get_pdo();
    $tanggal      = $body['tanggal'];
    $no_bukti     = $body['noBukti'];
    $keterangan   = $body['keterangan'];
    $balance_type = $body['balanceType']; // 'piutang' | 'hutang'

    // Cek duplikat noBukti sebelum membuka transaksi DB
    $dup = $pdo->prepare('SELECT 1 FROM `Transaction` WHERE entityId = ? AND noBukti = ? LIMIT 1');
    $dup->execute([$current_entity['id'], $no_bukti]);
    if ($dup->fetch()) error_response("No. bukti \"$no_bukti\" sudah dipakai di entitas ini.", 409);

    $stmt = $pdo->prepare('SELECT id FROM JenisInputTransaksi WHERE `key` = ? LIMIT 1');
    $stmt->execute([$body['jenisKasSumber']]);
    $jenis_sumber = $stmt->fetch();
    if (!$jenis_sumber) error_response('Jenis kas sumber tidak ditemukan.', 404);

    $jenis_tujuan_key = $body['jenisKasTujuan'] ?? $body['jenisKasSumber'];
    $stmt = $pdo->prepare('SELECT id FROM JenisInputTransaksi WHERE `key` = ? LIMIT 1');
    $stmt->execute([$jenis_tujuan_key]);
    $jenis_tujuan = $stmt->fetch();
    if (!$jenis_tujuan) error_response('Jenis kas tujuan tidak ditemukan.', 404);

    // Peta COA piutang/hutang antar entitas — kunci sesuai key DB (exact case).
    // Urutan: kencana→111/311, gaharu→112/312 mengikuti nama COA di seed
    // (111=PIUTANG KAK/kencana, 112=PIUTANG GS/gaharu).
    // Sebelumnya tertukar (Bug A) dan ciptaAsri tidak pernah cocok karena
    // strtolower (Bug B) — keduanya dikoreksi di sini; data historis tidak diubah.
    $entity_code_map = [
        'kencana'   => ['piutang' => '111', 'hutang' => '311'],
        'gaharu'    => ['piutang' => '112', 'hutang' => '312'],
        'tataring'  => ['piutang' => '113', 'hutang' => '313'],
        'ciptaAsri' => ['piutang' => '114', 'hutang' => '314'],
        'umum'      => ['piutang' => '115', 'hutang' => '315'],
    ];
    // Gunakan key DB langsung (tanpa strtolower) agar ciptaAsri cocok.
    $cok = $current_entity['key'];
    $cpk = $counterparty_entity['key'];

    // Peta COA kas hardcoded (sesuai seed/database).
    $kas_kecil_map = [
        'gaharu' => '1200', 'kencana' => '1100', 'tataring' => '1300',
        'ciptaAsri' => '1400', 'umum' => '1500',
    ];
    $kas_besar_map = [
        'gaharu' => '120', 'kencana' => '110', 'tataring' => '130',
        'ciptaAsri' => '140', 'umum' => '150',
    ];

    function cari_coa(string $code): ?array {
        $stmt = get_pdo()->prepare('SELECT id, code, name, kategori FROM CoaAccount WHERE code = ? LIMIT 1');
        $stmt->execute([$code]);
        return $stmt->fetch() ?: null;
    }

    function last_saldo(string $entity_id, string $coa_id): float {
        $stmt = get_pdo()->prepare(
            'SELECT saldoSetelah FROM `Transaction`
             WHERE entityId = ? AND coaAccountId = ?
             ORDER BY tanggal DESC, createdAt DESC LIMIT 1'
        );
        $stmt->execute([$entity_id, $coa_id]);
        $row = $stmt->fetch();
        return $row ? (float)$row['saldoSetelah'] : 0.0;
    }

    // Pre-resolve semua 6 COA sebelum beginTransaction.
    // Kegagalan di sini mengembalikan 422 sebelum DB transaction dibuka —
    // tidak ada data setengah jadi.
    $kas_src_code = match($body['jenisKasSumber']) {
        'kasKecil' => $kas_kecil_map[$cok] ?? null,
        'kasBesar' => $kas_besar_map[$cok] ?? null,
        default    => null,
    };
    $kas_dst_code = match($jenis_tujuan_key) {
        'kasKecil' => $kas_kecil_map[$cpk] ?? null,
        'kasBesar' => $kas_besar_map[$cpk] ?? null,
        default    => null,
    };
    if (!$kas_src_code) error_response("COA kas sumber tidak ditemukan untuk entitas ini.", 422);
    if (!$kas_dst_code) error_response("COA kas tujuan tidak ditemukan untuk entitas ini.", 422);

    $cp_piutang_code = $entity_code_map[$cpk]['piutang'] ?? null;
    $cp_hutang_code  = $entity_code_map[$cpk]['hutang']  ?? null;
    $cu_piutang_code = $entity_code_map[$cok]['piutang'] ?? null;
    $cu_hutang_code  = $entity_code_map[$cok]['hutang']  ?? null;
    if (!$cp_piutang_code) error_response("COA piutang/hutang counterparty tidak ditemukan.", 422);
    if (!$cu_piutang_code) error_response("COA piutang/hutang current tidak ditemukan.", 422);

    $coa_kas_current      = cari_coa($kas_src_code);
    $coa_kas_counterparty = cari_coa($kas_dst_code);
    $coa_piutang_current  = cari_coa($cp_piutang_code);
    $coa_hutang_current   = cari_coa($cp_hutang_code);
    $coa_piutang_counter  = cari_coa($cu_piutang_code);
    $coa_hutang_counter   = cari_coa($cu_hutang_code);

    if (!$coa_kas_current)      error_response("COA kas sumber '$kas_src_code' tidak ada di database.", 422);
    if (!$coa_kas_counterparty) error_response("COA kas tujuan '$kas_dst_code' tidak ada di database.", 422);
    if (!$coa_piutang_current)  error_response("COA piutang '$cp_piutang_code' tidak ada di database.", 422);
    if (!$coa_hutang_current)   error_response("COA hutang '$cp_hutang_code' tidak ada di database.", 422);
    if (!$coa_piutang_counter)  error_response("COA piutang '$cu_piutang_code' tidak ada di database.", 422);
    if (!$coa_hutang_counter)   error_response("COA hutang '$cu_hutang_code' tidak ada di database.", 422);

    $pdo->beginTransaction();
    try {
        $now = date('Y-m-d H:i:s');
        $ins = $pdo->prepare(
            'INSERT INTO `Transaction`
             (id, entityId, jenisInputId, tanggal, noBukti, keterangan, coaAccountId, debit, kredit, saldoSetelah, staffId, createdAt)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        );

        if ($balance_type === 'piutang') {
            // Current entity: Cr. piutang (berkurang), Dr. kas (masuk)
            $s1 = last_saldo($current_entity['id'], $coa_piutang_current['id']);
            $ins->execute([uuid4(), $current_entity['id'], $jenis_sumber['id'], $tanggal, $no_bukti,
                $keterangan, $coa_piutang_current['id'], 0, $nominal, $s1 - $nominal, $user['id'], $now]);

            $s2 = last_saldo($current_entity['id'], $coa_kas_current['id']);
            $ins->execute([uuid4(), $current_entity['id'], $jenis_sumber['id'], $tanggal, $no_bukti,
                $keterangan, $coa_kas_current['id'], $nominal, 0, $s2 + $nominal, $user['id'], $now]);

            // Counterparty: Dr. hutang (berkurang), Cr. kas (keluar)
            $s3 = last_saldo($counterparty_entity['id'], $coa_hutang_counter['id']);
            $ins->execute([uuid4(), $counterparty_entity['id'], $jenis_tujuan['id'], $tanggal, $no_bukti,
                $keterangan, $coa_hutang_counter['id'], $nominal, 0, $s3 - $nominal, $user['id'], $now]);

            $s4 = last_saldo($counterparty_entity['id'], $coa_kas_counterparty['id']);
            $ins->execute([uuid4(), $counterparty_entity['id'], $jenis_tujuan['id'], $tanggal, $no_bukti,
                $keterangan, $coa_kas_counterparty['id'], 0, $nominal, $s4 - $nominal, $user['id'], $now]);
        } else {
            // Current entity: Dr. hutang (berkurang), Cr. kas (keluar)
            $s1 = last_saldo($current_entity['id'], $coa_hutang_current['id']);
            $ins->execute([uuid4(), $current_entity['id'], $jenis_sumber['id'], $tanggal, $no_bukti,
                $keterangan, $coa_hutang_current['id'], $nominal, 0, $s1 - $nominal, $user['id'], $now]);

            $s2 = last_saldo($current_entity['id'], $coa_kas_current['id']);
            $ins->execute([uuid4(), $current_entity['id'], $jenis_sumber['id'], $tanggal, $no_bukti,
                $keterangan, $coa_kas_current['id'], 0, $nominal, $s2 - $nominal, $user['id'], $now]);

            // Counterparty: Cr. piutang (berkurang), Dr. kas (masuk)
            $s3 = last_saldo($counterparty_entity['id'], $coa_piutang_counter['id']);
            $ins->execute([uuid4(), $counterparty_entity['id'], $jenis_tujuan['id'], $tanggal, $no_bukti,
                $keterangan, $coa_piutang_counter['id'], 0, $nominal, $s3 - $nominal, $user['id'], $now]);

            $s4 = last_saldo($counterparty_entity['id'], $coa_kas_counterparty['id']);
            $ins->execute([uuid4(), $counterparty_entity['id'], $jenis_tujuan['id'], $tanggal, $no_bukti,
                $keterangan, $coa_kas_counterparty['id'], $nominal, 0, $s4 + $nominal, $user['id'], $now]);
        }

        $pdo->commit();

        log_activity($user['id'], 'piutang.pelunasan', 'FINANCIAL_CHANGE', [
            'currentEntityKey'      => $body['currentEntityKey'],
            'counterpartyEntityKey' => $body['counterpartyEntityKey'],
            'balanceType'           => $balance_type,
            'nominal'               => $nominal,
            'noBukti'               => $no_bukti,
        ]);

        json_response(['message' => 'Pelunasan berhasil dicatat.'], 201);
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

// ─── POST /api/piutang/termin/audit ──────────────────────────────────────────
if ($method === 'POST' && $sub_action === 'termin' && $sub_sub === 'audit') {
    $termin_id = $body['terminId'] ?? null;
    if (!$termin_id) error_response('terminId diperlukan.', 400);

    $pdo  = get_pdo();
    $stmt = $pdo->prepare('SELECT id FROM Termin WHERE id = ?');
    $stmt->execute([$termin_id]);
    if (!$stmt->fetch()) error_response('Termin tidak ditemukan.', 404);

    $pdo->prepare(
        'UPDATE Termin SET status = \'ON_TRACK\', auditedAt = NOW(), auditedById = ? WHERE id = ?'
    )->execute([$user['id'], $termin_id]);

    // Sync progress ke Sidamon
    $stmt = $pdo->prepare('SELECT projectId FROM Termin WHERE id = ? LIMIT 1');
    $stmt->execute([$termin_id]);
    $t = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($t) sync_termin_to_sidamon($t['projectId']);

    log_activity($user['id'], 'termin.audit', 'FINANCIAL_CHANGE', ['terminId' => $termin_id]);

    json_response(['message' => 'Termin berhasil diaudit.']);
}

// ─── PATCH /api/piutang/termin/status ────────────────────────────────────────
if ($method === 'PATCH' && $sub_action === 'termin' && $sub_sub === 'status') {
    $termin_id = $body['terminId'] ?? null;
    $status    = $body['status']   ?? null;
    if (!$termin_id) error_response('terminId diperlukan.', 400);
    if (!$status)    error_response('status diperlukan.', 400);

    $allowed = ['ON_TRACK', 'AT_RISK', 'NEEDS_AUDIT'];
    if (!in_array($status, $allowed)) error_response('Status tidak valid.', 400);

    $pdo  = get_pdo();
    $stmt = $pdo->prepare('SELECT id FROM Termin WHERE id = ?');
    $stmt->execute([$termin_id]);
    if (!$stmt->fetch()) error_response('Termin tidak ditemukan.', 404);

    $pdo->prepare('UPDATE Termin SET status = ? WHERE id = ?')->execute([$status, $termin_id]);

    // Sync progress ke Sidamon
    $stmt = $pdo->prepare('SELECT projectId FROM Termin WHERE id = ? LIMIT 1');
    $stmt->execute([$termin_id]);
    $t = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($t) sync_termin_to_sidamon($t['projectId']);

    log_activity($user['id'], 'termin.update_status', 'FINANCIAL_CHANGE', [
        'terminId' => $termin_id,
        'status'   => $status,
    ]);

    json_response(['message' => 'Status termin diperbarui.']);
}

// ─── POST /api/piutang/proyek/complete ───────────────────────────────────────
if ($method === 'POST' && $sub_action === 'proyek' && $sub_sub === 'complete') {
    $project_id = $body['projectId'] ?? null;
    if (!$project_id) error_response('projectId diperlukan.', 400);

    $pdo  = get_pdo();
    $stmt = $pdo->prepare('SELECT id FROM Project WHERE id = ?');
    $stmt->execute([$project_id]);
    if (!$stmt->fetch()) error_response('Proyek tidak ditemukan.', 404);

    $pdo->prepare('UPDATE Project SET status = \'COMPLETED\' WHERE id = ?')->execute([$project_id]);

    log_activity($user['id'], 'proyek.complete', 'FINANCIAL_CHANGE', ['projectId' => $project_id]);

    json_response(['message' => 'Proyek ditandai selesai.']);
}

// ─── POST /api/piutang/proyek/cancel ─────────────────────────────────────────
if ($method === 'POST' && $sub_action === 'proyek' && $sub_sub === 'cancel') {
    $project_id = $body['projectId'] ?? null;
    if (!$project_id) error_response('projectId diperlukan.', 400);

    $pdo  = get_pdo();
    $stmt = $pdo->prepare('SELECT id FROM Project WHERE id = ?');
    $stmt->execute([$project_id]);
    if (!$stmt->fetch()) error_response('Proyek tidak ditemukan.', 404);

    $pdo->beginTransaction();
    try {
        $pdo->prepare('DELETE FROM Termin WHERE projectId = ?')->execute([$project_id]);
        $pdo->prepare('UPDATE Project SET status = \'CANCELLED\' WHERE id = ?')->execute([$project_id]);
        $pdo->commit();

        log_activity($user['id'], 'proyek.cancel', 'FINANCIAL_CHANGE', ['projectId' => $project_id]);

        json_response(['message' => 'Proyek dibatalkan dan semua termin dihapus.']);
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

// ─── POST /api/piutang/proyek/reopen ─────────────────────────────────────────
if ($method === 'POST' && $sub_action === 'proyek' && $sub_sub === 'reopen') {
    $project_id = $body['projectId'] ?? null;
    if (!$project_id) error_response('projectId diperlukan.', 400);

    $pdo  = get_pdo();
    $stmt = $pdo->prepare('SELECT id FROM Project WHERE id = ?');
    $stmt->execute([$project_id]);
    if (!$stmt->fetch()) error_response('Proyek tidak ditemukan.', 404);

    $pdo->prepare('UPDATE Project SET status = \'ACTIVE\' WHERE id = ?')->execute([$project_id]);

    log_activity($user['id'], 'proyek.reopen', 'FINANCIAL_CHANGE', ['projectId' => $project_id]);

    json_response(['message' => 'Proyek dibuka kembali.']);
}

error_response('Endpoint tidak ditemukan.', 404);
