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

/* ------------------------------ CORS（镜像 cors() 全放开） ------------------------------ */
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
$reqHeaders = isset($_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS'])
    ? $_SERVER['HTTP_ACCESS_CONTROL_REQUEST_HEADERS']
    : 'Content-Type, Authorization';
header('Access-Control-Allow-Headers: ' . $reqHeaders);
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
    if ($path !== '/' && is_file($full) && !preg_match('/\.php$/i', $full)) {
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

/* 读取 JSON 请求体（限制 2MB，与 express.json({limit:'2mb'}) 对齐） */
function jc_read_body()
{
    $raw = file_get_contents('php://input');
    if ($raw === false) {
        return array();
    }
    if (strlen($raw) > 2 * 1024 * 1024) {
        $raw = substr($raw, 0, 2 * 1024 * 1024);
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : array();
}

/* ------------------------------ API 分发 ------------------------------ */
if ($path === '/api' || strpos($path, '/api/') === 0) {
    require_once __DIR__ . '/lib/bootstrap.php';

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
    require_once __DIR__ . '/api/im.php';
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
