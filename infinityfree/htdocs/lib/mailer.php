<?php
/**
 * 邮件发送（163 SMTP，SSL 465，AUTH LOGIN）
 *
 * InfinityFree 等免费主机通常禁用了 PHP mail()，但允许对外建立 SSL 连接，
 * 因此这里直接用 socket 与 SMTP 服务器对话发信，不依赖任何第三方库。
 * 若连接或认证失败，返回 {sent:false,error:...}，由调用方决定是否降级为回传验证码。
 */

/** 读取一行 SMTP 响应（支持多行：末行为 "250 xxx" 形式） */
function jc_smtp_read($fp)
{
    $data = '';
    $guard = 0;
    while (($line = fgets($fp, 1024)) !== false) {
        $data .= $line;
        // 第 4 个字符为空格表示这是最后一行
        if (strlen($line) < 4 || $line[3] === ' ') {
            break;
        }
        if (++$guard > 200) {
            break;
        }
    }
    return $data;
}

/** 发送命令并校验响应码，返回 [ok, response] */
function jc_smtp_cmd($fp, $cmd, $code)
{
    if ($cmd !== null) {
        @fwrite($fp, $cmd . "\r\n");
    }
    $resp = jc_smtp_read($fp);
    $got = substr(trim($resp), 0, 3);
    return array($got === (string) $code, $resp);
}

/** 编码邮件头中的非 ASCII 文本（RFC 2047） */
function jc_mime_header($text)
{
    $text = (string) $text;
    if ($text === '') {
        return '""';
    }
    if (preg_match('/^[\x20-\x7e]*$/', $text)) {
        return '"' . str_replace(array('\\', '"'), array('\\\\', '\\"'), $text) . '"';
    }
    return '=?UTF-8?B?' . base64_encode($text) . '?=';
}

/**
 * 发送一封 HTML 邮件。
 * @return array{sent:bool, error?:string}
 */
function jc_smtp_send($to, $subject, $html, $text = '')
{
    $host = (string) jc_config('SMTP_HOST');
    $port = (int) jc_config('SMTP_PORT');
    $user = (string) jc_config('SMTP_USER');
    $pass = (string) jc_config('SMTP_PASS');
    $from = (string) jc_config('SMTP_FROM');
    $fromName = (string) jc_config('SMTP_FROM_NAME');

    if ($host === '' || $user === '' || $pass === '' || $from === '') {
        return array('sent' => false, 'error' => 'SMTP 未配置');
    }
    if (!function_exists('stream_socket_client')) {
        return array('sent' => false, 'error' => '主机未开启 socket');
    }
    if (!filter_var($to, FILTER_VALIDATE_EMAIL)) {
        return array('sent' => false, 'error' => '收件人地址不合法');
    }

    $errno = 0;
    $errstr = '';
    $transport = ($port === 465) ? 'ssl://' : '';
    $ctx = stream_context_create(array(
        'ssl' => array(
            'verify_peer' => false,
            'verify_peer_name' => false,
            'allow_self_signed' => true,
        ),
    ));
    $fp = @stream_socket_client($transport . $host . ':' . $port, $errno, $errstr, 12, STREAM_CLIENT_CONNECT, $ctx);
    if (!$fp) {
        return array('sent' => false, 'error' => '连接失败：' . ($errstr !== '' ? $errstr : ('#' . $errno)));
    }
    stream_set_timeout($fp, 12);

    $fail = null;
    $r = jc_smtp_read($fp);
    if (substr(trim($r), 0, 3) !== '220') {
        $fail = '服务无响应：' . trim($r);
    }
    if ($fail === null) {
        list($ok) = jc_smtp_cmd($fp, 'EHLO jaychat', 250);
        if (!$ok) {
            // 部分服务器只认 HELO
            list($ok) = jc_smtp_cmd($fp, 'HELO jaychat', 250);
        }
        if (!$ok) {
            $fail = 'EHLO 失败';
        }
    }
    if ($fail === null) {
        list($ok) = jc_smtp_cmd($fp, 'AUTH LOGIN', 334);
        if (!$ok) {
            $fail = 'AUTH 不被支持';
        }
    }
    if ($fail === null) {
        list($ok) = jc_smtp_cmd($fp, base64_encode($user), 334);
        if (!$ok) {
            $fail = '用户名被拒绝';
        }
    }
    if ($fail === null) {
        list($ok, $resp) = jc_smtp_cmd($fp, base64_encode($pass), 235);
        if (!$ok) {
            $fail = '认证失败，请检查 SMTP 授权码（' . trim($resp) . '）';
        }
    }
    if ($fail === null) {
        list($ok) = jc_smtp_cmd($fp, 'MAIL FROM:<' . $from . '>', 250);
        if (!$ok) {
            $fail = '发件人被拒绝';
        }
    }
    if ($fail === null) {
        list($ok) = jc_smtp_cmd($fp, 'RCPT TO:<' . $to . '>', 250);
        if (!$ok) {
            $fail = '收件人被拒绝';
        }
    }
    if ($fail === null) {
        list($ok) = jc_smtp_cmd($fp, 'DATA', 354);
        if (!$ok) {
            $fail = 'DATA 被拒绝';
        }
    }
    if ($fail === null) {
        $boundary = 'jc' . bin2hex(random_bytes(8));
        $headers = array(
            'From: ' . jc_mime_header($fromName) . ' <' . $from . '>',
            'To: <' . $to . '>',
            'Subject: ' . jc_mime_header($subject),
            'MIME-Version: 1.0',
            'Content-Type: multipart/alternative; boundary="' . $boundary . '"',
            'Date: ' . gmdate('D, d M Y H:i:s') . ' +0000',
            'Message-ID: <' . bin2hex(random_bytes(10)) . '@jaychat>',
        );
        $plain = $text !== '' ? $text : strip_tags($html);
        $body = implode("\r\n", $headers) . "\r\n\r\n"
            . '--' . $boundary . "\r\n"
            . "Content-Type: text/plain; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($plain), 76, "\r\n")
            . '--' . $boundary . "\r\n"
            . "Content-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n"
            . chunk_split(base64_encode($html), 76, "\r\n")
            . '--' . $boundary . "--\r\n";
        // 行首的 "." 需要转义
        $body = preg_replace('/^\./m', '..', $body);
        @fwrite($fp, $body . "\r\n.\r\n");
        $resp = jc_smtp_read($fp);
        if (substr(trim($resp), 0, 3) !== '250') {
            $fail = '投递失败：' . trim($resp);
        }
    }

    @fwrite($fp, "QUIT\r\n");
    @fclose($fp);

    if ($fail !== null) {
        return array('sent' => false, 'error' => $fail);
    }
    return array('sent' => true);
}

/** 发送验证码邮件的 HTML 模板 */
function jc_code_mail_html($code, $purpose)
{
    $title = ($purpose === 'reset') ? '重置密码' : '注册';
    return '<div style="font-family:-apple-system,\'PingFang SC\',sans-serif;max-width:520px;margin:auto;padding:28px;background:#f5f7fb;border-radius:16px">'
        . '<h2 style="margin:0 0 8px;color:#111">Jay Chat 验证码</h2>'
        . '<p style="color:#555;font-size:14px;margin:0 0 18px">你的' . $title . '验证码是（5 分钟内有效）：</p>'
        . '<div style="font-size:34px;letter-spacing:10px;font-weight:700;color:#2b7cff;background:#fff;border-radius:12px;padding:16px;text-align:center">' . htmlspecialchars($code, ENT_QUOTES, 'UTF-8') . '</div>'
        . '<p style="color:#999;font-size:12px;margin-top:18px">如非本人操作请忽略此邮件。</p></div>';
}
