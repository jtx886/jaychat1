<?php
/**
 * 网络请求辅助（不依赖第三方库，兼容免费主机）
 *
 * - jc_http_request(): 优先 cURL，否则回退 stream（allow_url_fopen）
 * - jc_ai_chat(): 调用管理员后台配置的第三方 AI 接口
 * - jc_soogif_search(): 抓取 soogif 搜索页并解析表情包直链
 */

/** 通用 HTTP 请求，返回 array(ok, status, body, error) */
function jc_http_request($method, $url, $opts = array())
{
    $method = strtoupper($method);
    $headers = isset($opts['headers']) && is_array($opts['headers']) ? $opts['headers'] : array();
    $body = isset($opts['body']) ? $opts['body'] : null;
    $timeout = isset($opts['timeout']) ? (int) $opts['timeout'] : 20;
    $ua = isset($opts['ua']) ? $opts['ua'] : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
        curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, min(10, $timeout));
        curl_setopt($ch, CURLOPT_TIMEOUT, $timeout);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
        curl_setopt($ch, CURLOPT_USERAGENT, $ua);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($body !== null) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
            }
        } elseif ($method !== 'GET') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
            if ($body !== null) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
            }
        }
        $resp = curl_exec($ch);
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        $err = curl_error($ch);
        curl_close($ch);
        if ($resp === false) {
            return array('ok' => false, 'status' => 0, 'body' => '', 'error' => $err !== '' ? $err : '请求失败');
        }
        return array('ok' => ($status >= 200 && $status < 400), 'status' => $status, 'body' => (string) $resp, 'error' => null);
    }

    // 回退：stream
    if (!ini_get('allow_url_fopen')) {
        return array('ok' => false, 'status' => 0, 'body' => '', 'error' => '主机未开启网络请求能力');
    }
    $headerLines = array('User-Agent: ' . $ua);
    foreach ($headers as $h) {
        $headerLines[] = $h;
    }
    $ctx = stream_context_create(array(
        'http' => array(
            'method' => $method,
            'header' => implode("\r\n", $headerLines),
            'content' => ($body !== null ? $body : ''),
            'timeout' => $timeout,
            'ignore_errors' => true,
        ),
        'ssl' => array('verify_peer' => false, 'verify_peer_name' => false),
    ));
    $resp = @file_get_contents($url, false, $ctx);
    $status = 0;
    if (isset($http_response_header) && is_array($http_response_header)) {
        foreach ($http_response_header as $line) {
            if (preg_match('#^HTTP/\S+\s+(\d{3})#', $line, $m)) {
                $status = (int) $m[1];
            }
        }
    }
    if ($resp === false) {
        return array('ok' => false, 'status' => $status, 'body' => '', 'error' => '请求失败');
    }
    return array('ok' => ($status >= 200 && $status < 400), 'status' => $status, 'body' => (string) $resp, 'error' => null);
}

/**
 * 调用 AI 接口（OpenAI 兼容 /chat/completions）。
 * @param array $messages [{role,content}, ...]
 * @return array{ok:bool, text?:string, error?:string}
 */
function jc_ai_chat($messages)
{
    $conf = jc_ai_conf();
    if ($conf['url'] === '' || $conf['key'] === '') {
        return array('ok' => false, 'error' => 'AI 未配置');
    }
    $payload = array(
        'model' => $conf['model'],
        'messages' => $messages,
        'temperature' => 0.7,
        'max_tokens' => 800,
        'stream' => false,
    );
    $body = json_encode($payload, JSON_UNESCAPED_UNICODE);
    $r = jc_http_request('POST', $conf['url'], array(
        'headers' => array(
            'Content-Type: application/json',
            'Authorization: Bearer ' . $conf['key'],
        ),
        'body' => $body,
        'timeout' => 45,
    ));
    if (!$r['ok']) {
        return array('ok' => false, 'error' => $r['error'] ? $r['error'] : ('接口返回 ' . $r['status']));
    }
    $data = json_decode($r['body'], true);
    if (!is_array($data)) {
        return array('ok' => false, 'error' => '接口返回内容无法解析');
    }
    if (isset($data['error'])) {
        $msg = is_array($data['error']) && isset($data['error']['message']) ? $data['error']['message'] : (string) $data['error'];
        return array('ok' => false, 'error' => $msg);
    }
    $text = '';
    if (isset($data['choices'][0]['message']['content'])) {
        $text = (string) $data['choices'][0]['message']['content'];
    } elseif (isset($data['choices'][0]['text'])) {
        $text = (string) $data['choices'][0]['text'];
    }
    $text = trim($text);
    if ($text === '') {
        return array('ok' => false, 'error' => 'AI 未返回内容');
    }
    return array('ok' => true, 'text' => $text);
}

/**
 * soogif 表情包搜索：抓取服务端渲染的搜索结果页并解析直链。
 * 返回 array 表示成功（可能为空数组）；返回 null 表示抓取失败。
 */
function jc_soogif_search($kw, $limit = 24)
{
    $kw = trim((string) $kw);
    if ($kw === '') {
        return array();
    }
    $limit = max(1, min(48, (int) $limit));
    $url = 'https://www.soogif.com/search/' . rawurlencode($kw);
    $r = jc_http_request('GET', $url, array('timeout' => 15));
    if (!$r['ok'] || $r['body'] === '') {
        return null;
    }
    $html = $r['body'];

    $out = array();
    $seen = array();
    if (preg_match_all('#<img[^>]*class="lazy"[^>]*>#i', $html, $mm)) {
        foreach ($mm[0] as $tag) {
            if (!preg_match('#data-original="([^"]+)"#i', $tag, $m1)) {
                continue;
            }
            if (!preg_match('#\ssrc="([^"]+)"#i', $tag, $m2)) {
                continue;
            }
            $label = '';
            if (preg_match('#\salt="([^"]*)"#i', $tag, $m3)) {
                $label = trim(html_entity_decode($m3[1], ENT_QUOTES, 'UTF-8'));
            }
            $thumb = $m1[1];
            $gif = $m2[1];
            if (strpos($gif, 'img.soogif.com') === false) {
                continue;
            }
            // soogif 直链为 http，前端页面为 https，这里统一改成 https 避免混合内容被拦截
            $gif = preg_replace('#^http:#i', 'https:', $gif);
            $thumb = preg_replace('#^http:#i', 'https:', $thumb);
            $key = md5($gif);
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $out[] = array('id' => $key, 'url' => $gif, 'thumb' => $thumb, 'label' => $label);
            if (count($out) >= $limit) {
                break;
            }
        }
    }
    return $out;
}
