<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

// ── Validasi internal secret ──────────────────────────────────────────────────
$incoming_secret = $_SERVER['HTTP_X_INTERNAL_SECRET'] ?? '';
if ($incoming_secret !== INTERNAL_SECRET) {
    error_response('Unauthorized', 401);
}

$sub  = $segments[1] ?? '';
$sub2 = $segments[2] ?? '';

$pdo = get_pdo();

// ─── POST /api/sync/assignment — terima penugasan baru/update dari Sidamon ───
if ($method === 'POST' && $sub === 'assignment') {
    $assignment_id  = trim($body['assignmentId'] ?? '');
    $job_name       = trim($body['jobName'] ?? '');
    $client_name    = trim($body['clientName'] ?? '');
    $entitas        = trim($body['entitas'] ?? '');
    $contract_value = (float)($body['contractValue'] ?? 0);
    $start_date     = trim($body['startDate'] ?? '');
    $end_date       = trim($body['endDate'] ?? '');
    $project_type   = trim($body['projectType'] ?? '');

    if (!$assignment_id || !$job_name || !$entitas) {
        error_response('assignmentId, jobName, dan entitas wajib diisi.', 400);
    }

    // Map entitas Sidamon → entity key Simatra
    $entitas_map = [
        'Gaharu'    => 'gaharu',
        'Kencana'   => 'kencana',
        'Tataring'  => 'tataring',
        'Cipta Asri'=> 'ciptaAsri',
        'Umum'      => 'umum',
    ];
    $entity_key = $entitas_map[$entitas] ?? strtolower($entitas);

    $stmt = $pdo->prepare("SELECT id, `key` FROM Entity WHERE `key` = ? LIMIT 1");
    $stmt->execute([$entity_key]);
    $entity = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$entity) {
        error_response("Entitas '$entitas' tidak ditemukan di Simatra.", 422);
    }
    $entity_id = $entity['id'];

    // Cek apakah assignment ini sudah punya project di Simatra
    $stmt = $pdo->prepare("SELECT id, code FROM Project WHERE sidamon_assignment_id = ? LIMIT 1");
    $stmt->execute([$assignment_id]);
    $existing = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($existing) {
        // Update project yang sudah ada
        $pdo->prepare(
            "UPDATE Project SET
                name = ?, contractValue = ?, deadline = ?,
                sidamon_client_name = ?, sidamon_job_name = ?,
                sidamon_start_date = ?, sidamon_end_date = ?
             WHERE id = ?"
        )->execute([
            $job_name, $contract_value,
            $end_date ?: null,
            $client_name, $job_name,
            $start_date ?: null, $end_date ?: null,
            $existing['id'],
        ]);

        json_response([
            'success'   => true,
            'action'    => 'updated',
            'projectId' => $existing['id'],
            'code'      => $existing['code'],
        ]);
    }

    // Generate kode proyek: prefix entitas + jenis + nomor urut
    $prefix_map = [
        'gaharu'    => 'GHR',
        'kencana'   => 'KNC',
        'tataring'  => 'TTR',
        'ciptaAsri' => 'CPA',
        'umum'      => 'UMM',
    ];
    $type_prefix = ($project_type === 'Pengawasan') ? 'PWS' : 'PRN';
    $prefix      = ($prefix_map[$entity_key] ?? 'PRJ') . '-' . $type_prefix;

    // Cari nomor urut berikutnya untuk prefix ini
    $stmt = $pdo->prepare(
        "SELECT code FROM Project WHERE entityId = ? AND code LIKE ? ORDER BY createdAt DESC LIMIT 1"
    );
    $stmt->execute([$entity_id, $prefix . '-%']);
    $last = $stmt->fetchColumn();
    if ($last) {
        $last_num = (int)substr($last, strrpos($last, '-') + 1);
        $next_num = $last_num + 1;
    } else {
        $next_num = 1;
    }
    $code = $prefix . '-' . str_pad($next_num, 3, '0', STR_PAD_LEFT);

    // Buat project baru
    $project_id = uuid4();
    $now        = date('Y-m-d H:i:s');
    $pdo->prepare(
        "INSERT INTO Project
            (id, code, name, contractValue, spend, deadline, status, entityId,
             sidamon_assignment_id, sidamon_client_name, sidamon_job_name,
             sidamon_start_date, sidamon_end_date, createdAt)
         VALUES (?, ?, ?, ?, 0, ?, 'ACTIVE', ?, ?, ?, ?, ?, ?, ?)"
    )->execute([
        $project_id, $code, $job_name, $contract_value,
        $end_date ?: null,
        $entity_id,
        $assignment_id, $client_name, $job_name,
        $start_date ?: null, $end_date ?: null,
        $now,
    ]);

    log_activity(
        'system',
        "Sync Sidamon: Project '$code' dibuat dari penugasan '$job_name'",
        'FINANCIAL_CHANGE',
        ['projectId' => $project_id, 'assignmentId' => $assignment_id]
    );

    // Kirim notifikasi ke Manajer Keuangan dan Staf Keuangan
    $notif_text = "Penugasan baru dari Sidamon: [$code] $job_name" . ($client_name ? " — $client_name" : '');
    $notif_roles = ['MANAJER_KEUANGAN', 'STAF_KEUANGAN'];
    foreach ($notif_roles as $role) {
        $pdo->prepare(
            "INSERT INTO Notifikasi (id, type, targetRole, text, `read`, createdAt)
             VALUES (?, 'PENUGASAN_BARU', ?, ?, 0, NOW())"
        )->execute([uuid4(), $role, $notif_text]);
    }

    // Sync-back ke Sidamon: reset termin lama, set persenTerbayar = 0
    $cb_payload = json_encode([
        'projectId'      => $project_id,
        'projectCode'    => $code,
        'persenTerbayar' => 0,
        'termins'        => [],
    ]);
    $ch = curl_init(SIDAMON_URL . '/api/sync/termin/' . urlencode($assignment_id));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => 'PUT',
        CURLOPT_POSTFIELDS     => $cb_payload,
        CURLOPT_TIMEOUT        => 5,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'X-Internal-Secret: ' . INTERNAL_SECRET,
        ],
    ]);
    curl_exec($ch);
    curl_close($ch);

    json_response([
        'success'   => true,
        'action'    => 'created',
        'projectId' => $project_id,
        'code'      => $code,
    ]);
}

// ─── GET /api/sync/project?assignmentId=... — cek status project ─────────────
elseif ($method === 'GET' && $sub === 'project') {
    $assignment_id = trim($_GET['assignmentId'] ?? '');
    if (!$assignment_id) error_response('assignmentId wajib.', 400);

    $stmt = $pdo->prepare(
        "SELECT p.id, p.code, p.name, p.contractValue, p.status,
                p.deadline, p.sidamon_start_date, p.sidamon_end_date,
                COALESCE(SUM(t.nominal), 0) AS total_termin_dibayar,
                COUNT(t.id) AS jumlah_termin
         FROM Project p
         LEFT JOIN Termin t ON t.projectId = p.id
         WHERE p.sidamon_assignment_id = ?
         GROUP BY p.id"
    );
    $stmt->execute([$assignment_id]);
    $project = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$project) {
        json_response(['synced' => false, 'project' => null]);
    }

    $contract_val      = (float)$project['contractValue'];
    $total_dibayar     = (float)$project['total_termin_dibayar'];
    $persen_terbayar   = $contract_val > 0
        ? round(($total_dibayar / $contract_val) * 100, 1)
        : 0;

    // Ambil detail per termin
    $stmt = $pdo->prepare(
        "SELECT id, name, percentage, nominal, status, createdAt
         FROM Termin WHERE projectId = ? ORDER BY createdAt ASC"
    );
    $stmt->execute([$project['id']]);
    $termins = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $termins_formatted = array_map(fn($t) => [
        'id'         => $t['id'],
        'label'      => $t['name'],
        'percentage' => (float)$t['percentage'],
        'nominal'    => (float)$t['nominal'],
        'status'     => $t['status'],
        'date'       => $t['createdAt'],
    ], $termins);

    json_response([
        'synced'           => true,
        'project'          => [
            'id'                => $project['id'],
            'code'              => $project['code'],
            'name'              => $project['name'],
            'contractValue'     => $contract_val,
            'status'            => $project['status'],
            'deadline'          => $project['deadline'],
            'persenTerbayar'    => $persen_terbayar,
            'totalTerminDibayar'=> $total_dibayar,
            'jumlahTermin'      => (int)$project['jumlah_termin'],
            'termins'           => $termins_formatted,
        ],
    ]);
}

else {
    error_response('Endpoint sync tidak ditemukan.', 404);
}
