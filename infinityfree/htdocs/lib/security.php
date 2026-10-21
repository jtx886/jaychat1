<?php
/**
 * 安全加固：真实 IP 识别、IP 黑名单、接口限流、安全响应头、请求体校验。
 *
 * 设计目标（InfinityFree 等共享主机可用）：
 *   - 不依赖 Redis / Nginx，全部使用 MySQL（或 SQLite）持久化计数
 *   - 所有写入都走预处理语句，避免注入
 *   - 限流、黑名单在入口统一执行，任何 PHP 接口都无法绕过
 */

/** 判断是否为合法 IP */
function jc_valid_ip($ip)
{
    return filter_var((string) $ip, FILTER_VALIDATE_IP) !== false;
}

/** 判断是否内网 / 保留地址（用于判断是否可信代理） */
function jc_private_ip($ip)
{
    if (!jc_valid_ip($ip)) {
        return true;
    }
    return filter_var(
        $ip,
        FILTER_VALIDATE_IP,
        FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE
    ) === false;
}

/**
 * 获取访客真实 IP。
 * 优先级：Cloudflare 真实 IP > 可信代理的 X-Real-IP > REMOTE_ADDR。
 * 刻意不直接信任 X-Forwarded-For（可被伪造用来绕过限流/黑名单）。
 */
function jc_client_ip()
{
    $remote = isset($_SERVER['REMOTE_ADDR']) ? trim((string) $_SERVER['REMOTE_ADDR']) : '';

    // Cloudflare / 部分 CDN 会回填该头，且外部无法伪造（由边缘节点覆盖）
    if (!empty($_SERVER['HTTP_CF_CONNECTING_IP'])) {
        $ip = trim((string) $_SERVER['HTTP_CF_CONNECTING_IP']);
        if (jc_valid_ip($ip)) {
            return $ip;
        }
    }

    // 仅在直连来自内网/本机（说明前面有一层反向代理）时才信任 X-Real-IP
    if (!empty($_SERVER['HTTP_X_REAL_IP']) && ($remote === '' || jc_private_ip($remote))) {
        $ip = trim((string) $_SERVER['HTTP_X_REAL_IP']);
        if (jc_valid_ip($ip)) {
            return $ip;
        }
    }

    if (jc_valid_ip($remote)) {
        return $remote;
    }
    return '0.0.0.0';
}

/** 安全响应头（静态页与接口共用） */
function jc_security_headers()
{
    if (headers_sent()) {
        return;
    }
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: geolocation=(), microphone=(), camera=(self), payment=()');
    header('Cross-Origin-Opener-Policy: same-origin');
    // 仅允许同源脚本；图片/视频允许 https 外链（表情包）与 blob
    header("Content-Security-Policy: default-src 'self'; script-src 'self'; "
        . "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https: http:; "
        . "media-src 'self' blob: https: http:; font-src 'self' data:; "
        . "connect-src 'self' https: wss: ws:; object-src 'none'; base-uri 'self'; "
        . "form-action 'self'; frame-ancestors 'self'");
    $https = (!empty($_SERVER['HTTPS']) && strtolower((string) $_SERVER['HTTPS']) !== 'off')
        || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower((string) $_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https')
        || (isset($_SERVER['SERVER_PORT']) && (int) $_SERVER['SERVER_PORT'] === 443);
    if ($https) {
        header('Strict-Transport-Security: max-age=15552000; includeSubDomains');
    }
}

/* ------------------------------- IP 黑名单 ------------------------------- */

/** 读取 IP 封禁状态；未封禁返回 null，永久封禁 until=0 */
function jc_ip_block_state($ip)
{
    $ip = (string) $ip;
    if (!jc_valid_ip($ip) || $ip === '0.0.0.0') {
        return null;
    }
    try {
        $row = db_one('SELECT * FROM `ip_blocks` WHERE `ip` = ?', array($ip));
    } catch (Exception $e) {
        return null;
    }
    if (!$row) {
        return null;
    }
    $until = (int) $row['until'];
    if ($until > 0 && $until <= now_ms()) {
        try {
            db_run('DELETE FROM `ip_blocks` WHERE `ip` = ?', array($ip));
        } catch (Exception $e) {
        }
        return null;
    }
    return $row;
}

/**
 * 拦截黑名单 IP。
 * $mode = 'api' 返回 JSON；'html' 返回 403 页面。
 */
function jc_enforce_ip_block($mode = 'api')
{
    $ip = jc_client_ip();
    $block = jc_ip_block_state($ip);
    if (!$block) {
        return;
    }
    http_response_code(403);
    if ($mode === 'api') {
        header('Content-Type: application/json; charset=utf-8');
        echo jc_json(array('error' => '该 IP 已被管理员限制访问', 'blocked' => true));
    } else {
        header('Content-Type: text/html; charset=utf-8');
        echo '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'
            . '<meta name="viewport" content="width=device-width,initial-scale=1">'
            . '<title>访问已被限制</title></head>'
            . '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;'
            . 'background:#070b18;color:#e8ecf8;font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',sans-serif">'
            . '<div style="text-align:center;padding:32px">'
            . '<div style="font-size:44px;margin-bottom:12px">🚫</div>'
            . '<h1 style="font-size:19px;margin:0 0 8px">访问已被限制</h1>'
            . '<p style="color:#8c95b5;font-size:13.5px;line-height:1.7;margin:0">'
            . '管理员已限制该 IP 访问本站。<br>如属误判，请联系站点管理员解除。</p>'
            . '</div></body></html>';
    }
    exit;
}

/* ------------------------------- 限流 ------------------------------- */

/**
 * 固定窗口限流。超限直接返回 429。
 * @param string   $bucket 限流桶名（如 login / message / upload）
 * @param int      $max    窗口内最大次数
 * @param int      $windowMs 窗口长度（毫秒）
 * @param string|null $subject 限流主体；默认按真实 IP
 */
function jc_rate_limit($bucket, $max, $windowMs, $subject = null)
{
    $keySrc = $bucket . ':' . ($subject === null ? jc_client_ip() : (string) $subject);
    $key = substr($keySrc, 0, 190);
    $now = now_ms();

    // 低概率清理过期窗口，避免表无限增长
    if (random_int(1, 100) === 1) {
        try {
            db_run('DELETE FROM `rate_limits` WHERE `window_start` < ?', array($now - 86400000));
        } catch (Exception $e) {
        }
    }

    try {
        $row = db_one('SELECT `hits`, `window_start` FROM `rate_limits` WHERE `k` = ?', array($key));
        if (!$row || (int) $row['window_start'] + $windowMs <= $now) {
            if ($row) {
                db_run('UPDATE `rate_limits` SET `hits` = 1, `window_start` = ? WHERE `k` = ?', array($now, $key));
            } else {
                db_run('INSERT INTO `rate_limits` (`k`, `hits`, `window_start`) VALUES (?, 1, ?)', array($key, $now));
            }
            return true;
        }
        $hits = (int) $row['hits'];
        if ($hits >= $max) {
            $retry = max(1, (int) ceil(((int) $row['window_start'] + $windowMs - $now) / 1000));
            api_abort(429, '操作太频繁，请 ' . $retry . ' 秒后再试');
        }
        db_run('UPDATE `rate_limits` SET `hits` = `hits` + 1 WHERE `k` = ?', array($key));
        return true;
    } catch (ApiException $e) {
        throw $e;
    } catch (Exception $e) {
        // 限流表异常时不阻断业务（可用性优先）
        return true;
    }
}

/** 清空某个限流桶（如登录成功后解除计数） */
function jc_rate_clear($bucket, $subject = null)
{
    $keySrc = $bucket . ':' . ($subject === null ? jc_client_ip() : (string) $subject);
    $key = substr($keySrc, 0, 190);
    try {
        db_run('DELETE FROM `rate_limits` WHERE `k` = ?', array($key));
    } catch (Exception $e) {
    }
}

/* ------------------------------- IP 记录 ------------------------------- */

/** 卸载/写入客户端信息（UA 截断） */
function jc_client_ua()
{
    $ua = isset($_SERVER['HTTP_USER_AGENT']) ? (string) $_SERVER['HTTP_USER_AGENT'] : '';
    return mb_substr($ua, 0, 190, 'UTF-8');
}

/**
 * 记录访问 IP，并同步到用户表的 last_ip（管理后台「用户IP」实时展示）。
 * 写入做了节流：同一 IP+用户 15 秒内只累加一次，避免高频轮询压垮共享主机。
 */
function jc_track_ip($uid, $path)
{
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;

    $ip = jc_client_ip();
    if (!jc_valid_ip($ip)) {
        return;
    }
    $uid = (int) $uid;
    $now = now_ms();
    $ua = jc_client_ua();
    $path = mb_substr((string) $path, 0, 190, 'UTF-8');

    try {
        $row = db_one('SELECT `last_seen` FROM `ip_records` WHERE `ip` = ? AND `user_id` = ?', array($ip, $uid));
        if ($row) {
            if ($now - (int) $row['last_seen'] >= 15000) {
                db_run(
                    'UPDATE `ip_records` SET `hits` = `hits` + 1, `last_seen` = ?, `last_path` = ?, `ua` = ? WHERE `ip` = ? AND `user_id` = ?',
                    array($now, $path, $ua, $ip, $uid)
                );
            }
        } else {
            db_run(
                'INSERT INTO `ip_records` (`ip`, `user_id`, `hits`, `first_seen`, `last_seen`, `last_path`, `ua`)
                 VALUES (?, ?, 1, ?, ?, ?, ?)',
                array($ip, $uid, $now, $now, $path, $ua)
            );
        }
        if ($uid > 0) {
            db_run(
                'UPDATE `users` SET `last_ip` = ?, `last_ip_at` = ?, `last_ua` = ? WHERE `id` = ? AND (`last_ip` != ? OR `last_ip_at` < ?)',
                array($ip, $now, $ua, $uid, $ip, $now - 30000)
            );
        }
    } catch (Exception $e) {
        // 记录失败不影响业务
    }
}

/** 记录一次明确的登录成功 IP（立即刷新，不走节流） */
function jc_touch_user_ip($uid)
{
    $uid = (int) $uid;
    if ($uid <= 0) {
        return;
    }
    $ip = jc_client_ip();
    if (!jc_valid_ip($ip)) {
        return;
    }
    try {
        db_run(
            'UPDATE `users` SET `last_ip` = ?, `last_ip_at` = ?, `last_ua` = ? WHERE `id` = ?',
            array($ip, now_ms(), jc_client_ua(), $uid)
        );
    } catch (Exception $e) {
    }
}
