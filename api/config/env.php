<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

// Coba baca dari file .env di root project (satu level di atas api/)
$envFile = __DIR__ . '/../../.env';
if (file_exists($envFile)) {
    $lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) continue;
        if (str_contains($line, '=')) {
            [$key, $value] = explode('=', $line, 2);
            $key   = trim($key);
            $value = trim($value, " \t\"'");
            if (!isset($_ENV[$key])) $_ENV[$key] = $value;
        }
    }
}

// Helper: baca dari $_ENV, fallback ke $default
function env(string $key, string $default = ''): string {
    return $_ENV[$key] ?? $default;
}

// ── Database ────────────────────────────────────────────────────────────────
define('DB_HOST',     env('DB_HOST',     '127.0.0.1'));
define('DB_PORT',     env('DB_PORT',     '3306'));
define('DB_USER',     env('DB_USER',     'root'));
define('DB_PASSWORD', env('DB_PASSWORD', ''));
define('DB_NAME',     env('DB_NAME',     'finance_sistem'));

// ── JWT ──────────────────────────────────────────────────────────────────────
define('JWT_SECRET',     env('JWT_SECRET',     'dev_secret_ganti_di_produksi'));
define('JWT_EXPIRES_IN', env('JWT_EXPIRES_IN', '30d'));

// ── App ──────────────────────────────────────────────────────────────────────
define('FRONTEND_URL', env('FRONTEND_URL', 'http://localhost:3000'));
define('UPLOAD_DIR',   env('UPLOAD_DIR',   __DIR__ . '/../../uploads'));
