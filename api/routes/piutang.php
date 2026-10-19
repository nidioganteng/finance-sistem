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

/**
 * Hitung real-time expensesSummary (detail pengeluaran proyek, potongan PPN/PPh termin,
 * talangan antar-entitas, kategori beban) dan breakdownSummary termin langsung dari `Transaction`.
 */
function compute_projects_expenses_and_breakdowns(PDO $pdo, array $projects): array {
    if (empty($projects)) return [];

    $project_ids = array_column($projects, 'id');
    $ph = implode(',', array_fill(0, count($project_ids), '?'));

    $stmt = $pdo->prepare(
        "SELECT t.id, t.tanggal, t.noBukti, t.keterangan, t.debit, t.kredit, t.projectId, t.entityId, t.extraFieldsJson,
                c.code AS coa_code, c.name AS coa_name, c.kategori AS coa_kategori,
                e.name AS entity_name, e.key AS entity_key
         FROM `Transaction` t
         LEFT JOIN CoaAccount c ON t.coaAccountId = c.id
         LEFT JOIN Entity e ON t.entityId = e.id
         WHERE t.projectId IN ($ph)
         ORDER BY t.tanggal ASC, t.id ASC"
    );
    $stmt->execute($project_ids);
    $all_txs = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $no_buktis = array_values(array_unique(array_filter(array_column($all_txs, 'noBukti'))));
    $counterparts_by_bukti = [];
    if (!empty($no_buktis)) {
        $ph_nb = implode(',', array_fill(0, count($no_buktis), '?'));
        $stmt_cp = $pdo->prepare(
            "SELECT t.id, t.noBukti, t.entityId, t.debit, t.kredit, t.extraFieldsJson,
                    c.code AS coa_code, c.name AS coa_name, c.kategori AS coa_kategori,
                    e.name AS entity_name, e.key AS entity_key
             FROM `Transaction` t
             LEFT JOIN CoaAccount c ON t.coaAccountId = c.id
             LEFT JOIN Entity e ON t.entityId = e.id
             WHERE t.noBukti IN ($ph_nb)
             ORDER BY t.tanggal ASC, t.id ASC"
        );
        $stmt_cp->execute($no_buktis);
        foreach ($stmt_cp->fetchAll(PDO::FETCH_ASSOC) as $cp_row) {
            $nb = $cp_row['noBukti'];
            $counterparts_by_bukti[$nb][] = $cp_row;
        }
    }

    $stmt_h = $pdo->prepare("SELECT id, projectId, tanggal, noBukti, uraian, nominalHonor FROM HonorTenagaAhli WHERE projectId IN ($ph)");
    $stmt_h->execute($project_ids);
    $all_honors = $stmt_h->fetchAll(PDO::FETCH_ASSOC);
    $honors_by_proj = [];
    foreach ($all_honors as $h) {
        $honors_by_proj[$h['projectId']][] = $h;
    }

    $txs_by_proj = [];
    foreach ($all_txs as $tx) {
        $txs_by_proj[$tx['projectId']][] = $tx;
    }

    $result = [];
    foreach ($projects as $p) {
        $pid = $p['id'];
        $proj_txs = $txs_by_proj[$pid] ?? [];

        $expense_items = [];
        $total_material = 0.0;
        $total_gaji = 0.0;
        $total_operasional = 0.0;
        $total_pajak = 0.0;
        $total_lainnya = 0.0;

        $termin_breakdowns_by_nb = [];

        $p_by_bukti = [];
        foreach ($proj_txs as $t) {
            $nb = $t['noBukti'] ?: $t['id'];
            $p_by_bukti[$nb][] = $t;
        }

        $proj_entity_id = $p['entityId'] ?? $p['entity_id'] ?? '';

        // 1. Identifikasi crossing entries di entitas proyek sendiri agar tidak double-count dengan transaksi asal dari entitas lain
        $seen_crossing_groups = [];
        $seen_crossing_buktis = [];
        foreach ($proj_txs as $t) {
            $extra = !empty($t['extraFieldsJson']) ? json_decode($t['extraFieldsJson'], true) : [];
            if ($proj_entity_id && $t['entityId'] === $proj_entity_id && !empty($extra['isCrossingEntry']) && (float)$t['debit'] > 0) {
                if (!empty($extra['crossingGroupId'])) $seen_crossing_groups[$extra['crossingGroupId']] = true;
                if (!empty($t['noBukti']))              $seen_crossing_buktis[$t['noBukti']]             = true;
            }
        }

        foreach ($proj_txs as $t) {
            $extra = !empty($t['extraFieldsJson']) ? json_decode($t['extraFieldsJson'], true) : [];
            if (!empty($extra['autoPostedFromJurnal']) || !empty($extra['autoPostedFromFaktur'])) continue;

            // Jika transaksi berasal dari entitas lain, tapi sudah ada crossing entry di entitas proyek, lewati agar tidak dobel
            if ($proj_entity_id && $t['entityId'] !== $proj_entity_id) {
                $gid = $extra['crossingGroupId'] ?? null;
                if ($gid && isset($seen_crossing_groups[$gid])) continue;
                if (!empty($t['noBukti']) && isset($seen_crossing_buktis[$t['noBukti']])) continue;
            }

            $debit = (float)$t['debit'];
            $kredit = (float)$t['kredit'];
            $c_code = $t['coa_code'] ?? '';
            $c_name = $t['coa_name'] ?? '';
            $c_kat  = $t['coa_kategori'] ?? '';
            $ket    = $t['keterangan'] ?? '';
            $txt    = strtolower("$c_name $ket");
            $nb     = $t['noBukti'] ?: $t['id'];

            $voucher_all = $counterparts_by_bukti[$t['noBukti'] ?? ''] ?? ($p_by_bukti[$nb] ?? []);

            $has_income = false;
            $income_gross = 0.0;
            $bank_name = 'Bank';
            $net_bank = 0.0;
            $voucher_date = substr($t['tanggal'], 0, 10);

            foreach ($voucher_all as $v) {
                $v_extra = !empty($v['extraFieldsJson']) ? json_decode($v['extraFieldsJson'], true) : [];
                if (!empty($v_extra['autoPostedFromJurnal']) || !empty($v_extra['autoPostedFromFaktur'])) continue;

                $vk = (float)$v['kredit'];
                $vd = (float)$v['debit'];
                $v_kat = $v['coa_kategori'] ?? '';
                $v_code = $v['coa_code'] ?? '';
                $v_name = $v['coa_name'] ?? '';

                if ($v_kat === 'PENDAPATAN' || $v_code === '400' || stripos($v_name, 'pendapatan') !== false) {
                    $has_income = true;
                    if ($vk > 0) $income_gross += $vk;
                }
                if ($vd > 0 && ($v_kat === 'ASET' || preg_match('/bank|kas|bpd|bri|bni|mandiri/i', $v_name))) {
                    $net_bank += $vd;
                    if ($v_name) $bank_name = $v_name;
                }
            }

            if ($has_income && $t['noBukti'] && !isset($termin_breakdowns_by_nb[$t['noBukti']])) {
                $t_ppn = 0.0;
                $t_pph = 0.0;
                $pph_items = [];
                $jurnal_rows = [];

                foreach ($voucher_all as $v) {
                    $v_extra = !empty($v['extraFieldsJson']) ? json_decode($v['extraFieldsJson'], true) : [];
                    if (!empty($v_extra['autoPostedFromJurnal']) || !empty($v_extra['autoPostedFromFaktur'])) continue;

                    $vd = (float)$v['debit'];
                    $vk = (float)$v['kredit'];
                    $vc = $v['coa_code'] ?? '';
                    $vn = $v['coa_name'] ?? '';

                    if ($vd > 0) {
                        if ($vc === '535' || $vc === '536' || preg_match('/ppn/i', $vn)) {
                            $t_ppn += $vd;
                        } elseif (in_array($vc, ['532', '533', '534']) || preg_match('/pph/i', $vn)) {
                            $t_pph += $vd;
                            $pph_items[] = ['name' => $vn, 'amount' => $vd];
                        }
                    }

                    $jurnal_rows[] = [
                        'coaCode' => $vc,
                        'coaName' => $vn,
                        'debit'   => $vd,
                        'kredit'  => $vk,
                    ];
                }

                $gross = $income_gross > 0 ? $income_gross : ($net_bank + $t_ppn + $t_pph);
                $dpp = $gross > 0 ? (int)round(($gross * 100) / 111) : 0;
                $dpp_nilai_lain = (int)round(($dpp * 11) / 12);

                $termin_breakdowns_by_nb[$t['noBukti']] = [
                    'noBukti'          => $t['noBukti'],
                    'tanggalTerima'    => $voucher_date,
                    'bank'             => $bank_name,
                    'gross'            => $gross,
                    'dpp'              => $dpp,
                    'dppNilaiLain'     => $dpp_nilai_lain,
                    'ppn'              => $t_ppn,
                    'tarifPpnPersen'   => $dpp > 0 ? round(($t_ppn / $dpp) * 100, 1) : 12,
                    'pph'              => $t_pph,
                    'tarifPphPersen'   => $dpp > 0 ? round(($t_pph / $dpp) * 100, 2) : 3.5,
                    'pphItems'         => $pph_items,
                    'netBank'          => $net_bank,
                    'jurnalRows'       => $jurnal_rows,
                ];
            }

            if ($debit <= 0) continue;

            $is_crossing = !empty($extra['isCrossingEntry']) || !empty($extra['crossingFromEntityKey']);

            if ($has_income) {
                $is_deduction = ($c_kat === 'BEBAN' || preg_match('/pph|ppn|pajak|potongan|bupot/i', $txt) || in_array($c_code, ['532', '533', '534', '535', '536']));
                if (!$is_deduction) continue;
            } else {
                // Crossing entry (pinjaman/talangan awal dari entitas lain ke proyek) tetap dihitung sebagai pengeluaran proyek
                // sekalipun awalnya masih berstatus piutang (kategori ASET) sebelum diedit ke akun beban
                if (!$is_crossing && $c_kat === 'ASET' && preg_match('/bank|kas|piutang/i', $c_name)) continue;
            }

            if (preg_match('/pph|ppn|pajak|retribusi/i', $txt) || in_array($c_code, ['532', '533', '534', '535', '536'])) {
                $kat = 'Pajak Proyek';
                $total_pajak += $debit;
            } elseif (preg_match('/gaji|upah|mandor|tukang|honor|tenaga ahli/i', $txt)) {
                $kat = 'Gaji & Upah';
                $total_gaji += $debit;
            } elseif (preg_match('/bahan|material|perlengkapan|semen|pasir|besi|batu|kayu|cat|baut|alat/i', $txt)) {
                $kat = 'Bahan & Material';
                $total_material += $debit;
            } elseif (preg_match('/transport|perjalanan|bensin|bbm|solar|konsumsi|makan|listrik|telepon|pdam|survey|sewa|akomodasi/i', $txt)) {
                $kat = 'Operasional & Transport';
                $total_operasional += $debit;
            } else {
                $kat = 'Lainnya';
                $total_lainnya += $debit;
            }

            $sumber = 'Kas / Bank';
            if ($has_income) {
                $sumber = 'Potongan Termin';
            } else {
                $found_talangan = false;
                foreach ($voucher_all as $v) {
                    if ((float)$v['kredit'] > 0 && $v['id'] !== $t['id']) {
                        $vc = $v['coa_code'] ?? '';
                        $vn = $v['coa_name'] ?? '';
                        if ($vc === '311') {
                            $sumber = 'Talangan KAK (Kencana)';
                            $found_talangan = true;
                        } elseif ($vc === '312') {
                            $sumber = 'Talangan GS (Gaharu)';
                            $found_talangan = true;
                        } elseif ($vc === '313') {
                            $sumber = 'Talangan TB (Tataring)';
                            $found_talangan = true;
                        } elseif ($vc === '314') {
                            $sumber = 'Talangan CAD (Cipta Asri)';
                            $found_talangan = true;
                        } elseif ($vc === '315') {
                            $sumber = 'Talangan KP (Umum)';
                            $found_talangan = true;
                        } elseif (preg_match('/^31[1-7]$/', $vc)) {
                            $sumber = "Hutang Afiliasi ($vc)";
                            $found_talangan = true;
                        } elseif ($vn) {
                            $sumber = $vn;
                        }
                        break;
                    }
                }
                if (!$found_talangan && !empty($extra['crossingFromEntityKey'])) {
                    $ck = strtolower($extra['crossingFromEntityKey']);
                    $labels = [
                        'kencana'  => 'Talangan KAK (Kencana)',
                        'gaharu'   => 'Talangan GS (Gaharu)',
                        'tataring' => 'Talangan TB (Tataring)',
                        'asri'     => 'Talangan CAD (Cipta Asri)',
                        'asricipta'=> 'Talangan CAD (Cipta Asri)',
                        'umum'     => 'Talangan KP (Umum)',
                    ];
                    $sumber = $labels[$ck] ?? ('Talangan ' . strtoupper($ck));
                }
            }

            $expense_items[] = [
                'id'            => $t['id'],
                'tanggal'       => substr($t['tanggal'], 0, 10),
                'noBukti'       => $t['noBukti'] ?: '-',
                'keterangan'    => $t['keterangan'] ?: '-',
                'coaCode'       => $c_code,
                'coaName'       => $c_name,
                'kategoriBeban' => $kat,
                'nominal'       => $debit,
                'sumberKasBank' => $sumber,
            ];
        }

        $p_honors = $honors_by_proj[$pid] ?? [];
        $existing_nb = array_filter(array_column($expense_items, 'noBukti'));
        foreach ($p_honors as $h) {
            $h_nb = $h['noBukti'] ?? '';
            if ($h_nb && in_array($h_nb, $existing_nb)) continue;

            $h_nom = (float)$h['nominalHonor'];
            if ($h_nom <= 0) continue;

            $total_gaji += $h_nom;
            $expense_items[] = [
                'id'            => $h['id'],
                'tanggal'       => $h['tanggal'] ? substr($h['tanggal'], 0, 10) : date('Y-m-d'),
                'noBukti'       => $h_nb ?: '-',
                'keterangan'    => $h['uraian'] ?: 'Honor Tenaga Ahli',
                'coaCode'       => '511',
                'coaName'       => 'Honor Tenaga Ahli',
                'kategoriBeban' => 'Gaji & Upah',
                'nominal'       => $h_nom,
                'sumberKasBank' => 'Honor Tenaga Ahli',
            ];
        }

        $total_pengeluaran = $total_material + $total_gaji + $total_operasional + $total_pajak + $total_lainnya;

        $tot_gross = 0.0;
        $tot_dpp = 0.0;
        $tot_dpp_nl = 0.0;
        $tot_ppn = 0.0;
        $tot_pph = 0.0;
        $tot_net_bank = 0.0;

        foreach ($termin_breakdowns_by_nb as $bd) {
            $tot_gross += (float)$bd['gross'];
            $tot_dpp += (float)$bd['dpp'];
            $tot_dpp_nl += (float)$bd['dppNilaiLain'];
            $tot_ppn += (float)$bd['ppn'];
            $tot_pph += (float)$bd['pph'];
            $tot_net_bank += (float)$bd['netBank'];
        }

        $contract_val = (float)($p['contractValue'] ?? 0);
        $sisa_kontrak = max(0.0, $contract_val - $tot_gross);

        $result[$pid] = [
            'expensesSummary' => [
                'totalPengeluaran' => $total_pengeluaran,
                'totalMaterial'    => $total_material,
                'totalGaji'        => $total_gaji,
                'totalOperasional' => $total_operasional,
                'totalPajak'       => $total_pajak,
                'totalLainnya'     => $total_lainnya,
                'items'            => $expense_items,
            ],
            'breakdownSummary' => [
                'totalGross'        => $tot_gross,
                'totalDpp'          => $tot_dpp,
                'totalDppNilaiLain' => $tot_dpp_nl,
                'totalPpn'          => $tot_ppn,
                'totalPph'          => $tot_pph,
                'totalNetBank'      => $tot_net_bank,
                'sisaKontrak'       => $sisa_kontrak,
            ],
            'terminBreakdowns' => $termin_breakdowns_by_nb,
        ];
    }

    return $result;
}

// ─── GET /api/piutang?type=projects&entityKey=... ─────────────────────────────
if ($method === 'GET' && ($_GET['type'] ?? '') === 'projects') {
    $current_entity_key = $_GET['entityKey'] ?? null;
    $pdo = get_pdo();

    $stmt = $pdo->prepare(
        'SELECT p.id, p.code, p.name, p.entityId, p.contractValue, p.status, p.deadline,
                e.`key` AS entity_key, e.name AS entity_name
         FROM Project p
         JOIN Entity e ON p.entityId = e.id
         WHERE p.status = \'ACTIVE\'
         ORDER BY CASE WHEN e.`key` = ? THEN 0 ELSE 1 END, e.name ASC, p.code ASC'
    );
    $stmt->execute([$current_entity_key ?? '']);
    $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $termins_by_proj = [];
    if (!empty($projects)) {
        $pids = array_column($projects, 'id');
        $ph = implode(',', array_fill(0, count($pids), '?'));
        $stmt_t = $pdo->prepare("SELECT id, projectId, name, percentage, nominal FROM Termin WHERE projectId IN ($ph) ORDER BY createdAt ASC");
        $stmt_t->execute($pids);
        foreach ($stmt_t->fetchAll(PDO::FETCH_ASSOC) as $t) {
            $termins_by_proj[$t['projectId']][] = [
                'id'         => $t['id'],
                'name'       => $t['name'],
                'percentage' => $t['percentage'] !== null ? (int)$t['percentage'] : null,
                'nominal'    => $t['nominal'] !== null ? (float)$t['nominal'] : null,
            ];
        }
    }

    $project_options = [];
    foreach ($projects as $p) {
        $pid = $p['id'];
        $ts = $termins_by_proj[$pid] ?? [];
        $max_pct = 0;
        $tot_nom = 0.0;
        foreach ($ts as $t) {
            $pct = (int)($t['percentage'] ?? 0);
            if ($pct > $max_pct) $max_pct = $pct;
            $tot_nom += (float)($t['nominal'] ?? 0);
        }
        $cval = (float)$p['contractValue'];

        $project_options[] = [
            'id'               => $p['id'],
            'code'             => $p['code'],
            'name'             => $p['name'],
            'entityId'         => $p['entityId'],
            'entityKey'        => $p['entity_key'],
            'entityName'       => $p['entity_name'],
            'contractValue'    => $cval,
            'contractValueFmt' => 'Rp ' . number_format($cval, 0, ',', '.'),
            'maxPercentage'    => $max_pct,
            'terminCount'      => count($ts),
            'totalTerminTagih' => $tot_nom,
            'status'           => $p['status'],
            'termins'          => $ts,
        ];
    }

    json_response(['projects' => $project_options]);
}

// ─── GET /api/piutang?entityKey=... ─────────────────────────────────────────
if ($method === 'GET' && $sub_action === null) {
    $entity_key = $_GET['entityKey'] ?? null;
    if (!$entity_key) error_response('entityKey diperlukan.', 400);

    $entity = resolve_entity_by_key($entity_key);
    if (!$entity) error_response('Entitas tidak ditemukan.', 404);

    $entity_id = $entity['id'];
    $pdo       = get_pdo();

    // --- Saldo piutang/hutang antar entitas (akun kode 111-115, 117, 118, 311-315, 317) ---
    $stmt = $pdo->prepare(
        'SELECT c.code, SUM(t.debit) - SUM(t.kredit) AS saldo
         FROM `Transaction` t
         JOIN CoaAccount c ON t.coaAccountId = c.id
         WHERE t.entityId = ?
           AND c.code IN (\'111\',\'112\',\'113\',\'114\',\'115\',\'117\',\'118\',\'311\',\'312\',\'313\',\'314\',\'315\',\'317\')
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
        'SELECT p.id, p.code, p.name, p.entityId, p.contractValue, p.spend, p.deadline, p.status,
                e.`key` AS entity_key, e.name AS entity_name
         FROM Project p
         JOIN Entity e ON p.entityId = e.id
         WHERE p.entityId = ? AND p.status IN (\'ACTIVE\', \'COMPLETED\', \'CANCELLED\')
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

        // Hitung real-time expensesSummary dan breakdownSummary
        $project_details = compute_projects_expenses_and_breakdowns($pdo, $projects);

        // Gabungkan termin, breakdownSummary, dan expensesSummary ke proyek
        foreach ($projects as &$p) {
            $pid = $p['id'];
            $det = $project_details[$pid] ?? null;

            $p['contractValue'] = (float)$p['contractValue'];
            $p['termin']        = $termin_by_project[$pid] ?? [];

            if ($det) {
                $p['expensesSummary']  = $det['expensesSummary'];
                $p['breakdownSummary'] = $det['breakdownSummary'];
                $p['spend']            = (float)$det['expensesSummary']['totalPengeluaran'];

                // Pasangkan breakdown termin
                $t_breakdowns = $det['terminBreakdowns'] ?? [];
                foreach ($p['termin'] as &$t) {
                    $matched_bd = null;
                    if (preg_match('/\[(.*?)\]/', $t['name'], $m)) {
                        $matched_bd = $t_breakdowns[$m[1]] ?? null;
                    }
                    if (!$matched_bd && !empty($t_breakdowns)) {
                        foreach ($t_breakdowns as $bd) {
                            if (abs((float)$bd['gross'] - (float)$t['nominal']) < 1.0) {
                                $matched_bd = $bd;
                                break;
                            }
                        }
                    }
                    $t['breakdown'] = $matched_bd;
                }
                unset($t);

                // Sinkronkan Project.spend di database jika berbeda
                if (abs((float)$p['spend'] - (float)$det['expensesSummary']['totalPengeluaran']) > 0.01) {
                    $pdo->prepare("UPDATE Project SET spend = ? WHERE id = ?")->execute([$det['expensesSummary']['totalPengeluaran'], $pid]);
                }
            } else {
                $p['spend'] = (float)$p['spend'];
                $p['expensesSummary'] = [
                    'totalPengeluaran' => (float)$p['spend'],
                    'totalMaterial'    => 0.0,
                    'totalGaji'        => 0.0,
                    'totalOperasional' => 0.0,
                    'totalPajak'       => 0.0,
                    'totalLainnya'     => (float)$p['spend'],
                    'items'            => [],
                ];
                $p['breakdownSummary'] = null;
            }
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

// ─── GET /api/piutang/laporan-afiliasi?entityId=...&year=... ────────────────
if ($method === 'GET' && $sub_action === 'laporan-afiliasi') {
    $entity_id  = $_GET['entityId']  ?? null;
    $entity_key = $_GET['entityKey'] ?? null;
    $year       = isset($_GET['year']) ? (int)$_GET['year'] : (int)date('Y');

    $pdo = get_pdo();

    if ($entity_id) {
        $stmt = $pdo->prepare('SELECT id, `key`, name FROM Entity WHERE id = ?');
        $stmt->execute([$entity_id]);
        $entity = $stmt->fetch(PDO::FETCH_ASSOC);
    } elseif ($entity_key) {
        $entity = resolve_entity_by_key($entity_key);
    } else {
        error_response('entityId atau entityKey diperlukan.', 400);
    }

    if (!$entity) error_response('Entitas tidak ditemukan.', 404);

    $entity_id  = $entity['id'];
    $start_year = "$year-01-01 00:00:00";
    $end_year   = "$year-12-31 23:59:59";

    $fmt_acct = function(float $n): string {
        if (abs($n) < 0.01) return "Rp -";
        $abs = number_format(abs($n), 0, ',', '.');
        return $n < 0 ? "Rp ($abs)" : "Rp $abs";
    };
    $fmt_std = function(float $n): string {
        return "Rp " . number_format($n, 0, ',', '.');
    };

    $all_cp = [
        ['key' => 'kencana',   'shortName' => 'KAK', 'fullName' => 'Kencana',       'piutangCode' => '111', 'hutangCode' => '311'],
        ['key' => 'gaharu',    'shortName' => 'GS',  'fullName' => 'Gaharu',        'piutangCode' => '112', 'hutangCode' => '312'],
        ['key' => 'tataring',  'shortName' => 'TB',  'fullName' => 'Tataring',      'piutangCode' => '113', 'hutangCode' => '313'],
        ['key' => 'ciptaAsri', 'shortName' => 'CAD', 'fullName' => 'Cipta Asri',    'piutangCode' => '114', 'hutangCode' => '314'],
        ['key' => 'umum',      'shortName' => 'KP',  'fullName' => 'Kardi Pratama', 'piutangCode' => '115', 'hutangCode' => '315'],
    ];
    $counterparties = array_values(array_filter($all_cp, fn($c) => $c['key'] !== $entity['key']));

    if ($entity['key'] === 'kencana' || $entity['key'] === 'gaharu') {
        $counterparties[] = [
            'key' => 'pemegangSaham', 'shortName' => 'PS', 'fullName' => 'Pemegang Saham',
            'piutangCode' => '117', 'hutangCode' => '317', 'isSpecial' => true,
        ];
    }
    $counterparties[] = [
        'key' => 'piutangLainnya', 'shortName' => 'Lainnya', 'fullName' => 'Piutang Lainnya',
        'piutangCode' => '118', 'hutangCode' => '', 'isSpecial' => true,
    ];

    $hutang_codes  = array_values(array_filter(array_column($counterparties, 'hutangCode')));
    $piutang_codes = array_values(array_filter(array_column($counterparties, 'piutangCode')));
    $all_codes     = array_unique(array_merge($hutang_codes, $piutang_codes));

    $ph_codes = implode(',', array_fill(0, count($all_codes), '?'));
    $stmt_c = $pdo->prepare("SELECT id, code, name FROM CoaAccount WHERE code IN ($ph_codes)");
    $stmt_c->execute($all_codes);
    $coa_rows = $stmt_c->fetchAll(PDO::FETCH_ASSOC);

    $coa_by_code = [];
    $coa_ids     = [];
    foreach ($coa_rows as $c) {
        $coa_by_code[$c['code']] = $c;
        $coa_ids[]               = $c['id'];
    }

    $sa_map      = [];
    $cur_tx_map  = [];
    $prev_tx_map = [];

    if (!empty($coa_ids)) {
        $ph_ids = implode(',', array_fill(0, count($coa_ids), '?'));
        $stmt_sa = $pdo->prepare(
            "SELECT coaAccountId, COALESCE(nominal, 0) AS nominal
             FROM SaldoAwal WHERE entityId = ? AND year = ? AND coaAccountId IN ($ph_ids)"
        );
        $stmt_sa->execute(array_merge([$entity_id, $year], $coa_ids));
        foreach ($stmt_sa->fetchAll(PDO::FETCH_ASSOC) as $sa) {
            $sa_map[$sa['coaAccountId']] = (float)$sa['nominal'];
        }

        $stmt_cur = $pdo->prepare(
            "SELECT coaAccountId, COALESCE(SUM(debit), 0) AS debit, COALESCE(SUM(kredit), 0) AS kredit
             FROM `Transaction`
             WHERE entityId = ? AND tanggal BETWEEN ? AND ? AND coaAccountId IN ($ph_ids)
               AND (extraFieldsJson IS NULL OR JSON_VALUE(extraFieldsJson, '$.autoPostedFromJurnal') IS NULL OR JSON_VALUE(extraFieldsJson, '$.autoPostedFromJurnal') != 'true')
             GROUP BY coaAccountId"
        );
        $stmt_cur->execute(array_merge([$entity_id, $start_year, $end_year], $coa_ids));
        foreach ($stmt_cur->fetchAll(PDO::FETCH_ASSOC) as $tx) {
            $cur_tx_map[$tx['coaAccountId']] = ['debit' => (float)$tx['debit'], 'kredit' => (float)$tx['kredit']];
        }

        $stmt_prev = $pdo->prepare(
            "SELECT coaAccountId, COALESCE(SUM(debit), 0) AS debit, COALESCE(SUM(kredit), 0) AS kredit
             FROM `Transaction`
             WHERE entityId = ? AND tanggal < ? AND coaAccountId IN ($ph_ids)
               AND (extraFieldsJson IS NULL OR JSON_VALUE(extraFieldsJson, '$.autoPostedFromJurnal') IS NULL OR JSON_VALUE(extraFieldsJson, '$.autoPostedFromJurnal') != 'true')
             GROUP BY coaAccountId"
        );
        $stmt_prev->execute(array_merge([$entity_id, $start_year], $coa_ids));
        foreach ($stmt_prev->fetchAll(PDO::FETCH_ASSOC) as $tx) {
            $prev_tx_map[$tx['coaAccountId']] = ['debit' => (float)$tx['debit'], 'kredit' => (float)$tx['kredit']];
        }
    }

    $hutang_rows          = [];
    $sum_hutang_lalu      = 0.0;
    $sum_hutang_tahun_ini = 0.0;
    $sum_total_hutang     = 0.0;

    foreach ($counterparties as $cp) {
        if (empty($cp['hutangCode'])) continue;
        $c           = $coa_by_code[$cp['hutangCode']] ?? null;
        $c_id        = $c['id'] ?? null;
        $h_lalu      = 0.0;
        $h_tahun_ini = 0.0;

        if ($c_id) {
            if (isset($sa_map[$c_id])) {
                $h_lalu = $sa_map[$c_id];
            } else {
                $p      = $prev_tx_map[$c_id] ?? ['debit' => 0.0, 'kredit' => 0.0];
                $h_lalu = $p['kredit'] - $p['debit'];
            }
            $cur         = $cur_tx_map[$c_id] ?? ['debit' => 0.0, 'kredit' => 0.0];
            $h_tahun_ini = $cur['kredit'] - $cur['debit'];
        }

        // Crossing check
        $stmt_c1 = $pdo->prepare(
            "SELECT coaAccountId, debit, kredit, extraFieldsJson FROM `Transaction`
             WHERE entityId = ? AND tanggal BETWEEN ? AND ? AND JSON_VALUE(extraFieldsJson, '$.crossingFromEntityKey') = ?"
        );
        $stmt_c1->execute([$entity_id, $start_year, $end_year, $cp['key']]);
        foreach ($stmt_c1->fetchAll(PDO::FETCH_ASSOC) as $ec) {
            if ($ec['coaAccountId'] !== $c_id) {
                $extra = $ec['extraFieldsJson'] ? json_decode($ec['extraFieldsJson'], true) : [];
                if (($extra['crossingRole'] ?? '') === 'HUTANG' || (empty($extra['crossingRole']) && (float)$ec['kredit'] > 0)) {
                    $h_tahun_ini += ((float)$ec['kredit'] - (float)$ec['debit']);
                }
            }
        }

        $stmt_c2 = $pdo->prepare(
            "SELECT coaAccountId, debit, kredit, extraFieldsJson FROM `Transaction`
             WHERE entityId = ? AND tanggal < ? AND JSON_VALUE(extraFieldsJson, '$.crossingFromEntityKey') = ?"
        );
        $stmt_c2->execute([$entity_id, $start_year, $cp['key']]);
        foreach ($stmt_c2->fetchAll(PDO::FETCH_ASSOC) as $ec) {
            if ($ec['coaAccountId'] !== $c_id) {
                $extra = $ec['extraFieldsJson'] ? json_decode($ec['extraFieldsJson'], true) : [];
                if (($extra['crossingRole'] ?? '') === 'HUTANG' || (empty($extra['crossingRole']) && (float)$ec['kredit'] > 0)) {
                    $h_lalu += ((float)$ec['kredit'] - (float)$ec['debit']);
                }
            }
        }

        $total_h               = $h_lalu + $h_tahun_ini;
        $sum_hutang_lalu      += $h_lalu;
        $sum_hutang_tahun_ini += $h_tahun_ini;
        $sum_total_hutang     += $total_h;

        $hutang_rows[] = [
            'counterpartyKey'   => $cp['key'],
            'shortName'         => $cp['shortName'],
            'fullName'          => $cp['fullName'],
            'code'              => $cp['hutangCode'],
            'accountName'       => $c['name'] ?? ('Hutang ' . $cp['shortName']),
            'hutangLalu'        => $h_lalu,
            'hutangLaluFmt'     => $fmt_acct($h_lalu),
            'hutangTahunIni'    => $h_tahun_ini,
            'hutangTahunIniFmt' => $fmt_acct($h_tahun_ini),
            'totalHutang'       => $total_h,
            'totalHutangFmt'    => $fmt_acct($total_h),
        ];
    }

    $piutang_rows      = [];
    $sum_piutang_lalu  = 0.0;
    $sum_perubahan     = 0.0;
    $sum_total_piutang = 0.0;

    foreach ($counterparties as $cp) {
        if (empty($cp['piutangCode'])) continue;
        $c           = $coa_by_code[$cp['piutangCode']] ?? null;
        $c_id        = $c['id'] ?? null;
        $p_lalu      = 0.0;
        $p_tahun_ini = 0.0;

        if ($c_id) {
            if (isset($sa_map[$c_id])) {
                $p_lalu = $sa_map[$c_id];
            } else {
                $p      = $prev_tx_map[$c_id] ?? ['debit' => 0.0, 'kredit' => 0.0];
                $p_lalu = $p['debit'] - $p['kredit'];
            }
            $cur         = $cur_tx_map[$c_id] ?? ['debit' => 0.0, 'kredit' => 0.0];
            $p_tahun_ini = $cur['debit'] - $cur['kredit'];
        }

        $total_p            = $p_lalu + $p_tahun_ini;
        $sum_piutang_lalu  += $p_lalu;
        $sum_perubahan     += $p_tahun_ini;
        $sum_total_piutang += $total_p;

        $piutang_rows[] = [
            'counterpartyKey'   => $cp['key'],
            'shortName'         => $cp['shortName'],
            'fullName'          => $cp['fullName'],
            'code'              => $cp['piutangCode'],
            'accountName'       => $c['name'] ?? ('PIUTANG ' . $cp['shortName']),
            'piutangLalu'       => $p_lalu,
            'piutangLaluFmt'    => $fmt_acct($p_lalu),
            'piutangBerjalan'   => $total_p,
            'piutangBerjalanFmt'=> $fmt_acct($total_p),
            'perubahan'         => $p_tahun_ini,
            'perubahanFmt'      => $fmt_acct($p_tahun_ini),
            'piutang'           => $total_p,
            'piutangFmt'        => $fmt_acct($total_p),
        ];
    }

    $netting_rows      = [];
    $total_net_piutang = 0.0;
    $total_net_utang   = 0.0;

    foreach ($counterparties as $cp) {
        $h_row = null;
        foreach ($hutang_rows as $hr) { if ($hr['counterpartyKey'] === $cp['key']) { $h_row = $hr; break; } }
        $p_row = null;
        foreach ($piutang_rows as $pr) { if ($pr['counterpartyKey'] === $cp['key']) { $p_row = $pr; break; } }

        $p_val = $p_row['piutang'] ?? 0.0;
        $h_val = $h_row['totalHutang'] ?? 0.0;
        $net   = $p_val - $h_val;

        $status      = 'NIHIL';
        $neraca_pos  = 'Tidak Masuk Neraca (Saling Hapus)';
        $neraca_code = '-';

        if ($net > 0) {
            $status            = 'PIUTANG';
            $neraca_pos        = "Aktiva Lancar (Akun {$cp['piutangCode']})";
            $neraca_code       = $cp['piutangCode'];
            $total_net_piutang += $net;
        } elseif ($net < 0) {
            $status            = 'UTANG';
            $neraca_pos        = "Kewajiban (Akun {$cp['hutangCode']})";
            $neraca_code       = $cp['hutangCode'];
            $total_net_utang   += abs($net);
        }

        $sa_net = ($p_row['piutangLalu'] ?? 0.0) - ($h_row['hutangLalu'] ?? 0.0);
        $pen_p  = $p_row['perubahan'] ?? 0.0;
        $pen_h  = $h_row['hutangTahunIni'] ?? 0.0;

        $netting_rows[] = [
            'counterpartyKey'     => $cp['key'],
            'shortName'           => $cp['shortName'],
            'fullName'            => $cp['fullName'],
            'status'              => $status,
            'saldoAwalNet'        => $sa_net,
            'saldoAwalNetFmt'     => $fmt_acct($sa_net),
            'penambahanPiutang'   => $pen_p,
            'penambahanPiutangFmt'=> $fmt_acct($pen_p),
            'penambahanHutang'    => $pen_h,
            'penambahanHutangFmt' => $fmt_acct($pen_h),
            'piutang'             => $p_val,
            'piutangFmt'          => $fmt_acct($p_val),
            'hutang'              => $h_val,
            'hutangFmt'           => $fmt_acct($h_val),
            'net'                 => $net,
            'netFmt'              => $fmt_acct($net),
            'absNet'              => abs($net),
            'absNetFmt'           => $fmt_acct(abs($net)),
            'isUtang'             => $net < 0,
            'neracaPosition'      => $neraca_pos,
            'neracaAccountCode'   => $neraca_code,
        ];
    }

    $posisi_bersih_global = $sum_total_piutang - $sum_total_hutang;
    $status_global        = $posisi_bersih_global > 0 ? 'PIUTANG' : ($posisi_bersih_global < 0 ? 'UTANG' : 'NIHIL');

    // ── Chronological Transactions (Buku Pembantu Afiliasi) ─────────────────
    $chrono_txs = [];
    if (!empty($coa_ids)) {
        $ph_ids = implode(',', array_fill(0, count($coa_ids), '?'));
        $stmt_raw = $pdo->prepare(
            "SELECT t.id, t.tanggal, t.noBukti, t.keterangan, t.debit, t.kredit, t.extraFieldsJson,
                    c.code AS coa_code, c.name AS coa_name, c.kategori AS coa_kategori,
                    p.name AS project_name, p.code AS project_code
             FROM `Transaction` t
             LEFT JOIN CoaAccount c ON t.coaAccountId = c.id
             LEFT JOIN Project p ON t.projectId = p.id
             WHERE t.entityId = ? AND t.tanggal BETWEEN ? AND ?
               AND (
                 (t.coaAccountId IN ($ph_ids))
                 OR JSON_VALUE(t.extraFieldsJson, '$.isCrossingEntry') = 'true'
               )
             ORDER BY t.tanggal ASC, t.createdAt ASC, t.id ASC
             LIMIT 200"
        );
        $stmt_raw->execute(array_merge([$entity_id, $start_year, $end_year], $coa_ids));
        $raw_tx = $stmt_raw->fetchAll(PDO::FETCH_ASSOC);

        // Pre-fetch related counterpart transactions across all entities
        $crossing_ids = [];
        $no_buktis    = [];
        foreach ($raw_tx as $rtx) {
            $x = $rtx['extraFieldsJson'] ? json_decode($rtx['extraFieldsJson'], true) : [];
            if (!empty($x['crossingGroupId'])) {
                $crossing_ids[$x['crossingGroupId']] = true;
            }
            if (!empty($rtx['noBukti'])) {
                $no_buktis[$rtx['noBukti']] = true;
            }
        }
        $crossing_ids = array_keys($crossing_ids);
        $no_buktis    = array_keys($no_buktis);

        $related_by_group = [];
        $related_by_bukti = [];

        if (!empty($crossing_ids) || !empty($no_buktis)) {
            $where_parts = [];
            $binds       = [];
            if (!empty($crossing_ids)) {
                $ph            = implode(',', array_fill(0, count($crossing_ids), '?'));
                $where_parts[] = "JSON_VALUE(t.extraFieldsJson, '$.crossingGroupId') IN ($ph)";
                $binds         = array_merge($binds, $crossing_ids);
            }
            if (!empty($no_buktis)) {
                $ph            = implode(',', array_fill(0, count($no_buktis), '?'));
                $where_parts[] = "(t.noBukti IN ($ph) AND t.tanggal BETWEEN ? AND ?)";
                $binds         = array_merge($binds, $no_buktis, [$start_year, $end_year]);
            }
            $where_sql = implode(' OR ', $where_parts);
            $stmt_rel  = $pdo->prepare(
                "SELECT t.id, t.entityId, e.key AS entityKey, e.name AS entityName,
                        t.noBukti, t.keterangan, t.debit, t.kredit, t.extraFieldsJson,
                        c.code AS coa_code, c.name AS coa_name, c.kategori AS coa_kategori,
                        p.name AS projectName, p.code AS projectCode,
                        JSON_VALUE(t.extraFieldsJson, '$.crossingGroupId') AS crossing_group_id,
                        JSON_VALUE(t.extraFieldsJson, '$.isKasEntry') AS is_kas_entry,
                        JSON_VALUE(t.extraFieldsJson, '$.rekeningNama') AS rekening_nama,
                        JSON_VALUE(t.extraFieldsJson, '$.crossingRole') AS crossing_role,
                        JSON_VALUE(t.extraFieldsJson, '$.isCrossingEntry') AS is_crossing_entry
                 FROM `Transaction` t
                 JOIN Entity e ON t.entityId = e.id
                 LEFT JOIN CoaAccount c ON t.coaAccountId = c.id
                 LEFT JOIN Project p ON t.projectId = p.id
                 WHERE $where_sql
                 ORDER BY t.id ASC"
            );
            $stmt_rel->execute($binds);
            foreach ($stmt_rel->fetchAll(PDO::FETCH_ASSOC) as $r) {
                if (!empty($r['crossing_group_id'])) {
                    $related_by_group[$r['crossing_group_id']][] = $r;
                }
                if (!empty($r['noBukti'])) {
                    $related_by_bukti[$r['noBukti']][] = $r;
                }
            }
        }

        $short_name_map = [
            'kencana'   => 'KAK',
            'gaharu'    => 'GS',
            'tataring'  => 'TB',
            'ciptaAsri' => 'CAD',
            'umum'      => 'KP',
        ];

        $cp_running = [];
        foreach ($netting_rows as $nr) {
            $cp_running[$nr['counterpartyKey']] = $nr['saldoAwalNet'];
        }
        $global_running = $sum_piutang_lalu - $sum_hutang_lalu;

        foreach ($raw_tx as $t) {
            $coa_code = $t['coa_code'] ?? '';
            $extra    = $t['extraFieldsJson'] ? json_decode($t['extraFieldsJson'], true) : [];

            $cp           = null;
            $account_type = 'PIUTANG';
            $coa_name     = $t['coa_name'] ?? '';
            $display_code = $coa_code;

            if (!empty($extra['crossingFromEntityKey'])) {
                $from_key = (string)$extra['crossingFromEntityKey'];
                foreach ($counterparties as $c) { if ($c['key'] === $from_key) { $cp = $c; break; } }
                $account_type = 'HUTANG';
                if (($extra['crossingRole'] ?? '') !== 'HUTANG' && (float)$t['debit'] > 0) continue;
                $display_code = $coa_code ?: ($extra['originalHutangCoaCode'] ?? '-');
                $coa_name     = in_array($coa_code, $hutang_codes) ? $coa_name : "Hutang Afiliasi ({$from_key})";
            } elseif (in_array($coa_code, $hutang_codes) || in_array($coa_code, $piutang_codes)) {
                $account_type = in_array($coa_code, $hutang_codes) ? 'HUTANG' : 'PIUTANG';
                foreach ($counterparties as $c) {
                    if ($account_type === 'HUTANG' ? $c['hutangCode'] === $coa_code : $c['piutangCode'] === $coa_code) {
                        $cp = $c;
                        break;
                    }
                }
            } else {
                continue;
            }

            if (!$cp) continue;

            $debit          = (float)$t['debit'];
            $kredit         = (float)$t['kredit'];
            $nominal_mutasi = $debit - $kredit;
            $efek_saldo     = $nominal_mutasi >= 0 ? 'TAMBAH' : 'KURANG';

            $prev_bal               = $cp_running[$cp['key']] ?? 0.0;
            $new_bal                = $prev_bal + $nominal_mutasi;
            $cp_running[$cp['key']] = $new_bal;
            $global_running        += $nominal_mutasi;

            // Resolve counterpart relations
            $cr_grp_id = $extra['crossingGroupId'] ?? null;
            $rel_rows  = [];
            if (!empty($cr_grp_id) && isset($related_by_group[$cr_grp_id])) {
                $rel_rows = $related_by_group[$cr_grp_id];
            } elseif (!empty($t['noBukti']) && isset($related_by_bukti[$t['noBukti']])) {
                $rel_rows = $related_by_bukti[$t['noBukti']];
            }

            $local_rows = [];
            $cp_rows    = [];
            foreach ($rel_rows as $rr) {
                if ($rr['entityId'] === $entity_id) {
                    $local_rows[] = $rr;
                } else {
                    $cp_rows[] = $rr;
                }
            }

            // 1. Resolve sumberPengeluaran
            $sumber = null;
            if ($account_type === 'PIUTANG') {
                foreach ($local_rows as $lr) {
                    if ((float)$lr['kredit'] > 0 && ($lr['id'] !== $t['id'])) {
                        $is_kas = !empty($lr['is_kas_entry']) || ($lr['coa_kategori'] ?? '') === 'ASET' || in_array(substr($lr['coa_code'] ?? '', 0, 1), ['1', '2']);
                        if ($is_kas) {
                            $nama_lengkap = $lr['coa_name'];
                            if (!empty($lr['rekening_nama']) && $lr['rekening_nama'] !== $lr['coa_name']) {
                                $nama_lengkap = "{$lr['rekening_nama']} ({$lr['coa_name']})";
                            }
                            $sumber = [
                                'coaCode'         => $lr['coa_code'],
                                'coaName'         => $lr['coa_name'],
                                'namaLengkap'     => $nama_lengkap,
                                'rekeningNama'    => $lr['rekening_nama'] ?? null,
                                'entityKey'       => $entity['key'],
                                'entityName'      => $entity['name'],
                                'entityShortName' => $short_name_map[$entity['key']] ?? $entity['name'],
                            ];
                            break;
                        }
                    }
                }
                if (!$sumber && !empty($extra['rekeningNama'])) {
                    $sumber = [
                        'coaCode'         => $coa_code,
                        'coaName'         => $extra['rekeningNama'],
                        'namaLengkap'     => $extra['rekeningNama'],
                        'rekeningNama'    => $extra['rekeningNama'],
                        'entityKey'       => $entity['key'],
                        'entityName'      => $entity['name'],
                        'entityShortName' => $short_name_map[$entity['key']] ?? $entity['name'],
                    ];
                }
            } else {
                foreach ($cp_rows as $cpr) {
                    if ($cpr['entityKey'] !== $cp['key']) continue;
                    if ((float)$cpr['kredit'] > 0) {
                        $is_kas = !empty($cpr['is_kas_entry']) || ($cpr['coa_kategori'] ?? '') === 'ASET' || in_array(substr($cpr['coa_code'] ?? '', 0, 1), ['1', '2']);
                        if ($is_kas) {
                            $nama_lengkap = $cpr['coa_name'];
                            if (!empty($cpr['rekening_nama']) && $cpr['rekening_nama'] !== $cpr['coa_name']) {
                                $nama_lengkap = "{$cpr['rekening_nama']} ({$cpr['coa_name']})";
                            }
                            $sumber = [
                                'coaCode'         => $cpr['coa_code'],
                                'coaName'         => $cpr['coa_name'],
                                'namaLengkap'     => $nama_lengkap,
                                'rekeningNama'    => $cpr['rekening_nama'] ?? null,
                                'entityKey'       => $cpr['entityKey'],
                                'entityName'      => $cpr['entityName'],
                                'entityShortName' => $short_name_map[$cpr['entityKey']] ?? $cp['shortName'] ?? $cpr['entityName'],
                            ];
                            break;
                        }
                    }
                }
                if (!$sumber && (!empty($extra['crossingFromRekeningNama']) || !empty($extra['crossingFromJenisInputKey']))) {
                    $rek_nama = $extra['crossingFromRekeningNama'] ?: ($extra['crossingFromJenisInputKey'] === 'kasKecil' ? 'Kas Kecil' : 'Kas/Bank');
                    $sumber = [
                        'coaCode'         => '-',
                        'coaName'         => $rek_nama,
                        'namaLengkap'     => "$rek_nama ({$cp['fullName']})",
                        'rekeningNama'    => $extra['crossingFromRekeningNama'] ?? null,
                        'entityKey'       => $cp['key'],
                        'entityName'      => $cp['fullName'],
                        'entityShortName' => $cp['shortName'],
                    ];
                }
            }

            // 2. Resolve alokasiPenggunaan
            $alokasi = [];
            if ($account_type === 'PIUTANG') {
                foreach ($cp_rows as $cpr) {
                    if ($cpr['entityKey'] !== $cp['key']) continue;
                    $cpr_debit = (float)$cpr['debit'];
                    if ($cpr_debit > 0) {
                        $kat    = strtoupper($cpr['coa_kategori'] ?? '');
                        $c_code = (string)($cpr['coa_code'] ?? '');
                        $c_nm   = (string)($cpr['coa_name'] ?? '');
                        $role   = 'LAINNYA';
                        if ($kat === 'BEBAN' || substr($c_code, 0, 1) === '5' || substr($c_code, 0, 1) === '6') {
                            $role = 'BEBAN';
                        } elseif (!empty($cpr['is_kas_entry']) || $kat === 'KAS' || stripos($c_nm, 'Kas') !== false || stripos($c_nm, 'Bank') !== false) {
                            $role = 'KAS';
                        } elseif (in_array($c_code, $hutang_codes) || stripos($c_nm, 'Hutang') !== false) {
                            $role = 'HUTANG';
                        } elseif (in_array($c_code, $piutang_codes) || stripos($c_nm, 'Piutang') !== false) {
                            $role = 'PIUTANG';
                        }

                        $ket_alk = trim($cpr['keterangan'] ?? '');
                        if (!empty($cpr['projectName'])) {
                            $proj_badge = "[{$cpr['projectCode']}] {$cpr['projectName']}";
                            $ket_alk    = $ket_alk ? "$proj_badge • $ket_alk" : "Proyek: $proj_badge";
                        }

                        $alokasi[] = [
                            'entityKey'       => $cpr['entityKey'],
                            'entityName'      => $cpr['entityName'],
                            'entityShortName' => $short_name_map[$cpr['entityKey']] ?? $cp['shortName'] ?? $cpr['entityName'],
                            'coaCode'         => $cpr['coa_code'],
                            'coaName'         => $cpr['coa_name'] . (!empty($cpr['projectCode']) ? " ({$cpr['projectCode']})" : ''),
                            'nominal'         => $cpr_debit,
                            'nominalFmt'      => $fmt_std($cpr_debit),
                            'keterangan'      => $ket_alk,
                            'role'            => $role,
                        ];
                    }
                }
            } else {
                foreach ($local_rows as $lr) {
                    $lr_debit = (float)$lr['debit'];
                    if ($lr_debit > 0 && ($lr['id'] !== $t['id'])) {
                        $kat    = strtoupper($lr['coa_kategori'] ?? '');
                        $c_code = (string)($lr['coa_code'] ?? '');
                        $c_nm   = (string)($lr['coa_name'] ?? '');
                        $role   = 'LAINNYA';
                        if ($kat === 'BEBAN' || substr($c_code, 0, 1) === '5' || substr($c_code, 0, 1) === '6') {
                            $role = 'BEBAN';
                        } elseif (!empty($lr['is_kas_entry']) || $kat === 'KAS' || stripos($c_nm, 'Kas') !== false || stripos($c_nm, 'Bank') !== false) {
                            $role = 'KAS';
                        } elseif (in_array($c_code, $hutang_codes) || stripos($c_nm, 'Hutang') !== false) {
                            $role = 'HUTANG';
                        } elseif (in_array($c_code, $piutang_codes) || stripos($c_nm, 'Piutang') !== false) {
                            $role = 'PIUTANG';
                        }

                        $ket_alk = trim($lr['keterangan'] ?? '');
                        if (!empty($lr['projectName'])) {
                            $proj_badge = "[{$lr['projectCode']}] {$lr['projectName']}";
                            $ket_alk    = $ket_alk ? "$proj_badge • $ket_alk" : "Proyek: $proj_badge";
                        }

                        $alokasi[] = [
                            'entityKey'       => $entity['key'],
                            'entityName'      => $entity['name'],
                            'entityShortName' => $short_name_map[$entity['key']] ?? $entity['name'],
                            'coaCode'         => $lr['coa_code'],
                            'coaName'         => $lr['coa_name'] . (!empty($lr['projectCode']) ? " ({$lr['projectCode']})" : ''),
                            'nominal'         => $lr_debit,
                            'nominalFmt'      => $fmt_std($lr_debit),
                            'keterangan'      => $ket_alk,
                            'role'            => $role,
                        ];
                    }
                }
            }

            // Fallback alokasi from extra itemDescription if empty
            if (empty($alokasi) && !empty($extra['itemDescription'])) {
                $alokasi[] = [
                    'entityKey'       => $cp['key'],
                    'entityName'      => $cp['fullName'],
                    'entityShortName' => $cp['shortName'],
                    'coaCode'         => '-',
                    'coaName'         => $extra['itemDescription'],
                    'nominal'         => abs($nominal_mutasi),
                    'nominalFmt'      => $fmt_std(abs($nominal_mutasi)),
                    'keterangan'      => $extra['itemDescription'],
                    'role'            => 'BEBAN',
                ];
            }

            // Build narrative and description (1:1 dengan develop:src/lib/laporan-hutang-piutang.ts)
            $clean_ket   = trim($t['keterangan'] ?? '');
            $first_alloc = !empty($alokasi) ? $alokasi[0] : null;
            $alloc_suffix = ($first_alloc && !empty($first_alloc['coaCode']) && $first_alloc['coaCode'] !== '-')
                ? " (Akun {$first_alloc['coaCode']} {$first_alloc['coaName']})"
                : "";

            if ($account_type === 'HUTANG') {
                if ($sumber) {
                    if (($first_alloc['role'] ?? '') === 'KAS') {
                        $narasi = "Penerimaan kas ke {$first_alloc['coaName']}{$alloc_suffix} di {$entity['name']} menggunakan dana {$sumber['coaName']} (Akun {$sumber['coaCode']}) dari {$sumber['entityName']}";
                    } else {
                        $base_ket = $clean_ket ?: 'Pengeluaran operasional';
                        $narasi = "{$base_ket} di {$entity['name']}{$alloc_suffix} menggunakan {$sumber['coaName']} (Akun {$sumber['coaCode']}) dari {$sumber['entityName']}";
                    }
                } else {
                    $base_ket = $clean_ket ?: 'Kewajiban hutang';
                    $narasi = "{$base_ket} di {$entity['name']} dari {$cp['fullName']}";
                }
            } else {
                if ($sumber) {
                    $dest_entity = $first_alloc['entityName'] ?? $cp['fullName'];
                    if (($first_alloc['role'] ?? '') === 'KAS') {
                        $narasi = "Penyaluran dana {$sumber['coaName']} (Akun {$sumber['coaCode']}) dari {$entity['name']} masuk ke {$first_alloc['coaName']}{$alloc_suffix} di {$dest_entity}";
                    } else {
                        $base_ket = $clean_ket ?: 'keperluan operasional';
                        $narasi = "Pengeluaran {$sumber['coaName']} (Akun {$sumber['coaCode']}) dari {$entity['name']} digunakan untuk {$base_ket} di {$dest_entity}{$alloc_suffix}";
                    }
                } else {
                    $base_ket = $clean_ket ?: 'Pinjaman / talangan dana';
                    $narasi = "Hak tagih piutang kepada {$cp['fullName']}: {$base_ket}";
                }
            }

            $display_ket = $clean_ket;
            if (($clean_ket === 'Pengeluaran' || $clean_ket === 'Penerimaan' || empty($clean_ket)) && !empty($alokasi)) {
                $first_alk   = $alokasi[0];
                $display_ket = "Pengeluaran ({$first_alk['coaName']})";
            }

            $chrono_txs[] = [
                'id'                   => $t['id'],
                'tanggal'              => date('d M Y', strtotime($t['tanggal'])),
                'tanggalRaw'           => date('c', strtotime($t['tanggal'])),
                'noBukti'              => $t['noBukti'] ?? '',
                'keterangan'           => $display_ket,
                'counterpartyKey'      => $cp['key'],
                'counterpartyName'     => $cp['fullName'],
                'counterpartyShortName'=> $cp['shortName'],
                'accountType'          => $account_type,
                'efekSaldo'            => $efek_saldo,
                'coaCode'              => $display_code,
                'coaName'              => $coa_name,
                'debit'                => $debit,
                'kredit'               => $kredit,
                'debitFmt'             => $fmt_std($debit),
                'kreditFmt'            => $fmt_std($kredit),
                'nominalMutasi'        => $nominal_mutasi,
                'nominalMutasiFmt'     => $fmt_std(abs($nominal_mutasi)),
                'saldoAkhir'           => $new_bal,
                'saldoAkhirFmt'        => $fmt_acct($new_bal),
                'saldoAkhirGlobal'     => $global_running,
                'saldoAkhirGlobalFmt'  => $fmt_acct($global_running),
                'narasiAlur'           => $narasi,
                'sumberPengeluaran'    => $sumber,
                'alokasiPenggunaan'    => $alokasi,
            ];
        }
    }

    $paged_txs = array_slice(array_reverse($chrono_txs), 0, 100);

    json_response([
        'entity' => [
            'id'   => $entity['id'],
            'key'  => $entity['key'],
            'name' => $entity['name'],
        ],
        'year' => $year,
        'rekapHutang' => [
            'rows'                   => $hutang_rows,
            'totalHutangLalu'        => $sum_hutang_lalu,
            'totalHutangLaluFmt'     => $fmt_acct($sum_hutang_lalu),
            'totalHutangTahunIni'    => $sum_hutang_tahun_ini,
            'totalHutangTahunIniFmt' => $fmt_acct($sum_hutang_tahun_ini),
            'totalHutang'            => $sum_total_hutang,
            'totalHutangFmt'         => $fmt_acct($sum_total_hutang),
        ],
        'rekapPiutang' => [
            'rows'               => $piutang_rows,
            'totalPiutangLalu'   => $sum_piutang_lalu,
            'totalPiutangLaluFmt'=> $fmt_acct($sum_piutang_lalu),
            'totalPerubahan'     => $sum_perubahan,
            'totalPerubahanFmt'  => $fmt_acct($sum_perubahan),
            'totalPiutang'       => $sum_total_piutang,
            'totalPiutangFmt'    => $fmt_acct($sum_total_piutang),
        ],
        'netting' => [
            'rows'                  => $netting_rows,
            'totalNetPiutang'       => $total_net_piutang,
            'totalNetUtang'         => $total_net_utang,
            'posisiBersihGlobal'    => $posisi_bersih_global,
            'posisiBersihGlobalFmt' => $fmt_acct($posisi_bersih_global),
            'statusGlobal'          => $status_global,
        ],
        'transactions' => $paged_txs,
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
