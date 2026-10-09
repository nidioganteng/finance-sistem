<?php
// Pastikan error PHP tidak bocor ke JSON response
ini_set('display_errors', 0);
ini_set('display_startup_errors', 0);
error_reporting(E_ALL);

// Tangkap fatal error → kembalikan JSON, bukan HTML
register_shutdown_function(function () {
    $err = error_get_last();
    if ($err && in_array($err['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
        if (!headers_sent()) {
            header('Content-Type: application/json; charset=utf-8');
            http_response_code(500);
        }
        echo json_encode(['message' => 'Server error: ' . $err['message'] . ' in ' . $err['file'] . ':' . $err['line']]);
    }
});

set_exception_handler(function (Throwable $e) {
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(500);
    }
    echo json_encode(['message' => $e->getMessage() . ' (' . basename($e->getFile()) . ':' . $e->getLine() . ')']);
    exit;
});

define('APP_ENTRY', true);
require_once __DIR__ . '/config/env.php';
require_once __DIR__ . '/config/db.php';
require_once __DIR__ . '/helpers/jwt.php';
require_once __DIR__ . '/helpers/response.php';
require_once __DIR__ . '/middleware/auth.php';

$origin = defined('FRONTEND_URL') ? FRONTEND_URL : '*';
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: ' . $origin);
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

// ── Parse URI ────────────────────────────────────────────────────────────────
$uri      = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$uri      = preg_replace('#^.*/api/?#', '', $uri);
$uri      = trim($uri, '/');
$segments = $uri !== '' ? explode('/', $uri) : [];
$resource = $segments[0] ?? '';
$method   = $_SERVER['REQUEST_METHOD'];

// ── Parse body ───────────────────────────────────────────────────────────────
$body = [];
$raw  = file_get_contents('php://input');
if ($raw) { $decoded = json_decode($raw, true); if (is_array($decoded)) $body = $decoded; }
if (!empty($_POST)) { $body = array_merge($body, $_POST); }

// ── Route map ────────────────────────────────────────────────────────────────
$routes = [
    'ping'              => null,
    'auth'              => 'auth',
    'pengguna'          => 'pengguna',
    'entities'          => 'entities',
    'dashboard'         => 'dashboard',
    'kas'               => 'kas',
    'jurnal'            => 'jurnal',
    'jurnal-transaksi'  => 'jurnal-transaksi',
    'coa'               => 'coa',
    'notifikasi'        => 'notifikasi',
    'log'               => 'log',
    'dokumen'           => 'dokumen',
    'jenis-input'       => 'jenis-input',
    'piutang'           => 'piutang',
    'pendapatan'        => 'pendapatan',
    'aset-tetap'        => 'aset-tetap',
    'saldo-awal'        => 'saldo-awal',
    'buku-besar'        => 'buku-besar',
    'neraca'            => 'neraca',
    'laba-rugi'         => 'laba-rugi',
    'arus-kas'          => 'arus-kas',
    'profitabilitas'    => 'profitabilitas',
    'pajak'             => 'pajak',
    'laporan-keuangan'  => 'laporan-keuangan',
    'daftar-akun'       => 'daftar-akun',
    'tarifpajak'        => 'tarifpajak',
];

// ── Dispatch ─────────────────────────────────────────────────────────────────
if ($resource === 'ping') {
    json_response(['status' => 'ok']);
}

if (!array_key_exists($resource, $routes)) {
    error_response('Endpoint tidak ditemukan.', 404);
}

require __DIR__ . '/routes/' . $routes[$resource] . '.php';
