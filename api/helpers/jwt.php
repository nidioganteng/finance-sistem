<?php
if (!defined('APP_ENTRY')) die('Direct access not allowed');

function base64url_encode(string $data): string { return rtrim(strtr(base64_encode($data), '+/', '-_'), '='); }
function base64url_decode(string $data): string { return base64_decode(strtr($data, '-_', '+/')); }
function parse_jwt_duration(string $d): int { if (preg_match('/^(\d+)([smhd])$/', $d, $m)) { $mul = ['s'=>1,'m'=>60,'h'=>3600,'d'=>86400]; return (int)$m[1] * ($mul[$m[2]] ?? 3600); } return 28800; }
function jwt_sign(array $payload, string $secret, string $expires_in = '8h'): string { $header = base64url_encode(json_encode(['alg'=>'HS256','typ'=>'JWT'])); $payload['iat']=time(); $payload['exp']=time()+parse_jwt_duration($expires_in); $body=base64url_encode(json_encode($payload)); $sig=base64url_encode(hash_hmac('sha256',"$header.$body",$secret,true)); return "$header.$body.$sig"; }
function jwt_verify(string $token, string $secret): ?array { $parts=explode('.',$token); if(count($parts)!==3) return null; [$header,$payload,$sig]=$parts; $expected=base64url_encode(hash_hmac('sha256',"$header.$payload",$secret,true)); if(!hash_equals($expected,$sig)) return null; $data=json_decode(base64url_decode($payload),true); if(!$data||(isset($data['exp'])&&$data['exp']<time())) return null; return $data; }
