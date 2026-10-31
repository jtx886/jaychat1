<?php
/**
 * 通用工具函数
 */

/** 毫秒时间戳（与 Node Date.now() 对齐；统一用它，不用 MySQL NOW()） */
function now_ms()
{
    return (int) round(microtime(true) * 1000);
}

/** base64url 编码（无填充，+ / 换成 - _） */
function b64url_encode($raw)
{
    return rtrim(strtr(base64_encode($raw), '+/', '-_'), '=');
}

/** base64url 解码 */
function b64url_decode($s)
{
    $s = strtr((string) $s, '-_', '+/');
    $pad = strlen($s) % 4;
    if ($pad) {
        $s .= str_repeat('=', 4 - $pad);
    }
    return base64_decode($s);
}

/** 统一 JSON 输出（不转义 Unicode / 斜杠，贴近 JSON.stringify 行为） */
function jc_json($data)
{
    $flags = JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES;
    $s = json_encode($data, $flags);
    return $s === false ? 'null' : $s;
}

/** 安全解析 JSON 字符串（失败返回 null，与 Node safeJson 一致） */
function safe_json($s)
{
    if ($s === null || $s === '') {
        return null;
    }
    $v = json_decode($s, true);
    return $v === null && trim((string) $s) !== 'null' ? null : $v;
}

/** 空对象（用于需要输出 {} 的场景） */
function empty_obj()
{
    return new stdClass();
}

/**
 * 确保 uploads 目录存在，并写入保护性 .htaccess。
 *
 * 部署包不再包含 uploads/ 目录（避免个别主机的解压工具「先清空再写入」把用户
 * 上传的头像 / 动态图片 / 视频一起删掉）；目录改由这里在运行时创建。
 * 只在缺失时写文件，正常请求几乎零开销。
 */
function jc_ensure_uploads()
{
    $dir = JC_HTDOCS . '/uploads';
    if (!is_dir($dir)) {
        @mkdir($dir, 0777, true);
    }
    $ht = $dir . '/.htaccess';
    if (is_dir($dir) && !is_file($ht)) {
        @file_put_contents($ht, <<<'HT'
# 上传目录：禁止执行任何脚本，防止上传可执行文件被访问
<FilesMatch "\.(php|php3|php4|php5|php7|php8|phtml|phar|pl|py|cgi|asp|aspx|jsp|sh|shtml|htaccess|svg)$">
  Require all denied
</FilesMatch>

# 禁止目录列出
Options -Indexes

# 不允许把上传文件当脚本/HTML 解析
<IfModule mod_headers.c>
  Header always set X-Content-Type-Options "nosniff"
  Header always set Content-Security-Policy "default-src 'none'; img-src 'self'; media-src 'self'; style-src 'unsafe-inline'"
</IfModule>
HT
        );
    }
}
