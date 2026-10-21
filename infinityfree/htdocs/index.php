<?php
/**
 * Jay Chat —— PHP 后端入口（前端入口 + API 前置分发）
 *
 * 路由约定（配合 .htaccess）：
 *   /api/*        → 本文件分发
 *   /uploads/*    → 静态文件（含禁止执行 PHP 的 .htaccess）
 *   /assets/*     → 静态文件
 *   其余任意路径  → index.html（SPA 前端路由兜底）
 *
 * 本地可用内置服务器调试：
 *   cd htdocs && DB_DRIVER=sqlite DB_PATH=/tmp/jc/jaychat.db php -S 127.0.0.1:8099 index.php
 */

if (!defined('JC_HTDOCS')) {
    define('JC_HTDOCS', __DIR__);
}

require_once __DIR__ . '/lib/security.php';

/* ------------------------------ 安全响应头 ------------------------------ */
jc_security_headers();

/* ------------------------------ CORS（仅允许同源与本地容器） ------------------------------
 * 说明：接口使用 Bearer token，不需要跨域携带 Cookie。
 * 之前全放开的 Access-Control-Allow-Origin: * 会让任意站点直接调用接口，
 * 这里收紧为：同源、以及 Capacitor 打包容器使用的本地源。 */
$origin = isset($_SERVER['HTTP_ORIGIN']) ? (string) $_SERVER['HTTP_ORIGIN'] : '';
if ($origin !== '' && $origin !== 'null') {
    $allowedOrigin = false;
    $originHost = parse_url($origin, PHP_URL_HOST);
    $selfHost = isset($_SERVER['HTTP_HOST']) ? preg_replace('/:\d+$/', '', (string) $_SERVER['HTTP_HOST']) : '';
    if ($originHost && $selfHost && strcasecmp($originHost, $selfHost) === 0) {
        $allowedOrigin = true;
    }
    if (in_array($origin, array('capacitor://localhost', 'ionic://localhost', 'http://localhost', 'https://localhost'), true)) {
        $allowedOrigin = true;
    }
    if ($allowedOrigin) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }
}
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Max-Age: 86400');

$method = isset($_SERVER['REQUEST_METHOD']) ? strtoupper($_SERVER['REQUEST_METHOD']) : 'GET';
if ($method === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/* ------------------------------ 路径归一化 ------------------------------ */
$uri = isset($_SERVER['REQUEST_URI']) ? $_SERVER['REQUEST_URI'] : '/';
$path = parse_url($uri, PHP_URL_PATH);
if (!$path) {
    $path = '/';
}
if ($path !== '/') {
    $path = rtrim($path, '/');
}
if ($path === '') {
    $path = '/';
}

/* ------------------------------ 静态文件（内置服务器） ------------------------------
 * 用 php -S ... index.php 调试时，静态文件交给内置服务器直接输出；
 * Apache 环境下 /uploads、/assets 由 .htaccess 直接返回，不会进到这里。 */
if (php_sapi_name() === 'cli-server') {
    $full = __DIR__ . $path;
    if ($path !== '/' && $path !== '/index.php' && is_file($full)) {
        return false;
    }
}

/* ------------------------------ 统一 JSON 响应 ------------------------------ */
function jc_respond($status, $data)
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo jc_json($data);
}

/* 读取 JSON 请求体（超过 2MB 直接拒绝，避免超大包拖垮共享主机） */
function jc_read_body()
{
    // 只有 JSON 请求才需要在这里读 body 并做 2MB 限制。
    // multipart/form-data（文件由 PHP 解析到 $_FILES）与 application/octet-stream
    // （原始二进制上传）必须原样交给对应路由处理，否则会被误判为「请求内容过大」，
    // 或提前读空 php://input 导致二进制上传拿到空文件。
    $contentType = isset($_SERVER['CONTENT_TYPE']) ? strtolower((string) $_SERVER['CONTENT_TYPE']) : '';
    $isJson = ($contentType === '' || strpos($contentType, 'application/json') !== false);
    if (!$isJson) {
        return array();
    }

    $len = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : 0;
    if ($len > 2 * 1024 * 1024) {
        http_response_code(413);
        header('Content-Type: application/json; charset=utf-8');
        echo jc_json(array('error' => '请求内容过大'));
        exit;
    }
    $raw = file_get_contents('php://input');
    if ($raw === false) {
        return array();
    }
    if (strlen($raw) > 2 * 1024 * 1024) {
        http_response_code(413);
        header('Content-Type: application/json; charset=utf-8');
        echo jc_json(array('error' => '请求内容过大'));
        exit;
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : array();
}

/* ------------------------------ 判断是否 API 请求 ------------------------------ */
$isApi = ($path === '/api' || strpos($path, '/api/') === 0);

/* ------------------------------ API 分发 ------------------------------ */
if ($isApi) {
    /**
     * 兜底：若发生无法捕获的致命错误（E_ERROR / E_PARSE / 内存耗尽等），
     * 也要输出可读 JSON，绝不再返回空白 500，方便定位问题。
     */
    register_shutdown_function(function () {
        $e = error_get_last();
        if (!$e) {
            return;
        }
        $fatal = array(E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR, E_USER_ERROR, E_RECOVERABLE_ERROR);
        if (!in_array($e['type'], $fatal, true)) {
            return;
        }
        if (!headers_sent()) {
            http_response_code(500);
            header('Content-Type: application/json; charset=utf-8');
        }
        echo json_encode(array(
            'error' => '服务器致命错误：' . $e['message'],
            'at' => basename((string) $e['file']) . ':' . (int) $e['line'],
        ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    });

    // 数据库初始化（建表 + 种子数据）。失败时必须给出明确提示，而不是空白 500。
    $bootError = null;
    try {
        require_once __DIR__ . '/lib/bootstrap.php';
    } catch (Throwable $e) {
        $bootError = $e;
    }
    if ($bootError !== null) {
        http_response_code(503);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array(
            'error' => '数据库未配置或连接失败，请打开 /install.php 完成一键安装。',
            'detail' => $bootError->getMessage(),
            'install' => true,
        ), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    // IP 黑名单：任何接口调用前统一拦截
    jc_enforce_ip_block('api');

    // 全站接口限流：单 IP 每分钟 300 次（正常轮询远低于此值）
    jc_rate_limit('api', 300, 60000);

    // 记录真实 IP（登录用户同步到 users.last_ip，供后台「用户IP」实时查看）
    $trackUid = 0;
    try {
        $trackPayload = verify_token(request_token());
        if ($trackPayload) {
            $trackUid = (int) $trackPayload['uid'];
        }
    } catch (Exception $e) {
        $trackUid = 0;
    }
    jc_track_ip($trackUid, $path);

    // 健康检查
    if ($method === 'GET' && $path === '/api/health') {
        jc_respond(200, array(
            'ok' => true,
            'name' => 'Jay Chat',
            'time' => now_ms(),
            'dev_mode' => (bool) jc_config('DEV_MODE'),
        ));
        exit;
    }

    // 注册路由（顺序敏感：同一文件内保持 Node 的路由顺序）
    require_once __DIR__ . '/api/auth.php';
    require_once __DIR__ . '/api/users.php';
    require_once __DIR__ . '/api/friends.php';
    require_once __DIR__ . '/api/groups.php';
    require_once __DIR__ . '/api/messages.php';
    require_once __DIR__ . '/api/moments.php';
    require_once __DIR__ . '/api/notifications.php';
    require_once __DIR__ . '/api/ai.php';
    require_once __DIR__ . '/api/admin.php';
    require_once __DIR__ . '/api/stickers.php';
    require_once __DIR__ . '/api/realtime.php';

    $body = jc_read_body();

    try {
        $out = jc_dispatch($method, $path, $body);
        jc_respond($out[0], $out[1]);
    } catch (ApiException $e) {
        jc_respond($e->status, array('error' => $e->getMessage()));
    } catch (Exception $e) {
        error_log('[error] ' . $e->getMessage());
        jc_respond(500, array('error' => $e->getMessage() !== '' ? $e->getMessage() : '服务器内部错误'));
    } catch (Throwable $e) {
        error_log('[error] ' . $e->getMessage());
        jc_respond(500, array('error' => $e->getMessage() !== '' ? $e->getMessage() : '服务器内部错误'));
    }
    exit;
}

/* ------------------------------ SPA 前端兜底 ------------------------------ */
// 非 API 请求也检查 IP 黑名单：被封禁的 IP 连页面都无法打开
try {
    require_once __DIR__ . '/lib/bootstrap.php';
    jc_enforce_ip_block('html');
} catch (Exception $e) {
    // 数据库未配置或不可用时不阻断页面（交由安装向导/错误提示处理）
} catch (Throwable $e) {
}

// 尚未安装（缺少 config.local.php）→ 引导到安装向导
if ($path !== '/install.php'
    && !is_file(__DIR__ . '/lib/config.local.php')
    && is_file(__DIR__ . '/install.php')) {
    header('Location: ./install.php');
    exit;
}

/* 头像自愈：升级覆盖 uploads 后，从数据库备份恢复头像文件 */
if (preg_match('#^/uploads/[A-Za-z0-9_\-./]+$#', $path)
    && strpos($path, '..') === false
    && !is_file(__DIR__ . $path)) {
    try {
        require_once __DIR__ . '/lib/bootstrap.php';
        if (jc_avatar_restore($path)) {
            exit;
        }
    } catch (Exception $e) {
    } catch (Throwable $e) {
    }
}

$indexHtml = __DIR__ . '/index.html';
if (is_file($indexHtml)) {
    header('Content-Type: text/html; charset=utf-8');
    header('Cache-Control: no-cache');
    readfile($indexHtml);
    exit;
}

http_response_code(404);
header('Content-Type: application/json; charset=utf-8');
echo jc_json(array('error' => 'Not Found'));
