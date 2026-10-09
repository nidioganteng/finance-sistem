<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

if (!function_exists('getallheaders')) {
    function getallheaders(): array {
        $h = [];
        foreach ($_SERVER as $n => $v) {
            if (str_starts_with($n, 'HTTP_')) {
                $h[str_replace('_', '-', substr($n, 5))] = $v;
            }
        }
        return $h;
    }
}

function require_auth(): array {
    $headers = getallheaders();
    $auth    = $headers['AUTHORIZATION'] ?? $headers['Authorization'] ?? $headers['authorization'] ?? '';
    if (!str_starts_with($auth, 'Bearer ')) error_response('Token tidak ditemukan.', 401);
    $token = substr($auth, 7);
    $user  = jwt_verify($token, JWT_SECRET);
    if (!$user) error_response('Token tidak valid atau sudah kadaluarsa.', 401);
    return $user;
}
