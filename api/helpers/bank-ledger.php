<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

/** Read bank movements from their source journal, never from a second posting.
 * Returns null for non-bank ledgers. No transactions are inserted during reads.
 */
function bank_ledger_rows(PDO $pdo, string $entity_id, string $jenis_id, ?string $rekening = null, ?string $dari = null, ?string $sampai = null): ?array {
    $stmt = $pdo->prepare('SELECT `key` FROM JenisInputTransaksi WHERE id = ?');
    $stmt->execute([$jenis_id]);
    if ($stmt->fetchColumn() !== 'bankBuku') return null;
    $stmt = $pdo->prepare('SELECT `key` FROM Entity WHERE id = ?');
    $stmt->execute([$entity_id]);
    $entity_key = $stmt->fetchColumn();
    $accounts = array_filter(build_bank_coa_map(), fn($a) => $a['entityKey'] === $entity_key && ($rekening === null || $a['rekeningNama'] === $rekening));
    if (!$accounts) return [];
    $codes = array_keys($accounts);
    $placeholders = implode(',', array_fill(0, count($codes), '?'));
    $sql = "SELECT t.*, c.id AS coa_id, c.code AS coa_code, c.name AS coa_name,
                   p.code AS project_code, p.name AS project_name, ji.`key` AS ledger_source
            FROM `Transaction` t
            JOIN JenisInputTransaksi ji ON ji.id = t.jenisInputId
            LEFT JOIN CoaAccount c ON c.id = t.coaAccountId
            LEFT JOIN Project p ON p.id = t.projectId
            WHERE ((t.entityId = ? AND t.jenisInputId = ?)
                OR (ji.`key` = 'jurnalTransaksi' AND c.code IN ($placeholders)))";
    $params = array_merge([$entity_id, $jenis_id], $codes);
    if ($dari) { $sql .= ' AND t.tanggal >= ?'; $params[] = $dari . ' 00:00:00'; }
    if ($sampai) { $sql .= ' AND t.tanggal <= ?'; $params[] = $sampai . ' 23:59:59'; }
    $sql .= ' ORDER BY t.tanggal ASC, t.noBukti ASC, t.createdAt ASC, t.id ASC';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $manual_accounts = [];
    $voucher_key = fn($row) => json_encode([$row['entityId'], $row['jenisInputId'], $row['noBukti'], substr($row['tanggal'], 0, 10)]);
    foreach ($rows as $row) {
        $extra = json_decode($row['extraFieldsJson'] ?? '{}', true) ?: [];
        if ($row['ledger_source'] === 'bankBuku' && !empty($extra['isKasEntry']) && empty($extra['autoPostedFromJurnal'])) {
            $name = $extra['rekeningNama'] ?? (build_bank_coa_map()[$row['coa_code']]['rekeningNama'] ?? null);
            if ($name) $manual_accounts[$voucher_key($row)] = $name;
        }
    }
    $result = [];
    foreach ($rows as $row) {
        $extra = json_decode($row['extraFieldsJson'] ?? '{}', true) ?: [];
        // Legacy mirrors are display copies; the original journal is authoritative.
        if (!empty($extra['autoPostedFromJurnal'])) continue;
        if ($row['ledger_source'] === 'jurnalTransaksi') {
            $extra['isKasEntry'] = true;
            $extra['autoPostedFromJurnal'] = true;
            $extra['rekeningNama'] = $accounts[$row['coa_code']]['rekeningNama'];
            $row['sourceJurnal'] = true;
        }
        if ($row['ledger_source'] === 'bankBuku' && empty($extra['rekeningNama']) && isset($manual_accounts[$voucher_key($row)])) {
            // Counterpart rows belong to the bank voucher even without rekening metadata.
            $extra['rekeningNama'] = $manual_accounts[$voucher_key($row)];
        }
        if ($rekening !== null && ($extra['rekeningNama'] ?? null) !== $rekening) continue;
        $row['extraFieldsJson'] = json_encode($extra);
        $result[] = $row;
    }
    return $result;
}

function bank_ledger_mutation(array $rows): float {
    $total = 0.0;
    foreach ($rows as $row) {
        $extra = json_decode($row['extraFieldsJson'] ?? '{}', true) ?: [];
        if (!empty($extra['isKasEntry'])) $total += (float)$row['debit'] - (float)$row['kredit'];
    }
    return $total;
}

/** Journal groups must be edited as balanced entries at their source. */
function bank_ledger_has_journal_source(PDO $pdo, array $ids): bool {
    if (!$ids) return false;
    $marks = implode(',', array_fill(0, count($ids), '?'));
    $stmt = $pdo->prepare("SELECT t.id FROM `Transaction` t JOIN JenisInputTransaksi j ON j.id=t.jenisInputId WHERE t.id IN ($marks) AND j.`key`='jurnalTransaksi' LIMIT 1");
    $stmt->execute(array_values($ids));
    return $stmt->fetchColumn() !== false;
}
