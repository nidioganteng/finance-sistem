<?php
/**
 * Router untuk PHP built-in server (dipakai saat development lokal).
 *
 * Jalankan dengan:
 *   php -S 0.0.0.0:8000 api/router.php
 */

$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);

// Sajikan file statis apa adanya kalau file-nya memang ada
if ($uri !== '/' && file_exists(__DIR__ . $uri)) {
    return false;
}

// Semua request lain → masuk ke entry point
require __DIR__ . '/index.php';
