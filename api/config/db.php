<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

function get_pdo(): PDO {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=utf8mb4',
        DB_HOST, DB_PORT, DB_NAME
    );

    try {
        $pdo = new PDO($dsn, DB_USER, DB_PASSWORD, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
        // Paksa timezone ke WIB (+07:00) untuk semua sesi
        $pdo->exec("SET time_zone = '+07:00'");
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['message' => 'Koneksi database gagal.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    return $pdo;
}
