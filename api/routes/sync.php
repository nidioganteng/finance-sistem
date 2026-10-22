<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');
require_once __DIR__ . '/../helpers/tenaga-ahli-gaji.php';

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

    // Map entitas Sidamon → entity key Kosha
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
        error_response("Entitas '$entitas' tidak ditemukan di Kosha.", 422);
    }
    $entity_id = $entity['id'];

    // Cek apakah assignment ini sudah punya project di Kosha
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

        try {
            $notif_text  = "Penugasan diperbarui dari Sidamon: [{$existing['code']}] $job_name" . ($client_name ? " — $client_name" : '');
            $notif_roles = ['MANAJER_KEUANGAN', 'STAF_KEUANGAN'];
            foreach ($notif_roles as $role) {
                $pdo->prepare(
                    "INSERT INTO Notifikasi (id, type, targetRole, text, `read`, createdAt)
                     VALUES (?, 'PENUGASAN_BARU', ?, ?, 0, NOW())"
                )->execute([uuid4(), $role, $notif_text]);
            }
        } catch (Throwable $e) {
            error_log('Sync notif gagal (update): ' . $e->getMessage());
        }

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
    try {
        $notif_text  = "Penugasan baru dari Sidamon: [$code] $job_name" . ($client_name ? " — $client_name" : '');
        $notif_roles = ['MANAJER_KEUANGAN', 'STAF_KEUANGAN'];
        foreach ($notif_roles as $role) {
            $pdo->prepare(
                "INSERT INTO Notifikasi (id, type, targetRole, text, `read`, createdAt)
                 VALUES (?, 'PENUGASAN_BARU', ?, ?, 0, NOW())"
            )->execute([uuid4(), $role, $notif_text]);
        }
    } catch (Throwable $e) {
        error_log('Sync notif gagal (create): ' . $e->getMessage());
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
    $cb_response  = curl_exec($ch);
    $cb_errno     = curl_errno($ch);
    $cb_http_code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $sync_back_ok = ($cb_errno === 0 && $cb_http_code >= 200 && $cb_http_code < 300);
    if (!$sync_back_ok) {
        $sync_err = $cb_errno !== 0
            ? 'curl error ' . $cb_errno . ': ' . curl_strerror($cb_errno)
            : "HTTP $cb_http_code dari Sidamon";
        log_activity('system', "Sync-back ke Sidamon GAGAL untuk project $code: $sync_err",
            'USER_ACTIVITY', ['projectId' => $project_id, 'assignmentId' => $assignment_id]);
    }

    json_response([
        'success'   => true,
        'action'    => 'created',
        'projectId' => $project_id,
        'code'      => $code,
        'syncBack'  => [
            'success' => $sync_back_ok,
            'error'   => $sync_back_ok ? null : $sync_err,
        ],
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

// ─── POST /api/sync/pegawai — sync master pegawai tetap dari Sistem HR ────────
elseif ($method === 'POST' && $sub === 'pegawai') {
    $items = isset($body['items']) && is_array($body['items']) ? $body['items'] : [$body];
    if (empty($items)) {
        error_response('Data pegawai tidak boleh kosong.', 400);
    }

    $entitas_map = [
        'Gaharu'    => 'gaharu',
        'Kencana'   => 'kencana',
        'Tataring'  => 'tataring',
        'Cipta Asri'=> 'ciptaAsri',
        'Umum'      => 'umum',
    ];

    $ptkp_map = [
        'TK/0' => 54000000, 'TK/1' => 58500000, 'TK/2' => 63000000, 'TK/3' => 67500000,
        'K/0'  => 58500000, 'K/1'  => 63000000, 'K/2'  => 67500000, 'K/3'  => 72000000,
        'K/I/0'=> 112500000, 'K/I/1'=> 117000000, 'K/I/2'=> 121500000, 'K/I/3'=> 126000000,
    ];

    $results = [];
    $now = date('Y-m-d H:i:s');

    foreach ($items as $item) {
        $nik = trim($item['nik'] ?? '');
        $nama = trim($item['nama'] ?? '');
        $entitas_input = trim($item['entitas'] ?? ($body['entitas'] ?? ''));

        if (!$nik || !$nama || !$entitas_input) {
            $results[] = [
                'nik' => $nik,
                'nama' => $nama,
                'status' => 'error',
                'message' => 'nik, nama, dan entitas wajib diisi.',
            ];
            continue;
        }

        $entity_key = $entitas_map[$entitas_input] ?? strtolower($entitas_input);
        $stmt = $pdo->prepare("SELECT id FROM Entity WHERE `key` = ? LIMIT 1");
        $stmt->execute([$entity_key]);
        $entity_id = $stmt->fetchColumn();
        if (!$entity_id) {
            $results[] = [
                'nik' => $nik,
                'nama' => $nama,
                'status' => 'error',
                'message' => "Entitas '$entitas_input' tidak ditemukan di Kosha.",
            ];
            continue;
        }

        $jabatan = trim($item['jabatan'] ?? 'Staf');
        $status_kel = strtoupper(trim($item['statusKeluarga'] ?? ($item['ptkpStatus'] ?? 'TK/0')));
        $ptkp = $ptkp_map[$status_kel] ?? 54000000;
        $gaji_pokok = (float)($item['gajiPokok'] ?? 0);
        $tunjangan_jabatan = (float)($item['tunjanganJabatan'] ?? 0);
        $tarif_transport = (float)($item['tarifTransportHarian'] ?? 15000);
        if ($tarif_transport <= 0) $tarif_transport = 15000;
        $tanggal_masuk = !empty($item['tanggalMasuk']) ? trim($item['tanggalMasuk']) : null;
        $tanggal_resign = !empty($item['tanggalResign']) ? trim($item['tanggalResign']) : null;
        $status = strtoupper(trim($item['status'] ?? 'AKTIF'));
        if (!in_array($status, ['AKTIF', 'RESIGN', 'PENSIUN'])) $status = 'AKTIF';
        $is_active = ($status === 'AKTIF') ? 1 : 0;

        $tunj_bpjs_kes = (float)($item['tunjanganBpjsKes'] ?? 0);
        $tunj_bpjs_tk  = (float)($item['tunjanganBpjsTk'] ?? 0);
        $bpjs_kes      = (float)($item['bpjsKesehatan'] ?? 0);
        $bpjs_tk       = (float)($item['bpjsKetenagakerjaan'] ?? 0);
        $potongan_bpjs = isset($item['potonganBpjs']) ? (float)$item['potonganBpjs'] : ($bpjs_kes + $bpjs_tk);

        // Cek apakah pegawai sudah ada berdasarkan entityId & nik
        $stmt = $pdo->prepare("SELECT id FROM Pegawai WHERE entityId = ? AND nik = ? LIMIT 1");
        $stmt->execute([$entity_id, $nik]);
        $existing_id = $stmt->fetchColumn();

        if ($existing_id) {
            $pdo->prepare(
                "UPDATE Pegawai SET
                    nama = ?, jabatan = ?, statusKeluarga = ?, ptkp = ?,
                    gajiPokok = ?, tunjanganJabatan = ?, tarifTransportHarian = ?,
                    tunjanganBpjsKes = ?, tunjanganBpjsTk = ?, bpjsKesehatan = ?,
                    bpjsKetenagakerjaan = ?, potonganBpjs = ?,
                    isActive = ?, status = ?, tanggalResign = ?, tanggalMasuk = ?,
                    updatedAt = ?
                 WHERE id = ?"
            )->execute([
                $nama, $jabatan, $status_kel, $ptkp,
                $gaji_pokok, $tunjangan_jabatan, $tarif_transport,
                $tunj_bpjs_kes, $tunj_bpjs_tk, $bpjs_kes,
                $bpjs_tk, $potongan_bpjs,
                $is_active, $status, $tanggal_resign, $tanggal_masuk,
                $now, $existing_id
            ]);

            $results[] = [
                'nik' => $nik,
                'nama' => $nama,
                'action' => 'updated',
                'pegawaiId' => $existing_id,
            ];
        } else {
            $new_id = uuid4();
            $pdo->prepare(
                "INSERT INTO Pegawai
                    (id, entityId, nik, nama, jabatan, statusKeluarga, ptkp, gajiPokok,
                     tunjanganJabatan, tarifTransportHarian, tunjanganBpjsKes, tunjanganBpjsTk,
                     bpjsKesehatan, bpjsKetenagakerjaan, potonganBpjs, isActive, status,
                     tanggalResign, tanggalMasuk, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            )->execute([
                $new_id, $entity_id, $nik, $nama, $jabatan, $status_kel, $ptkp, $gaji_pokok,
                $tunjangan_jabatan, $tarif_transport, $tunj_bpjs_kes, $tunj_bpjs_tk,
                $bpjs_kes, $bpjs_tk, $potongan_bpjs, $is_active, $status,
                $tanggal_resign, $tanggal_masuk, $now, $now
            ]);

            $results[] = [
                'nik' => $nik,
                'nama' => $nama,
                'action' => 'created',
                'pegawaiId' => $new_id,
            ];
        }
    }

    log_activity('system', "Sync Pegawai Tetap dari Sistem HR: " . count($results) . " data diproses", 'USER_ACTIVITY', [
        'count' => count($results),
    ]);

    json_response([
        'success' => true,
        'syncedCount' => count($results),
        'results' => $results,
    ]);
}

// ─── POST /api/sync/tenaga-ahli — sync tenaga ahli / freelance dari Sidamon ───
elseif ($method === 'POST' && $sub === 'tenaga-ahli') {
    ensure_tenaga_ahli_gaji_table($pdo);
    $items = isset($body['items']) && is_array($body['items']) ? $body['items'] : [$body];
    if (empty($items)) {
        error_response('Data tenaga ahli tidak boleh kosong.', 400);
    }

    $entitas_map = [
        'Gaharu'    => 'gaharu',
        'Kencana'   => 'kencana',
        'Tataring'  => 'tataring',
        'Cipta Asri'=> 'ciptaAsri',
        'Umum'      => 'umum',
    ];

    $results = [];
    $now = date('Y-m-d H:i:s');

    foreach ($items as $item) {
        $nama = trim($item['nama'] ?? '');
        $nik = preg_replace('/[^0-9]/', '', (string)($item['nik'] ?? ''));
        $entitas_input = trim($item['entitas'] ?? ($body['entitas'] ?? ''));

        if (!$nama || !$nik || !$entitas_input) {
            $results[] = [
                'nik' => $nik,
                'nama' => $nama,
                'status' => 'error',
                'message' => 'nama, nik, dan entitas wajib diisi.',
            ];
            continue;
        }

        $entity_key = $entitas_map[$entitas_input] ?? strtolower($entitas_input);
        $stmt = $pdo->prepare("SELECT id FROM Entity WHERE `key` = ? LIMIT 1");
        $stmt->execute([$entity_key]);
        $entity_id = $stmt->fetchColumn();
        if (!$entity_id) {
            $results[] = [
                'nik' => $nik,
                'nama' => $nama,
                'status' => 'error',
                'message' => "Entitas '$entitas_input' tidak ditemukan di Kosha.",
            ];
            continue;
        }

        // Resolusi project ID jika ada assignmentId atau projectCode dari Sidamon
        $project_id = null;
        $assignment_id = trim($item['assignmentId'] ?? '');
        $project_code = trim($item['projectCode'] ?? '');

        if ($assignment_id) {
            $stmt = $pdo->prepare("SELECT id FROM Project WHERE sidamon_assignment_id = ? LIMIT 1");
            $stmt->execute([$assignment_id]);
            $project_id = $stmt->fetchColumn() ?: null;
        }
        if (!$project_id && $project_code) {
            $stmt = $pdo->prepare("SELECT id FROM Project WHERE code = ? LIMIT 1");
            $stmt->execute([$project_code]);
            $project_id = $stmt->fetchColumn() ?: null;
        }

        $npwp = trim($item['npwp'] ?? '');
        $kategori = trim($item['kategori'] ?? ($item['spesialisasi'] ?? 'Tenaga Ahli'));
        $ptkp = strtoupper(trim($item['ptkp'] ?? 'TK/0'));
        $start_date = !empty($item['tanggalMulaiTugas']) ? trim($item['tanggalMulaiTugas']) : null;
        $end_date = !empty($item['tanggalSelesaiTugas']) ? trim($item['tanggalSelesaiTugas']) : null;
        $is_turun = isset($item['isTurunLapangan'])
            ? (in_array($item['isTurunLapangan'], [1, '1', true, 'true', 'riil', 'RIIL'], true) ? 1 : 0)
            : 1;
        $nominal_honor = (float)($item['nominalHonorBulanan'] ?? 0);
        // Referensi kontrak boleh diperbarui Sidamon; input finance disimpan terpisah.
        try {
            $spmk_mulai = tenaga_ahli_valid_date($item['spmkMulai'] ?? $start_date);
            $spmk_selesai = tenaga_ahli_valid_date($item['spmkSelesai'] ?? $end_date);
            if ($spmk_mulai && $spmk_selesai && $spmk_selesai < $spmk_mulai) {
                throw new InvalidArgumentException('Tanggal selesai SPMK mendahului tanggal mulai.');
            }
            $man_month = tenaga_ahli_nominal($item['manMonth'] ?? $item['menman'] ?? null);
            if ($man_month !== null && $man_month > 99999999.99) throw new InvalidArgumentException('Menman terlalu besar.');
            $gaji_rab = tenaga_ahli_nominal($item['gajiRab'] ?? $item['nominalHonorBulanan'] ?? null);
            $nama_pekerjaan = $item['namaPekerjaan'] ?? $item['jobName'] ?? null;
            if ($nama_pekerjaan !== null && (!is_string($nama_pekerjaan) || strlen($nama_pekerjaan) > 255)) {
                throw new InvalidArgumentException('Nama pekerjaan maksimal 255 byte.');
            }
        } catch (InvalidArgumentException $e) {
            $results[] = ['nik' => $nik, 'nama' => $nama, 'status' => 'error', 'message' => $e->getMessage()];
            continue;
        }


        $pdo->beginTransaction();
        try {
            // Cek apakah sudah ada Rekanan dengan tipe TENAGA_AHLI dan NIK ini di entitas ini
            $stmt = $pdo->prepare("SELECT id FROM Rekanan WHERE entityId = ? AND nik = ? AND tipe = 'TENAGA_AHLI' LIMIT 1");
            $stmt->execute([$entity_id, $nik]);
            $existing_id = $stmt->fetchColumn();

            if ($existing_id) {
                $pdo->prepare(
                    "UPDATE Rekanan SET
                        nama = ?, npwp = ?, kategori = ?, ptkp = ?,
                        projectId = COALESCE(?, projectId),
                        tanggalMulaiTugas = COALESCE(?, tanggalMulaiTugas),
                        tanggalSelesaiTugas = COALESCE(?, tanggalSelesaiTugas),
                        isTurunLapangan = ?, nominalHonorBulanan = ?,
                        updatedAt = ?
                     WHERE id = ?"
                )->execute([
                    $nama, $npwp, $kategori, $ptkp,
                    $project_id,
                    $start_date, $end_date,
                    $is_turun, $nominal_honor,
                    $now, $existing_id
                ]);

                $target_rekanan_id = $existing_id;
                $item_result = [
                    'nik' => $nik,
                    'nama' => $nama,
                    'action' => 'updated',
                    'rekananId' => $existing_id,
                ];
            } else {
                $new_id = uuid4();
                $pdo->prepare(
                    "INSERT INTO Rekanan
                        (id, nama, nik, npwp, tipe, kategori, ptkp, entityId,
                         projectId, tanggalMulaiTugas, tanggalSelesaiTugas,
                         isTurunLapangan, nominalHonorBulanan, createdAt, updatedAt)
                     VALUES (?, ?, ?, ?, 'TENAGA_AHLI', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                )->execute([
                    $new_id, $nama, $nik, $npwp, $kategori, $ptkp, $entity_id,
                    $project_id, $start_date, $end_date,
                    $is_turun, $nominal_honor, $now, $now
                ]);

                $target_rekanan_id = $new_id;
                $item_result = [
                    'nik' => $nik,
                    'nama' => $nama,
                    'action' => 'created',
                    'rekananId' => $new_id,
                ];
            }

            if ($project_id && $target_rekanan_id) {
                $pdo->prepare("INSERT INTO TenagaAhliGajiKontrak
                    (id, rekananId, projectId, sumber, namaPekerjaan, manMonth, gajiRab, spmkMulai, spmkSelesai, revision)
                    VALUES (?, ?, ?, 'SIDAMON', ?, ?, ?, ?, ?, 1)
                    ON DUPLICATE KEY UPDATE sumber = 'SIDAMON',
                        namaPekerjaan = COALESCE(VALUES(namaPekerjaan), namaPekerjaan),
                        manMonth = COALESCE(VALUES(manMonth), manMonth),
                        gajiRab = COALESCE(VALUES(gajiRab), gajiRab),
                        spmkMulai = COALESCE(VALUES(spmkMulai), spmkMulai),
                        spmkSelesai = COALESCE(VALUES(spmkSelesai), spmkSelesai),
                        revision = revision + 1")
                    ->execute([uuid4(), $target_rekanan_id, $project_id, $nama_pekerjaan,
                        $man_month, $gaji_rab, $spmk_mulai, $spmk_selesai]);
            }

            // Upsert ke TenagaAhliProject jika penugasan memiliki projectId
            if ($project_id && $target_rekanan_id) {
                $stmt_tap = $pdo->prepare("SELECT id FROM TenagaAhliProject WHERE rekananId = ? AND projectId = ? LIMIT 1");
                $stmt_tap->execute([$target_rekanan_id, $project_id]);
                $existing_tap_id = $stmt_tap->fetchColumn();

                if ($existing_tap_id) {
                    $pdo->prepare(
                        "UPDATE TenagaAhliProject SET
                            tanggalMulaiTugas = ?, tanggalSelesaiTugas = ?,
                            isTurunLapangan = ?, nominalHonorBulanan = ?,
                            updatedAt = ?
                         WHERE id = ?"
                    )->execute([$start_date, $end_date, $is_turun, $nominal_honor, $now, $existing_tap_id]);
                } else {
                    $pdo->prepare(
                        "INSERT INTO TenagaAhliProject
                            (id, rekananId, projectId, tanggalMulaiTugas, tanggalSelesaiTugas, isTurunLapangan, nominalHonorBulanan, createdAt, updatedAt)
                         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
                    )->execute([uuid4(), $target_rekanan_id, $project_id, $start_date, $end_date, $is_turun, $nominal_honor, $now, $now]);
                }
            }
            $pdo->commit();
            $results[] = $item_result;
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            error_log('Sync tenaga ahli gagal: ' . $e->getMessage());
            $results[] = ['nik' => $nik, 'nama' => $nama, 'status' => 'error', 'message' => 'Penyimpanan tenaga ahli gagal. Silakan ulangi sinkronisasi.'];
        }
    }

    log_activity('system', "Sync Tenaga Ahli dari Sidamon: " . count($results) . " data diproses", 'USER_ACTIVITY', [
        'count' => count($results),
    ]);

    json_response([
        'success' => true,
        'syncedCount' => count($results),
        'results' => $results,
    ]);
}

else {
    error_response('Endpoint sync tidak ditemukan.', 404);
}
