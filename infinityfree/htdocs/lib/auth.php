<?php
/**
 * 鉴权：密码哈希（bcrypt）与 token（镜像 Node 的 base64url + HMAC-SHA256 方案）
 *
 * 说明：Node 用 scrypt，PHP 无内置等价实现，这里改用 password_hash()/password_verify()
 * （bcrypt），只要注册与登录都走 PHP 实现即可自洽。
 * token 机制则原样镜像，保证与前端既有约定一致：
 *   payload   = base64url(JSON {"uid":..,"exp":..})
 *   signature = base64url(HMAC-SHA256(payload, JWT_SECRET))
 *   token     = payload.signature    有效期 30 天
 */

/** 密码哈希（bcrypt） */
function hash_password($pwd)
{
    return password_hash((string) $pwd, PASSWORD_DEFAULT);
}

/** 校验密码 */
function verify_password($pwd, $stored)
{
    if (!$stored) {
        return false;
    }
    return password_verify((string) $pwd, $stored);
}

/** 签发 token */
function sign_token($uid)
{
    $payload = b64url_encode(json_encode(array(
        'uid' => (int) $uid,
        'exp' => now_ms() + jc_token_ttl(),
    )));
    $sig = b64url_encode(hash_hmac('sha256', $payload, jc_config('JWT_SECRET'), true));
    return $payload . '.' . $sig;
}

/** 校验 token，返回 payload 数组或 null */
function verify_token($token)
{
    if (!$token || strpos($token, '.') === false) {
        return null;
    }
    $parts = explode('.', $token);
    if (count($parts) !== 2) {
        return null;
    }
    $payload = $parts[0];
    $sig = $parts[1];
    $expect = b64url_encode(hash_hmac('sha256', $payload, jc_config('JWT_SECRET'), true));
    if (!hash_equals($expect, $sig)) {
        return null;
    }
    $decoded = b64url_decode($payload);
    $data = json_decode($decoded, true);
    if (!is_array($data) || !isset($data['exp'])) {
        return null;
    }
    if ((int) $data['exp'] < now_ms()) {
        return null;
    }
    return $data;
}

/** 从请求中提取 token（Authorization: Bearer <token>，或 ?token=） */
function request_token()
{
    $h = '';
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $h = $_SERVER['HTTP_AUTHORIZATION'];
    } elseif (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $h = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
    } elseif (function_exists('getallheaders')) {
        $headers = getallheaders();
        foreach ($headers as $k => $v) {
            if (strtolower($k) === 'authorization') {
                $h = $v;
                break;
            }
        }
    }
    if (strpos($h, 'Bearer ') === 0) {
        return substr($h, 7);
    }
    if (isset($_GET['token'])) {
        return $_GET['token'];
    }
    return null;
}

/**
 * 鉴权守卫：成功返回 uid（int），失败抛出 401。
 */
function require_auth()
{
    $data = verify_token(request_token());
    if (!$data) {
        api_abort(401, '未登录或登录已过期');
    }
    return (int) $data['uid'];
}

/** 邮箱正则：仅 @qq.com / @163.com */
function email_re()
{
    return '/^[A-Za-z0-9._%+-]+@(qq\.com|163\.com)$/';
}

function email_valid($email)
{
    return (bool) preg_match(email_re(), (string) $email);
}

/** 昵称校验：1-6 个字符、不含空格 */
function validate_username($name)
{
    if (!is_string($name)) {
        return '昵称不能为空';
    }
    $s = trim($name);
    $len = mb_strlen($s, 'UTF-8');
    if ($len < 1 || $len > 6) {
        return '昵称只能为 1-6 个字符';
    }
    if (preg_match('/\s/u', $s)) {
        return '昵称不能包含空格';
    }
    return null;
}

/** 密码校验：6-32 位 */
function validate_password($pwd)
{
    if (!is_string($pwd) || mb_strlen($pwd, 'UTF-8') < 6) {
        return '密码至少 6 位';
    }
    if (mb_strlen($pwd, 'UTF-8') > 32) {
        return '密码最多 32 位';
    }
    return null;
}
