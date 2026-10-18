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
