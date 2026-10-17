<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

require_once __DIR__ . '/kas-helpers.php';

/**
 * Realisasi faktur pendapatan dari Jurnal Umum / Kas Masuk,
 * dengan fallback ke input manual di FakturPendapatan bila belum ada transaksi jurnal.
 * Logika 1:1 dengan extractJurnalDataForFaktur() di src/lib/pendapatan.ts
 */
function get_faktur_realisasi_map(PDO $pdo, string $entity_id, array $fakturs): array {
    if (empty($fakturs)) return [];

    $all_faktur_ids = array_values(array_filter(array_column($fakturs, 'id')));
    $all_no_fakturs = array_values(array_unique(array_filter(array_map('trim', array_column($fakturs, 'noFaktur')))));

    $where_clauses = ['t.entityId = ?'];
    $params = [$entity_id];

    $or_sub = [];
    if (!empty($all_faktur_ids)) {
        $ph = implode(',', array_fill(0, count($all_faktur_ids), '?'));
        $or_sub[] = "t.fakturId IN ($ph)";
        $params = array_merge($params, $all_faktur_ids);
    }
    if (!empty($all_no_fakturs)) {
        $ph = implode(',', array_fill(0, count($all_no_fakturs), '?'));
        $or_sub[] = "t.noBukti IN ($ph)";
        $params = array_merge($params, $all_no_fakturs);

        foreach ($all_no_fakturs as $nf) {
            $or_sub[] = "t.noBukti LIKE ?";
            $params[] = $nf . '%';
            $or_sub[] = "t.keterangan LIKE ?";
            $params[] = '%' . $nf . '%';
        }
    }

    if (!empty($or_sub)) {
        $where_clauses[] = '(' . implode(' OR ', $or_sub) . ')';
    }

    $sql = "SELECT t.id, t.fakturId, t.noBukti, t.keterangan, t.projectId, t.tanggal,
                   COALESCE(t.debit, 0) AS debit, COALESCE(t.kredit, 0) AS kredit,
                   t.extraFieldsJson, c.code AS coa_code, c.name AS coa_name, c.kategori AS coa_kategori
            FROM `Transaction` t
            LEFT JOIN CoaAccount c ON t.coaAccountId = c.id
            WHERE " . implode(' AND ', $where_clauses) . "
            ORDER BY t.tanggal ASC, t.id ASC";

    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $all_transactions = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Filter mirror autoPosted transaksi jurnal/faktur agar tidak dobel hitung
    $clean_transactions = [];
    foreach ($all_transactions as $tx) {
        $extra = !empty($tx['extraFieldsJson']) ? json_decode($tx['extraFieldsJson'], true) : [];
        if (!empty($extra['autoPostedFromJurnal']) || !empty($extra['autoPostedFromFaktur'])) {
            continue;
        }
        $clean_transactions[] = $tx;
    }
    $tx_pool = !empty($clean_transactions) ? $clean_transactions : $all_transactions;

    $result = [];
    $claimed_tx_ids = [];

    // Helper kalkulasi realisasi dari sekumpulan baris transaksi
    $compute_realisasi = function(array $matches, array $f) {
        $total_bank_debit = 0.0;
        $total_ppn_debit  = 0.0;
        $total_pph_debit  = 0.0;
        $bank_name        = null;

        foreach ($matches as $tx) {
            $d = (float)$tx['debit'];
            if ($d <= 0) continue;

            $c_name = strtolower($tx['coa_name'] ?? '');
            $c_code = $tx['coa_code'] ?? '';
            $c_kat  = $tx['coa_kategori'] ?? '';

            if ($c_kat === 'ASET' || preg_match('/bank|kas|bpd|bri|bni|mandiri/i', $c_name)) {
                $total_bank_debit += $d;
                if (!$bank_name) $bank_name = $tx['coa_name'] ?: ($f['bank'] ?? 'Bank');
            }

            if ($c_code === '535' || $c_code === '536' || preg_match('/ppn/i', $c_name)) {
                $total_ppn_debit += $d;
            }

            if (in_array($c_code, ['532', '533', '534']) || preg_match('/pph/i', $c_name)) {
                $total_pph_debit += $d;
            }
        }

        $has_receipt = ($total_bank_debit > 0 || $total_ppn_debit > 0 || $total_pph_debit > 0);
        if (!$has_receipt) return null;

        $earliest_date = !empty($matches[0]['tanggal']) ? substr($matches[0]['tanggal'], 0, 10) : ($f['tanggalTerima'] ?? null);

        return [
            'isRealized'           => true,
            'nominalDiterima'      => $total_bank_debit > 0 ? $total_bank_debit : (float)($f['nominalDiterima'] ?? 0),
            'ppn'                  => $total_ppn_debit > 0 ? $total_ppn_debit : (float)($f['ppn'] ?? 0),
            'pph'                  => $total_pph_debit > 0 ? $total_pph_debit : (float)($f['pph'] ?? 0),
            'tanggalTerima'        => $earliest_date,
            'bank'                 => $bank_name ?: ($f['bank'] ?? 'Bank'),
            'matchedJurnalNoBukti' => $matches[0]['noBukti'] ?? null,
        ];
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // PASS 1: Explicit fakturId match (Prioritas Utama & Bersifat Eksklusif)
    // Transaksi yang memiliki fakturId HANYA boleh dicocokkan dengan faktur bersangkutan.
    // Tidak boleh bocor ke faktur amrahan / faktur lain yang berbagi nomor faktur sama.
    // ─────────────────────────────────────────────────────────────────────────────
    foreach ($fakturs as $f) {
        $f_id = $f['id'];
        $explicit_matches = [];

        foreach ($tx_pool as $tx) {
            if (!empty($tx['fakturId']) && $tx['fakturId'] === $f_id && !isset($claimed_tx_ids[$tx['id']])) {
                $explicit_matches[] = $tx;
            }
        }

        if (!empty($explicit_matches)) {
            $computed = $compute_realisasi($explicit_matches, $f);
            if ($computed) {
                $result[$f_id] = $computed;
                foreach ($explicit_matches as $m) {
                    $claimed_tx_ids[$m['id']] = true;
                }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // PASS 2: Match transaksi legacy/tanpa fakturId (empty fakturId)
    // Transaksi yang memiliki fakturId milik faktur lain DIABAIKAN.
    // Setiap transaksi jurnal hanya bisa diklaim oleh SATU faktur.
    // ─────────────────────────────────────────────────────────────────────────────
    foreach ($fakturs as $f) {
        $f_id = $f['id'];
        if (isset($result[$f_id])) continue;

        $no_faktur = trim(strtolower($f['noFaktur'] ?? ''));
        $f_proj_id = $f['projectId'] ?? null;
        if ($no_faktur === '') continue;

        $unlinked_matches = [];
        $matched_no_bukti = null;

        foreach ($tx_pool as $tx) {
            if (isset($claimed_tx_ids[$tx['id']])) continue;
            if (!empty($tx['fakturId'])) continue; // Milik faktur lain

            $tx_no_bukti = trim(strtolower($tx['noBukti'] ?? ''));
            $tx_ket      = strtolower($tx['keterangan'] ?? '');

            $matches_no_faktur = (
                ($tx_no_bukti !== '' && ($tx_no_bukti === $no_faktur || str_starts_with($tx_no_bukti, $no_faktur . '-a')))
                || str_contains($tx_ket, $no_faktur)
            );

            if (!$matches_no_faktur) continue;

            if ($f_proj_id && !empty($tx['projectId']) && $tx['projectId'] !== $f_proj_id) {
                continue;
            }

            if ($matched_no_bukti === null) {
                $matched_no_bukti = $tx['noBukti'] ?: $tx['id'];
            }

            if ($tx['noBukti'] === $matched_no_bukti || empty($tx['noBukti'])) {
                $unlinked_matches[] = $tx;
            }
        }

        if (!empty($unlinked_matches)) {
            $computed = $compute_realisasi($unlinked_matches, $f);
            if ($computed) {
                $result[$f_id] = $computed;
                foreach ($unlinked_matches as $m) {
                    $claimed_tx_ids[$m['id']] = true;
                }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // PASS 3: Fallback input manual di FakturPendapatan
    // ─────────────────────────────────────────────────────────────────────────────
    foreach ($fakturs as $f) {
        $f_id = $f['id'];
        if (isset($result[$f_id])) continue;

        $f_tgl     = $f['tanggalTerima'] ?? null;
        $f_nominal = (float)($f['nominalDiterima'] ?? 0);
        $has_manual = !empty($f_tgl) && $f_nominal > 0;

        if ($has_manual) {
            $result[$f_id] = [
                'isRealized'           => true,
                'nominalDiterima'      => $f_nominal,
                'ppn'                  => (float)($f['ppn'] ?? 0),
                'pph'                  => (float)($f['pph'] ?? 0),
                'tanggalTerima'        => substr($f_tgl, 0, 10),
                'bank'                 => $f['bank'] ?: 'Bank',
                'matchedJurnalNoBukti' => null,
            ];
        } else {
            $result[$f_id] = [
                'isRealized'           => false,
                'nominalDiterima'      => 0.0,
                'ppn'                  => null,
                'pph'                  => null,
                'tanggalTerima'        => null,
                'bank'                 => null,
                'matchedJurnalNoBukti' => null,
            ];
        }
    }

    return $result;
}

