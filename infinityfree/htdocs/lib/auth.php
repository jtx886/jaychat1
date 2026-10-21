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

/**
 * 稳定获取 JWT 签名密钥。
 *
 * 修复「每次更新/重装都要重新登录」：install.php 之前每次重装都会生成新的随机密钥，
 * 导致旧 token 全部失效。改为把密钥持久化到 jc_meta 表，升级/重装后仍沿用旧密钥。
 *
 * 优先级：
 *   1) 配置中显式设置的非默认密钥（管理员手动指定）——直接使用并固化到数据库；
 *   2) 数据库中已持久化的密钥——升级/重装后继续沿用，登录态不丢；
 *   3) 首次自动生成一个随机密钥并持久化。
 */
function jc_jwt_secret()
{
    static $secret = null;
    if ($secret !== null) {
        return $secret;
    }
    $default = 'jaychat-dev-secret-change-me';
    $cfg = jc_config('JWT_SECRET');

    // 管理员手动指定了密钥（非默认值）：以配置为准，并同步写入数据库固化
    if (is_string($cfg) && $cfg !== '' && $cfg !== $default) {
        try {
            $row = db_one('SELECT `value` FROM `jc_meta` WHERE `name` = ?', array('jwt_secret'));
            if ($row === null) {
                db_exec_ignore('INSERT INTO `jc_meta` (`name`, `value`) VALUES (?, ?)', array('jwt_secret', $cfg));
            } elseif ((string) (isset($row['value']) ? $row['value'] : '') !== $cfg) {
                db_run('UPDATE `jc_meta` SET `value` = ? WHERE `name` = ?', array($cfg, 'jwt_secret'));
            }
        } catch (Exception $e) {
            // 数据库不可用时不阻断签发/校验（罕见，仅安装初期）
        }
        $secret = $cfg;
        return $secret;
    }

    // 否则优先使用数据库已持久化的密钥
    try {
        $row = db_one('SELECT `value` FROM `jc_meta` WHERE `name` = ?', array('jwt_secret'));
        if ($row && isset($row['value']) && (string) $row['value'] !== '') {
            $secret = (string) $row['value'];
            return $secret;
        }
    } catch (Exception $e) {
        // 首次安装时 jc_meta 尚未建表，忽略并走下方生成逻辑
    }

    // 首次：生成并持久化
    $generated = bin2hex(random_bytes(32));
    try {
        db_exec_ignore('INSERT INTO `jc_meta` (`name`, `value`) VALUES (?, ?)', array('jwt_secret', $generated));
    } catch (Exception $e) {
        // 持久化失败也返回本次生成值，保证当期请求可用
    }
    $secret = $generated;
    return $secret;
}

/** 签发 token */
function sign_token($uid)
{
    $payload = b64url_encode(json_encode(array(
        'uid' => (int) $uid,
        'exp' => now_ms() + jc_token_ttl(),
    )));
    $sig = b64url_encode(hash_hmac('sha256', $payload, jc_jwt_secret(), true));
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
    $expect = b64url_encode(hash_hmac('sha256', $payload, jc_jwt_secret(), true));
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
