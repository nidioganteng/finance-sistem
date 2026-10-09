<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

function json_response($data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function error_response(string $message, int $status = 400): void {
    json_response(['message' => $message], $status);
}

function uuid4(): string {
    return sprintf(
        '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
        mt_rand(0, 0xffff), mt_rand(0, 0xffff),
        mt_rand(0, 0xffff),
        mt_rand(0, 0x0fff) | 0x4000,
        mt_rand(0, 0x3fff) | 0x8000,
        mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
    );
}

/**
 * Generate a CUID-style ID (compatible with Prisma @default(cuid())).
 */
function cuid(): string {
    return 'c'
        . base_convert(time(), 10, 36)
        . str_pad(base_convert(mt_rand(0, 1679616), 10, 36), 4, '0', STR_PAD_LEFT)
        . str_pad(base_convert(mt_rand(0, 1679616), 10, 36), 4, '0', STR_PAD_LEFT);
}

/**
 * Tulis entri ActivityLog. Gagal senyap agar tidak mengganggu response utama.
 */
function log_activity(string $actor_id, string $action, string $category, $detail = null): void {
    try {
        $pdo = get_pdo();
        $id  = cuid();
        $pdo->prepare(
            'INSERT INTO ActivityLog (id, actorId, action, category, detail, createdAt)
             VALUES (?, ?, ?, ?, ?, NOW())'
        )->execute([
            $id,
            $actor_id,
            $action,
            $category,
            $detail ? json_encode($detail, JSON_UNESCAPED_UNICODE) : null,
        ]);
    } catch (\Throwable $e) {
        // sengaja dibiarkan kosong
    }
}
