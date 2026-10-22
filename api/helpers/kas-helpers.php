<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

// COA codes per entity — diambil 1:1 dari src/lib/actions/kas.ts & src/lib/bank-accounts.ts
define('KAS_KECIL_COA', ['kencana' => '1100', 'gaharu' => '1200', 'tataring' => '1300', 'ciptaAsri' => '1400', 'umum' => '1500']);
define('KAS_BESAR_COA', ['kencana' => '110',  'gaharu' => '120',  'tataring' => '130',  'ciptaAsri' => '140']);
define('PIUTANG_COA_CODE', ['kencana' => '111', 'gaharu' => '112', 'tataring' => '113', 'ciptaAsri' => '114', 'umum' => '115']);
define('HUTANG_COA_CODE',  ['kencana' => '311', 'gaharu' => '312', 'tataring' => '313', 'ciptaAsri' => '314', 'umum' => '315']);

// Rekening bank: rekeningNama => COA code — dari src/lib/bank-accounts.ts
// Keyed by rekening ID (sama persis dengan REKENING_COA_CODE di src/lib/bank-accounts.ts)
define('REKENING_COA_CODE', [
    'kak-bri' => '11', 'kak-bpd' => '12', 'kak-bni' => '13', 'kak-mdr' => '14',
    'gs-bri'  => '21', 'gs-bpd'  => '22', 'gs-bni'  => '23', 'gs-mdr'  => '24',
    'tb-bpd'  => '31', 'tb-bni'  => '32',
    'cad-bpd' => '41',
    'kp-bpd'  => '51',
]);

// Rekening per entity (list) — dipakai untuk default rekening saat rekeningId tidak valid
define('REKENING_BY_ENTITY', [
    'kencana'  => [
        ['id' => 'kak-bri', 'nama' => 'BRI KAK'],
        ['id' => 'kak-bpd', 'nama' => 'BPD KAK'],
        ['id' => 'kak-bni', 'nama' => 'BNI KAK'],
        ['id' => 'kak-mdr', 'nama' => 'MDR KAK'],
    ],
    'gaharu'   => [
        ['id' => 'gs-bri', 'nama' => 'BRI GS'],
        ['id' => 'gs-bpd', 'nama' => 'BPD GS'],
        ['id' => 'gs-bni', 'nama' => 'BNI GS'],
        ['id' => 'gs-mdr', 'nama' => 'MDR GS'],
    ],
    'tataring' => [
        ['id' => 'tb-bpd', 'nama' => 'BPD TB'],
        ['id' => 'tb-bni', 'nama' => 'BNI TB'],
    ],
    'ciptaAsri' => [
        ['id' => 'cad-bpd', 'nama' => 'BPD CAD'],
    ],
    'umum' => [
        ['id' => 'kp-bpd', 'nama' => 'BPD KP'],
    ],
]);

// Rekening id → nama (inverse map)
define('REKENING_ID_TO_NAMA', [
    'kak-bri' => 'BRI KAK', 'kak-bpd' => 'BPD KAK', 'kak-bni' => 'BNI KAK', 'kak-mdr' => 'MDR KAK',
    'gs-bri'  => 'BRI GS',  'gs-bpd'  => 'BPD GS',  'gs-bni'  => 'BNI GS',  'gs-mdr'  => 'MDR GS',
    'tb-bpd'  => 'BPD TB',  'tb-bni'  => 'BNI TB',
    'cad-bpd' => 'BPD CAD',
    'kp-bpd'  => 'BPD KP',
]);

// Prefix no. bukti per entity — dari src/lib/kas.ts ENTITY_PREFIX & ENTITY_PREFIX_UMUM
define('ENTITY_PREFIX', ['gaharu' => 'GH', 'kencana' => 'KC', 'tataring' => 'TT', 'ciptaAsri' => 'CA', 'umum' => 'UM']);
define('ENTITY_PREFIX_UMUM', ['kencana' => 'UK', 'gaharu' => 'UG', 'tataring' => 'UT', 'ciptaAsri' => 'UC', 'umum' => 'UU']);

/**
 * Kembalikan nama rekening dari rekeningId.
 */
function get_rekening_nama(string $entity_key, string $rekening_id): ?string {
    $map = REKENING_ID_TO_NAMA;
    return $map[$rekening_id] ?? null;
}

/**
 * Validasi apakah rekeningId valid untuk entity_key tertentu.
 */
function is_valid_rekening(string $entity_key, string $rekening_id): bool {
    $list = REKENING_BY_ENTITY[$entity_key] ?? [];
    foreach ($list as $r) {
        if ($r['id'] === $rekening_id) return true;
    }
    return false;
}

/**
 * Ambil saldo awal (dari tabel SaldoAwal) untuk kas/bank tertentu.
 * Logika: 1:1 dengan getInitialSaldoAwal() di src/lib/kas.ts
 */
function get_initial_saldo_awal(PDO $pdo, string $entity_id, string $jenis_input_id_or_key, ?string $rekening_nama_or_id = null, int $year = 0): float {
    if (!$year) $year = (int)date('Y');

    $coa_code = null;

    // Resolve entity key
    $stmt = $pdo->prepare('SELECT `key` FROM Entity WHERE id = ?');
    $stmt->execute([$entity_id]);
    $entity_key = $stmt->fetchColumn();
    if (!$entity_key) return 0.0;

    // Resolve rekening → COA code (REKENING_COA_CODE keyed by rekening ID)
    if ($rekening_nama_or_id) {
        $rekening_coa_map = REKENING_COA_CODE;
        // Coba langsung sebagai ID
        if (isset($rekening_coa_map[$rekening_nama_or_id])) {
            $coa_code = $rekening_coa_map[$rekening_nama_or_id];
        } else {
            // Fallback: cari rekening yang namanya cocok, ambil ID-nya
            foreach (REKENING_BY_ENTITY as $rekenings) {
                foreach ($rekenings as $r) {
                    if ($r['nama'] === $rekening_nama_or_id && isset($rekening_coa_map[$r['id']])) {
                        $coa_code = $rekening_coa_map[$r['id']];
                        break 2;
                    }
                }
            }
        }
    }

    if (!$coa_code) {
        // Resolve jenis input key
        $stmt2 = $pdo->prepare('SELECT `key` FROM JenisInputTransaksi WHERE id = ? OR `key` = ? LIMIT 1');
        $stmt2->execute([$jenis_input_id_or_key, $jenis_input_id_or_key]);
        $jenis_key = $stmt2->fetchColumn();

        if ($jenis_key === 'kasKecil') {
            $coa_code = KAS_KECIL_COA[$entity_key] ?? null;
        } elseif ($jenis_key === 'kasBesar') {
            $coa_code = KAS_BESAR_COA[$entity_key] ?? null;
        }
    }

    if (!$coa_code) return 0.0;

    $stmt3 = $pdo->prepare('SELECT id FROM CoaAccount WHERE code = ?');
    $stmt3->execute([$coa_code]);
    $coa_id = $stmt3->fetchColumn();
    if (!$coa_id) return 0.0;

    $stmt4 = $pdo->prepare('SELECT nominal FROM SaldoAwal WHERE entityId = ? AND coaAccountId = ? AND year = ?');
    $stmt4->execute([$entity_id, $coa_id, $year]);
    $val = $stmt4->fetchColumn();
    return $val !== false ? (float)$val : 0.0;
}

/**
 * Hitung running saldo kas/bank.
 * Logika: 1:1 dengan getRunningSaldo() di src/lib/kas.ts
 */
function get_running_saldo(PDO $pdo, string $entity_id, string $jenis_input_id, ?string $rekening_nama = null, int $year = 0): float {
    if (!$year) $year = (int)date('Y');
    $saldo_awal = get_initial_saldo_awal($pdo, $entity_id, $jenis_input_id, $rekening_nama, $year);

    // Ambil semua kas entry (isKasEntry = true)
    $stmt = $pdo->prepare(
        "SELECT debit, kredit, extraFieldsJson
         FROM `Transaction`
         WHERE entityId = ? AND jenisInputId = ?
           AND JSON_VALUE(extraFieldsJson, '$.isKasEntry') = 'true'"
    );
    $stmt->execute([$entity_id, $jenis_input_id]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $total_masuk  = 0.0;
    $total_keluar = 0.0;
    foreach ($rows as $row) {
        $extra = $row['extraFieldsJson'] ? json_decode($row['extraFieldsJson'], true) : [];
        // Filter per rekening jika diperlukan
        if ($rekening_nama !== null) {
            if (($extra['rekeningNama'] ?? null) !== $rekening_nama) continue;
        }
        $total_masuk  += (float)($row['debit']  ?? 0);
        $total_keluar += (float)($row['kredit'] ?? 0);
    }

    return $saldo_awal + $total_masuk - $total_keluar;
}

/**
 * Hitung saldo sebelum tanggal tertentu (untuk Saldo Awal periode ledger).
 * Logika: 1:1 dengan getSaldoSebelum() di src/lib/kas.ts
 */
function get_saldo_sebelum(PDO $pdo, string $entity_id, string $jenis_input_id, string $sebelum, ?string $rekening_nama = null, int $year = 0): float {
    if (!$year) $year = (int)date('Y', strtotime($sebelum));
    $saldo_awal = get_initial_saldo_awal($pdo, $entity_id, $jenis_input_id, $rekening_nama, $year);

    $stmt = $pdo->prepare(
        "SELECT debit, kredit, extraFieldsJson
         FROM `Transaction`
         WHERE entityId = ? AND jenisInputId = ?
           AND tanggal < ?
           AND JSON_VALUE(extraFieldsJson, '$.isKasEntry') = 'true'"
    );
    $stmt->execute([$entity_id, $jenis_input_id, $sebelum]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $total_masuk  = 0.0;
    $total_keluar = 0.0;
    foreach ($rows as $row) {
        $extra = $row['extraFieldsJson'] ? json_decode($row['extraFieldsJson'], true) : [];
        if ($rekening_nama !== null) {
            if (($extra['rekeningNama'] ?? null) !== $rekening_nama) continue;
        }
        $total_masuk  += (float)($row['debit']  ?? 0);
        $total_keluar += (float)($row['kredit'] ?? 0);
    }

    return $saldo_awal + $total_masuk - $total_keluar;
}

/**
 * Resolve COA id untuk kas entry (kasKecil / kasBesar / bankBuku).
 * Logika: 1:1 dengan resolveKasCoa() di src/lib/actions/kas.ts
 */
function resolve_kas_coa(PDO $pdo, string $jenis_input_key, string $entity_key, ?string $rekening_id = null): ?string {
    if ($jenis_input_key === 'kasKecil') {
        $code = KAS_KECIL_COA[$entity_key] ?? null;
        if (!$code) return null;
        $stmt = $pdo->prepare('SELECT id FROM CoaAccount WHERE code = ?');
        $stmt->execute([$code]);
        return $stmt->fetchColumn() ?: null;
    }
    if ($jenis_input_key === 'kasBesar') {
        $code = KAS_BESAR_COA[$entity_key] ?? null;
        if (!$code) return null;
        $stmt = $pdo->prepare('SELECT id FROM CoaAccount WHERE code = ?');
        $stmt->execute([$code]);
        return $stmt->fetchColumn() ?: null;
    }
    if ($jenis_input_key === 'bankBuku') {
        $effective_rek = $rekening_id;
        if (!$effective_rek || !is_valid_rekening($entity_key, $effective_rek)) {
            $list = REKENING_BY_ENTITY[$entity_key] ?? [];
            $effective_rek = $list[0]['id'] ?? null;
        }
        if (!$effective_rek) return null;
        $coa_map = REKENING_COA_CODE;
        $coa_code = $coa_map[$effective_rek] ?? null;
        if (!$coa_code) return null;
        $stmt = $pdo->prepare('SELECT id FROM CoaAccount WHERE code = ?');
        $stmt->execute([$coa_code]);
        return $stmt->fetchColumn() ?: null;
    }
    return null;
}

/**
 * Resolve COA debit untuk crossing entry (Piutang atau Beban).
 * Logika: 1:1 dengan resolveCrossingDebitCoa() di src/lib/actions/kas.ts
 */
function resolve_crossing_debit_coa(PDO $pdo, ?string $primary_row_coa_id): ?array {
    if (!$primary_row_coa_id) return null;
    $stmt = $pdo->prepare('SELECT id, kategori FROM CoaAccount WHERE id = ?');
    $stmt->execute([$primary_row_coa_id]);
    $coa = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$coa) return null;
    $role = ($coa['kategori'] === 'BEBAN') ? 'BEBAN' : 'PIUTANG';
    return ['coaAccountId' => $coa['id'], 'role' => $role];
}

/**
 * Buat crossing entries di entitas tujuan saat terjadi pengeluaran lintas entitas (Kas Keluar).
 * Mendukung multi-entitas (misal: pinjaman ke GS, TB, CAD, KP sekaligus).
 *
 * Logika pencocokan baris ke entitas:
 * 1. Setiap baris di $valid_rows dicek apakah COA-nya adalah akun PIUTANG spesifik milik salah satu entitas tujuan
 *    (PIUTANG_COA_CODE: 111 KAK, 112 GS, 113 TB, 114 CAD, 115 KP).
 * 2. Baris yang cocok dialokasikan khusus ke entitas tersebut dengan nominal masing-masing.
 * 3. Jika suatu entitas tujuan tidak memiliki baris piutang spesifik (misal pengeluaran beban langsung):
 *    - Bila hanya ada 1 entitas tujuan di $crossing_keys, semua baris $valid_rows dialokasikan ke entitas tersebut.
 *    - Bila ada beberapa entitas tujuan, baris yang bukan akun piutang entitas lain akan dialokasikan.
 * 4. Untuk setiap entitas:
 *    - Baris debit dibuat per baris yang cocok (nominal per baris, COA debit sesuai role BEBAN / PIUTANG).
 *    - Baris kredit (HUTANG ke entitas asal, misal 311 Hutang KAK) dibuat sebesar subtotal baris yang dialokasikan.
 */
function create_crossing_entries(
    PDO $pdo,
    string $crossing_group_id,
    array $crossing_keys,
    string $entity_key,
    string $jenis_input_key,
    ?string $rekening_id,
    ?string $rekening_nama,
    ?string $proj_id,
    string $no_bukti,
    string $keterangan,
    string $tanggal_dt,
    array $valid_rows,
    string $staff_id,
    string $now
): void {
    if (!$crossing_group_id || empty($crossing_keys)) return;

    $jurnal_jenis_id = get_or_create_jurnal_transaksi_jenis($pdo);
    $hutang_code     = HUTANG_COA_CODE[$entity_key] ?? null;
    $hutang_coa_id   = null;
    if ($hutang_code) {
        $stmt2 = $pdo->prepare('SELECT id FROM CoaAccount WHERE code = ?');
        $stmt2->execute([$hutang_code]);
        $hutang_coa_id = $stmt2->fetchColumn() ?: null;
    }

    // Preload COA details untuk semua valid_rows
    $coa_ids_in_rows = array_unique(array_filter(array_column($valid_rows, 'coaAccountId')));
    $coa_details = [];
    if (!empty($coa_ids_in_rows)) {
        $ph_coa = implode(',', array_fill(0, count($coa_ids_in_rows), '?'));
        $stmt_c = $pdo->prepare("SELECT id, code, name, kategori FROM CoaAccount WHERE id IN ($ph_coa)");
        $stmt_c->execute(array_values($coa_ids_in_rows));
        foreach ($stmt_c->fetchAll(PDO::FETCH_ASSOC) as $cd) {
            $coa_details[$cd['id']] = $cd;
        }
    }

    foreach ($crossing_keys as $cross_key) {
        $stmt3 = $pdo->prepare('SELECT id FROM Entity WHERE `key` = ?');
        $stmt3->execute([$cross_key]);
        $cross_entity_id = $stmt3->fetchColumn();
        if (!$cross_entity_id) continue;

        $cross_common_extra_base = [
            'isCrossingEntry'           => true,
            'crossingGroupId'           => $crossing_group_id,
            'crossingFromEntityKey'     => $entity_key,
            'crossingFromJenisInputKey' => $jenis_input_key,
            'crossingFromRekeningId'    => $rekening_id,
            'crossingFromRekeningNama'  => $rekening_nama,
        ];
        if ($proj_id) $cross_common_extra_base['projectId'] = $proj_id;

        // Cocokkan baris yang ditujukan ke entitas ini
        $target_piutang_code = PIUTANG_COA_CODE[$cross_key] ?? null;
        $matched_rows = [];
        foreach ($valid_rows as $vr) {
            $code = $coa_details[$vr['coaAccountId']]['code'] ?? null;
            if ($target_piutang_code && $code === $target_piutang_code) {
                $matched_rows[] = $vr;
            }
        }

        // Jika tidak ada baris spesifik kode piutang entitas ini:
        if (empty($matched_rows)) {
            if (count($crossing_keys) === 1) {
                $matched_rows = $valid_rows;
            } else {
                foreach ($valid_rows as $vr) {
                    $code = $coa_details[$vr['coaAccountId']]['code'] ?? null;
                    $is_other_piutang = false;
                    foreach (PIUTANG_COA_CODE as $k => $pcode) {
                        if ($pcode === $code && in_array($k, $crossing_keys) && $k !== $cross_key) {
                            $is_other_piutang = true;
                            break;
                        }
                    }
                    if (!$is_other_piutang) {
                        $matched_rows[] = $vr;
                    }
                }
            }
        }

        if (empty($matched_rows)) continue;

        $cross_subtotal = 0.0;
        foreach ($matched_rows as $mr) {
            $nom = (float)$mr['nominal'];
            if ($nom <= 0) continue;
            $cross_subtotal += $nom;

            $debit_target = resolve_crossing_debit_coa($pdo, $mr['coaAccountId']);
            if ($debit_target) {
                $row_ket = !empty($mr['keterangan']) ? trim($mr['keterangan']) : $keterangan;
                $ex = array_merge($cross_common_extra_base, ['crossingRole' => $debit_target['role']]);
                $stmt4 = $pdo->prepare(
                    "INSERT INTO `Transaction` (id, entityId, jenisInputId, tanggal, noBukti, keterangan, coaAccountId,
                     debit, kredit, saldoSetelah, extraFieldsJson, staffId, projectId, createdAt)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                );
                $stmt4->execute([
                    uuid4(), $cross_entity_id, $jurnal_jenis_id, $tanggal_dt,
                    $no_bukti, $row_ket, $debit_target['coaAccountId'],
                    $nom, 0, 0, json_encode($ex), $staff_id, $proj_id, $now,
                ]);
            }
        }

        // Baris kredit (HUTANG entitas asal)
        if ($hutang_coa_id && $cross_subtotal > 0) {
            $ex = array_merge($cross_common_extra_base, [
                'crossingRole'          => 'HUTANG',
                'originalHutangCoaCode' => $hutang_code,
            ]);
            $stmt5 = $pdo->prepare(
                "INSERT INTO `Transaction` (id, entityId, jenisInputId, tanggal, noBukti, keterangan, coaAccountId,
                 debit, kredit, saldoSetelah, extraFieldsJson, staffId, projectId, createdAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            );
            $stmt5->execute([
                uuid4(), $cross_entity_id, $jurnal_jenis_id, $tanggal_dt,
                $no_bukti, $keterangan, $hutang_coa_id,
                0, $cross_subtotal, 0, json_encode($ex), $staff_id, $proj_id, $now,
            ]);
        }
    }
}


/**
 * Pastikan jenis input jurnalTransaksi ada — buat jika belum.
 * Logika: inline di createKasTransaction & saveJurnalTransaksi
 */
function get_or_create_jurnal_transaksi_jenis(PDO $pdo): string {
    $stmt = $pdo->prepare("SELECT id FROM JenisInputTransaksi WHERE `key` = 'jurnalTransaksi'");
    $stmt->execute();
    $id = $stmt->fetchColumn();
    if ($id) return $id;
    $new_id = uuid4();
    $pdo->prepare("INSERT INTO JenisInputTransaksi (id, `key`, nama, active, createdAt) VALUES (?, 'jurnalTransaksi', 'Entry Jurnal', 1, NOW())")
        ->execute([$new_id]);
    return $new_id;
}

/**
 * Bangun bank→rekening map untuk auto-post jurnal transaksi ke kas/bank ledger.
 * Logika: 1:1 dengan buildBankCoaMap() di src/lib/actions/jurnal-transaksi.ts
 */
function build_bank_coa_map(): array {
    $map = [];
    foreach (REKENING_BY_ENTITY as $entity_key => $rekenings) {
        foreach ($rekenings as $rekening) {
            $coa_map = REKENING_COA_CODE;
            $code = $coa_map[$rekening['id']] ?? null;
            if ($code) {
                $map[$code] = [
                    'rekeningId'   => $rekening['id'],
                    'entityKey'    => $entity_key,
                    'rekeningNama' => $rekening['nama'],
                ];
            }
        }
    }
    return $map;
}

/**
 * Hitung persentase termin baru berdasarkan nominal yang masuk.
 * Logika: 1:1 dengan computeNewTerminPercentage() di src/lib/piutang.ts
 * Dipakai di createKasTransaction & saveJurnalTransaksi.
 */
function compute_new_termin_percentage(float $contract_value, array $existing_pcts, float $nominal, float $existing_cumulative = 0.0): int {
    if ($contract_value <= 0) return 0;
    $max_pct_so_far = empty($existing_pcts) ? 0 : max($existing_pcts);
    $cumulative_before = $existing_cumulative > 0
        ? $existing_cumulative
        : ($max_pct_so_far / 100) * $contract_value;
    $cumulative_after = $cumulative_before + $nominal;
    return (int)min(100, round(($cumulative_after / $contract_value) * 100));
}

/**
 * Hitung DPP dari nilai kwitansi (rumus pajak project konstruksi).
 * Logika: 1:1 dengan hitungDppDariKwitansi() di src/lib/pendapatan.ts
 */
function hitung_dpp_dari_kwitansi(float $nilai_kwitansi): float {
    return round(($nilai_kwitansi * 100) / 111);
}

/**
 * Hitung DPP Nilai Lain (11/12 x DPP).
 * Logika: 1:1 dengan hitungDppNilaiLain() di src/lib/pendapatan.ts
 */
function hitung_dpp_nilai_lain(float $dpp): float {
    return round(($dpp * 11) / 12);
}

/**
 * Hitung dan update Project.spend dari semua transaksi terkait proyek.
 * Logika: 1:1 dengan syncProjectSpend() di src/lib/piutang.ts
 *
 * 4 prioritas: (1) crossing entries di entitas proyek, (2) transaksi normal BEBAN/5xx/6xx,
 * (3) transaksi dari entitas lain yang belum di-cover crossing, (4) honor tenaga ahli.
 */
function sync_project_spend(PDO $pdo, string $project_id): float {
    $stmt = $pdo->prepare('SELECT id, entityId FROM Project WHERE id = ?');
    $stmt->execute([$project_id]);
    $project = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$project) return 0.0;

    $stmt = $pdo->prepare(
        "SELECT t.noBukti, t.entityId, t.debit, t.kredit, t.keterangan, t.extraFieldsJson,
                c.code as coa_code, c.name as coa_name, c.kategori as coa_kategori
         FROM `Transaction` t
         LEFT JOIN CoaAccount c ON t.coaAccountId = c.id
         WHERE t.projectId = ?
           AND (JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') IS NULL
                OR JSON_VALUE(t.extraFieldsJson, '$.autoPostedFromJurnal') != 'true')"
    );
    $stmt->execute([$project_id]);
    $jurnal = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Himpunan noBukti income dan noBukti semua jurnal (untuk cek HonorTenagaAhli)
    $income_nb = [];
    $jurnal_nb = [];
    foreach ($jurnal as $j) {
        if (empty($j['noBukti'])) continue;
        $jurnal_nb[$j['noBukti']] = true;
        if (
            ($j['coa_kategori'] ?? '') === 'PENDAPATAN'
            || ($j['coa_code'] ?? '') === '400'
            || stripos($j['coa_name'] ?? '', 'pendapatan') !== false
        ) {
            $income_nb[$j['noBukti']] = true;
        }
    }

    $seen  = [];
    $total = 0.0;

    // Prioritas 1: Crossing entries di entitas proyek (talangan dari entitas lain)
    foreach ($jurnal as $j) {
        if (!empty($j['noBukti']) && isset($income_nb[$j['noBukti']])) continue;
        $extra = $j['extraFieldsJson'] ? json_decode($j['extraFieldsJson'], true) : [];
        if ($j['entityId'] === $project['entityId'] && !empty($extra['isCrossingEntry']) && (float)$j['debit'] > 0) {
            $total += (float)$j['debit'];
            if (!empty($extra['crossingGroupId'])) $seen[$extra['crossingGroupId']] = true;
            if (!empty($j['noBukti']))              $seen[$j['noBukti']]             = true;
        }
    }

    // Prioritas 2: Transaksi normal di entitas proyek sendiri
    foreach ($jurnal as $j) {
        $extra = $j['extraFieldsJson'] ? json_decode($j['extraFieldsJson'], true) : [];
        if (!empty($j['noBukti']) && isset($income_nb[$j['noBukti']])) {
            // Potongan pajak dalam baris pendapatan tetap dihitung sebagai spend
            $is_tax = (float)$j['debit'] > 0 && (
                ($j['coa_kategori'] ?? '') === 'BEBAN'
                || preg_match('/pph|pajak|ppn|bupot/i', $j['coa_name'] ?? '')
                || preg_match('/pph|pajak|ppn|potongan/i', $j['keterangan'] ?? '')
            );
            if ($is_tax) $total += (float)$j['debit'];
            continue;
        }
        if ($j['entityId'] === $project['entityId'] && !empty($extra['transitoryReversalId'])) {
            $is_cost = ($j['coa_kategori'] ?? '') === 'BEBAN' || preg_match('/^[56]/', $j['coa_code'] ?? '') || !preg_match('/bank|kas|piutang/i', $j['coa_name'] ?? '');
            if (empty($extra['isKasEntry']) && $is_cost) $total += (float)$j['debit'] - (float)$j['kredit'];
            continue;
        }
        if ($j['entityId'] === $project['entityId'] && empty($extra['isCrossingEntry'])) {
            $code     = $j['coa_code'] ?? '';
            $is_beban = ($j['coa_kategori'] ?? '') === 'BEBAN'
                || str_starts_with($code, '5')
                || str_starts_with($code, '6');
            if ($is_beban && (float)$j['debit'] > 0) {
                $total += (float)$j['debit'];
            } elseif ((float)$j['debit'] > 0 && !preg_match('/bank|kas|piutang/i', $j['coa_name'] ?? '')) {
                $total += (float)$j['debit'];
            }
        }
    }

    // Prioritas 3: Transaksi pengeluaran dari entitas lain untuk proyek ini
    foreach ($jurnal as $j) {
        if (!empty($j['noBukti']) && isset($income_nb[$j['noBukti']])) continue;
        if ($j['entityId'] !== $project['entityId'] && (float)$j['debit'] > 0) {
            $extra = $j['extraFieldsJson'] ? json_decode($j['extraFieldsJson'], true) : [];
            $gid   = $extra['crossingGroupId'] ?? null;
            if ($gid && isset($seen[$gid]))                              continue;
            if (!empty($j['noBukti']) && isset($seen[$j['noBukti']])) continue;
            $total += (float)$j['debit'];
            if ($gid)                  $seen[$gid]             = true;
            if (!empty($j['noBukti'])) $seen[$j['noBukti']]   = true;
        }
    }

    // Prioritas 4: Honor Tenaga Ahli yang dibebankan ke proyek ini
    $stmt = $pdo->prepare('SELECT nominalHonor, noBukti FROM HonorTenagaAhli WHERE projectId = ?');
    $stmt->execute([$project_id]);
    $honors = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($honors as $h) {
        $nb = $h['noBukti'] ?? null;
        if ($nb && (isset($seen[$nb]) || isset($jurnal_nb[$nb]))) continue;
        $total += (float)$h['nominalHonor'];
    }

    $pdo->prepare('UPDATE Project SET spend = ? WHERE id = ?')->execute([$total, $project_id]);
    return $total;
}
