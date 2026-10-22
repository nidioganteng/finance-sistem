<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

/**
 * Kirim update progress termin ke Sidamon.
 * Dipanggil setelah termin berhasil di-update di Kosha.
 * Non-blocking: error tidak menghentikan response utama.
 */
function sync_termin_to_sidamon(string $project_id): void {
    $pdo = get_pdo();

    // Cek apakah project ini berasal dari Sidamon
    $stmt = $pdo->prepare(
        "SELECT id, sidamon_assignment_id, contractValue FROM Project WHERE id = ? LIMIT 1"
    );
    $stmt->execute([$project_id]);
    $project = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$project || !$project['sidamon_assignment_id']) return;

    $assignment_id = $project['sidamon_assignment_id'];
    $contract_val  = (float)$project['contractValue'];

    // Ambil semua termin project ini
    $stmt = $pdo->prepare(
        "SELECT id, name, percentage, nominal, status, createdAt
         FROM Termin WHERE projectId = ? ORDER BY createdAt ASC"
    );
    $stmt->execute([$project_id]);
    $termins = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $total_dibayar = array_sum(array_column($termins, 'nominal'));
    $persen        = $contract_val > 0
        ? round(($total_dibayar / $contract_val) * 100, 1)
        : 0;

    // Otomatis tandai proyek selesai di Kosha saat termin mencapai 100%
    if ($persen >= 100) {
        $pdo->prepare("UPDATE Project SET status = 'COMPLETED' WHERE id = ? AND status != 'COMPLETED'")
            ->execute([$project_id]);
    }

    $termins_payload = array_map(fn($t) => [
        'label'      => $t['name'],
        'status'     => $t['status'],
        'nominal'    => (float)$t['nominal'],
        'percentage' => (float)$t['percentage'],
        'date'       => $t['createdAt'],
    ], $termins);

    $payload = json_encode([
        'projectId'      => $project_id,
        'projectCode'    => '', // diisi oleh caller kalau ada
        'persenTerbayar' => $persen,
        'termins'        => $termins_payload,
        'statusProyek'   => $persen >= 100 ? 'Selesai' : 'Aktif',
    ]);

    $ch = curl_init(SIDAMON_URL . '/api/sync/termin/' . urlencode($assignment_id));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => 'PUT',
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_TIMEOUT        => 5,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'X-Internal-Secret: ' . INTERNAL_SECRET,
        ],
    ]);
    curl_exec($ch);
    curl_close($ch);
    // Kita tidak throw error — sync gagal tidak boleh blok response utama
}
