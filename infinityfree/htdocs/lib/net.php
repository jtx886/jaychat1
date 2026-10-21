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
 * 调用 AI 接口。
 * 自动兼容两种协议：
 *   1) OpenAI Chat Completions：POST /v1/chat/completions  {messages:[...]}
 *   2) OpenAI Responses API：POST /v1/responses  {instructions, input}（腾讯 TokenHub 等）
 * @param array $messages [{role,content}, ...]
 * @return array{ok:bool, text?:string, error?:string}
 */
function jc_ai_chat($messages)
{
    $conf = jc_ai_conf();
    if ($conf['url'] === '' || $conf['key'] === '') {
        return array('ok' => false, 'error' => 'AI 未配置');
    }
    $messages = is_array($messages) ? $messages : array();
    // URL 以 /responses 结尾 → 走 Responses API
    $isResponses = (bool) preg_match('#/responses/?(\?.*)?$#i', $conf['url']);

    if ($isResponses) {
        $instructions = array();
        $input = array();
        foreach ($messages as $m) {
            $role = isset($m['role']) ? (string) $m['role'] : 'user';
            $content = isset($m['content']) ? (string) $m['content'] : '';
            if ($content === '') {
                continue;
            }
            if ($role === 'system') {
                $instructions[] = $content;
            } else {
                $input[] = array(
                    'role' => ($role === 'assistant' ? 'assistant' : 'user'),
                    'content' => $content,
                );
            }
        }
        // 单轮提问用字符串，与 TokenHub 文档示例一致；多轮上下文用消息数组
        $inputPayload = (count($input) === 1 && $input[0]['role'] === 'user') ? $input[0]['content'] : $input;
        if ($inputPayload === array()) {
            $inputPayload = '你好';
        }
        $payload = array(
            'model' => $conf['model'],
            'instructions' => $instructions ? implode("\n", $instructions) : 'You are a helpful assistant.',
            'input' => $inputPayload,
            'stream' => false,
        );
    } else {
        $payload = array(
            'model' => $conf['model'],
            'messages' => $messages,
            'temperature' => 0.7,
            'max_tokens' => 800,
            'stream' => false,
        );
    }

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
        // 尽量把接口返回的错误原因带给管理员，方便排查配置
        $detail = '';
        $jb = json_decode((string) $r['body'], true);
        if (is_array($jb) && isset($jb['error'])) {
            $detail = is_array($jb['error']) && isset($jb['error']['message'])
                ? (string) $jb['error']['message']
                : (is_string($jb['error']) ? $jb['error'] : '');
        }
        $detail = mb_substr(trim($detail), 0, 200, 'UTF-8');
        return array('ok' => false, 'error' => $r['error'] ? $r['error'] : ('接口返回 ' . $r['status'] . ($detail !== '' ? '：' . $detail : '')));
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
    // Responses API：顶层 output_text（部分平台提供）
    if (isset($data['output_text']) && is_string($data['output_text'])) {
        $text = $data['output_text'];
    }
    // Responses API：output[].content[].text
    if ($text === '' && isset($data['output']) && is_array($data['output'])) {
        $buf = array();
        foreach ($data['output'] as $item) {
            if (!is_array($item) || !isset($item['content']) || !is_array($item['content'])) {
                continue;
            }
            foreach ($item['content'] as $c) {
                if (!is_array($c)) {
                    continue;
                }
                $type = isset($c['type']) ? (string) $c['type'] : '';
                if ($type === 'output_text' || $type === 'text' || $type === '') {
                    if (isset($c['text']) && is_string($c['text'])) {
                        $buf[] = $c['text'];
                    }
                }
            }
        }
        $text = implode("\n", $buf);
    }
    // Chat Completions
    if ($text === '' && isset($data['choices'][0]['message']['content'])) {
        $text = (string) $data['choices'][0]['message']['content'];
    }
    if ($text === '' && isset($data['choices'][0]['text'])) {
        $text = (string) $data['choices'][0]['text'];
    }
    $text = trim($text);
    if ($text === '') {
        return array('ok' => false, 'error' => 'AI 未返回内容');
    }
    return array('ok' => true, 'text' => $text);
}

/**
 * 解析 soogif 列表页 HTML。
 * 返回 array(items, base, max_page, total)：
 *   items    表情直链数组
 *   base     规范化列表页 slug/ID（用于拼后续分页地址）
 *   max_page 总页数（从分页器解析，例如 657）
 *   total    该关键词的结果总数（“共为您找到 N 张”）
 */
function jc_soogif_parse($html)
{
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
        }
    }

    // 分页器：形如 href="744045-2-0-0.html"，其中 744045 为 base、2 为页码
    $base = '';
    $maxPage = 1;
    if (preg_match_all('#([A-Za-z0-9]+)-(\d+)-0-0\.html#', $html, $pm, PREG_SET_ORDER)) {
        foreach ($pm as $m) {
            if ($base === '') {
                $base = $m[1];
            }
            $n = (int) $m[2];
            if ($n > $maxPage) {
                $maxPage = $n;
            }
        }
    }

    $total = 0;
    if (preg_match('#共为您找到(\d+)张#u', $html, $tm)) {
        $total = (int) $tm[1];
    }

    return array('items' => $out, 'base' => $base, 'max_page' => $maxPage, 'total' => $total);
}

/** 抓取失败的友好提示 */
function jc_soogif_error($r)
{
    if ((int) $r['status'] === 429) {
        return '表情网站请求过于频繁，请稍后再试';
    }
    return '表情资源获取失败，请稍后重试';
}

/**
 * 抓取 soogif 搜索结果的第 $page 页（每页约 19~20 张）。
 * - page<=1：请求 /search/<kw>（会 301 到规范化列表页）
 * - page>1 ：请求 /gif/<base>-<page>-0-0.html（need base，缺失时先解析一次）
 * 返回 array(ok, items, base, page, max_page, total, error)
 */
function jc_soogif_page($kw, $page = 1, $base = '')
{
    $kw = trim((string) $kw);
    if ($kw === '') {
        return array('ok' => false, 'error' => '关键词为空');
    }
    $page = max(1, (int) $page);
    $base = trim((string) $base);

    if ($page <= 1) {
        $url = 'https://www.soogif.com/search/' . rawurlencode($kw);
    } else {
        if ($base === '') {
            // 先解析一次规范化地址，才能拼分页链接
            $r0 = jc_http_request('GET', 'https://www.soogif.com/search/' . rawurlencode($kw), array('timeout' => 20));
            if (!$r0['ok'] || $r0['body'] === '') {
                return array('ok' => false, 'error' => jc_soogif_error($r0));
            }
            $p0 = jc_soogif_parse($r0['body']);
            $base = $p0['base'];
        }
        if ($base === '') {
            return array('ok' => true, 'items' => array(), 'base' => '', 'page' => $page, 'max_page' => $page, 'total' => 0);
        }
        $url = 'https://www.soogif.com/gif/' . $base . '-' . $page . '-0-0.html';
    }

    $r = jc_http_request('GET', $url, array('timeout' => 20));
    if (!$r['ok'] || $r['body'] === '') {
        return array('ok' => false, 'error' => jc_soogif_error($r));
    }
    $p = jc_soogif_parse($r['body']);
    return array(
        'ok' => true,
        'items' => $p['items'],
        'base' => ($base !== '' ? $base : $p['base']),
        'page' => $page,
        'max_page' => max(1, (int) $p['max_page']),
        'total' => (int) $p['total'],
    );
}

/**
 * 兼容旧接口：取第 1 页并截断到 $limit 条（用于「相关表情」）。
 * 返回 array 表示成功（可能为空数组）；返回 null 表示抓取失败。
 */
function jc_soogif_search($kw, $limit = 24)
{
    $r = jc_soogif_page($kw, 1);
    if (empty($r['ok'])) {
        return null;
    }
    return array_slice($r['items'], 0, max(1, (int) $limit));
}
