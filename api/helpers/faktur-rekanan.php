<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

/** Register manually entered invoice partners in the reusable partner master. */
function faktur_ensure_rekanan(PDO $pdo, string $entity_id, string $nama, string $npwp): string {
    if (!$pdo->inTransaction()) throw new LogicException('Rekanan dan faktur harus disimpan dalam satu transaksi.');
    $nama = trim(preg_replace('/\s+/u', ' ', $nama));
    if ($nama === '') throw new InvalidArgumentException('Nama rekanan wajib diisi.');
    $identity = preg_replace('/\D/', '', $npwp);
    // Serialize registrations within the entity, including concurrent invoice saves.
    $lock = $pdo->getAttribute(PDO::ATTR_DRIVER_NAME) === 'mysql' ? ' FOR UPDATE' : '';
    $stmt = $pdo->prepare('SELECT id FROM Entity WHERE id = ?' . $lock);
    $stmt->execute([$entity_id]);
    if (!$stmt->fetchColumn()) throw new InvalidArgumentException('Entitas rekanan tidak ditemukan.');
    $stmt = $pdo->prepare('SELECT id, nama, npwp FROM Rekanan WHERE entityId = ? OR entityId IS NULL ORDER BY createdAt, id');
    $stmt->execute([$entity_id]);
    $name_match = null;
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $stored = preg_replace('/\D/', '', $row['npwp'] ?? '');
        if ($identity !== '' && $stored === $identity) return $row['id'];
        $normalized_name = trim(preg_replace('/\s+/u', ' ', $row['nama']));
        // A different known NPWP may belong to another partner with the same name.
        if (strcasecmp($normalized_name, $nama) === 0 && ($identity === '' || $stored === '' || $stored === $identity)) $name_match = $row;
    }
    $now = date('Y-m-d H:i:s');
    if ($name_match) {
        if ($identity !== '' && preg_replace('/\D/', '', $name_match['npwp'] ?? '') === '') {
            $pdo->prepare('UPDATE Rekanan SET npwp = ?, updatedAt = ? WHERE id = ?')->execute([$identity, $now, $name_match['id']]);
        }
        return $name_match['id'];
    }
    $id = uuid4();
    $pdo->prepare("INSERT INTO Rekanan (id, entityId, nama, npwp, tipe, createdAt, updatedAt) VALUES (?, ?, ?, ?, 'KLIEN', ?, ?)")
        ->execute([$id, $entity_id, $nama, $identity ?: null, $now, $now]);
    return $id;
}
