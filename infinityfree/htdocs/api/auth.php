<?php
/**
 * /api/auth/* —— 注册 / 登录 / 验证码 / 找回密码 / 当前用户
 */

/** ISO 周（与 Node 的 weekKey 对齐，UTC 计算） */
function jc_week_key()
{
    $tz = new DateTimeZone('UTC');
    $t = new DateTime(gmdate('Y-m-d'), $tz);
    $dow = (int) $t->format('N'); // 1=周一 .. 7=周日
    $t->modify('+' . (4 - $dow) . ' days');
    $yearStart = new DateTime($t->format('Y') . '-01-01', $tz);
    $days = (int) $t->diff($yearStart)->days + 1;
    $week = (int) ceil($days / 7);
    return sprintf('%04d-W%02d', (int) $t->format('Y'), $week);
}

/** 校验验证码；通过则标记已用，返回 null；否则返回错误文案 */
function jc_check_code($email, $purpose, $code)
{
    $row = db_one(
        'SELECT * FROM `verify_codes` WHERE `email` = ? AND `purpose` = ? AND `used` = 0 AND `expires_at` > ? ORDER BY `id` DESC LIMIT 1',
        array($email, $purpose, now_ms())
    );
    if (!$row) {
        return '验证码不存在或已过期';
    }
    if ((string) $row['code'] !== trim((string) $code)) {
        return '验证码错误';
    }
    db_run('UPDATE `verify_codes` SET `used` = 1 WHERE `id` = ?', array((int) $row['id']));
    return null;
}

/** 生成 6 位数字验证码 */
function jc_gen_code()
{
    return (string) random_int(100000, 999999);
}

// 发送验证码
route('POST', '#^/api/auth/send-code$#', function ($params, $body) {
    $email = isset($body['email']) ? (string) $body['email'] : '';
    $purpose = isset($body['purpose']) && $body['purpose'] !== '' ? (string) $body['purpose'] : 'register';
    if (!email_valid($email)) {
        return array(400, array('error' => '邮箱只支持 @qq.com 或 @163.com'));
    }
    $exists = db_one('SELECT `id` FROM `users` WHERE `email` = ?', array($email));
    if ($purpose === 'register' && $exists) {
        return array(400, array('error' => '该邮箱已注册，请直接登录'));
    }
    if ($purpose === 'reset' && !$exists) {
        return array(400, array('error' => '该邮箱尚未注册'));
    }

    // 简单限流：同一邮箱 60 秒内只能发一次
    $last = db_one('SELECT `created_at` FROM `verify_codes` WHERE `email` = ? ORDER BY `id` DESC LIMIT 1', array($email));
    if ($last) {
        $elapsed = now_ms() - (int) $last['created_at'];
        if ($elapsed < 60000) {
            return array(429, array('error' => '请 ' . (int) ceil((60000 - $elapsed) / 1000) . ' 秒后再试'));
        }
    }

    $code = jc_gen_code();
    db_insert(
        'INSERT INTO `verify_codes` (`email`, `code`, `purpose`, `expires_at`, `used`, `created_at`) VALUES (?, ?, ?, ?, 0, ?)',
        array($email, $code, $purpose, now_ms() + 5 * 60000, now_ms())
    );

    // 通过 163 SMTP 发送验证码邮件；失败时按 ALLOW_DEV_CODE 回传验证码兜底
    $subject = ($purpose === 'reset' ? '重置密码' : '注册') . '验证码 - Jay Chat';
    $mail = jc_smtp_send($email, $subject, jc_code_mail_html($code, $purpose));
    if (!empty($mail['sent'])) {
        return array(200, array('ok' => true, 'sent' => true, 'hint' => '验证码已发送至 ' . $email . '，请查收（含垃圾箱）'));
    }
    $dev = jc_config('ALLOW_DEV_CODE') ? $code : null;
    return array(200, array(
        'ok' => true,
        'sent' => false,
        'devCode' => $dev,
        'hint' => '邮件发送失败：' . (isset($mail['error']) && $mail['error'] !== '' ? $mail['error'] : '未知原因')
            . ($dev !== null ? '，验证码为 ' . $dev : ''),
    ));
});

// 注册
route('POST', '#^/api/auth/register$#', function ($params, $body) {
    $username = isset($body['username']) ? $body['username'] : null;
    $email = isset($body['email']) ? (string) $body['email'] : '';
    $password = isset($body['password']) ? $body['password'] : null;
    $code = isset($body['code']) ? $body['code'] : null;

    $nameErr = validate_username($username);
    if ($nameErr) {
        return array(400, array('error' => $nameErr));
    }
    if (!email_valid($email)) {
        return array(400, array('error' => '邮箱只支持 @qq.com 或 @163.com'));
    }
    $pwdErr = validate_password($password);
    if ($pwdErr) {
        return array(400, array('error' => $pwdErr));
    }
    $uname = trim((string) $username);
    if (db_one('SELECT `id` FROM `users` WHERE `username` = ?', array($uname))) {
        return array(400, array('error' => '该昵称已被使用'));
    }
    if (db_one('SELECT `id` FROM `users` WHERE `email` = ?', array($email))) {
        return array(400, array('error' => '该邮箱已注册'));
    }
    $codeErr = jc_check_code($email, 'register', $code);
    if ($codeErr) {
        return array(400, array('error' => $codeErr));
    }

    $uid = db_insert(
        'INSERT INTO `users` (`username`, `email`, `pwd`, `avatar`, `created_at`) VALUES (?, ?, ?, ?, ?)',
        array($uname, $email, hash_password($password), '', now_ms())
    );
    join_official_group($uid);

    $u = get_user($uid);
    return array(200, array('token' => sign_token($uid), 'user' => self_user($u)));
});

// 登录：用户名或邮箱 + 密码
route('POST', '#^/api/auth/login$#', function ($params, $body) {
    $account = isset($body['account']) ? trim((string) $body['account']) : '';
    $password = isset($body['password']) ? $body['password'] : '';
    if ($account === '' || !$password) {
        return array(400, array('error' => '请输入账号和密码'));
    }
    $u = strpos($account, '@') !== false
        ? db_one('SELECT * FROM `users` WHERE `email` = ?', array($account))
        : db_one('SELECT * FROM `users` WHERE `username` = ?', array($account));
    if (!$u) {
        return array(400, array('error' => '账号不存在'));
    }
    if (!verify_password($password, $u['pwd'])) {
        return array(400, array('error' => '密码错误'));
    }
    $ban = jc_ban_state($u);
    if ($ban['banned']) {
        return array(403, array('error' => $ban['until'] > 0
            ? ('该账号已被封禁，剩余 ' . (int) ceil(($ban['until'] - now_ms()) / 1000) . ' 秒')
            : '该账号已被永久封禁'));
    }
    return array(200, array('token' => sign_token((int) $u['id']), 'user' => self_user($u)));
});

// 忘记密码
route('POST', '#^/api/auth/reset-password$#', function ($params, $body) {
    $email = isset($body['email']) ? (string) $body['email'] : '';
    $code = isset($body['code']) ? $body['code'] : null;
    $password = isset($body['password']) ? $body['password'] : null;
    if (!email_valid($email)) {
        return array(400, array('error' => '邮箱格式不正确'));
    }
    $pwdErr = validate_password($password);
    if ($pwdErr) {
        return array(400, array('error' => $pwdErr));
    }
    $u = db_one('SELECT * FROM `users` WHERE `email` = ?', array($email));
    if (!$u) {
        return array(400, array('error' => '该邮箱尚未注册'));
    }
    $codeErr = jc_check_code($email, 'reset', $code);
    if ($codeErr) {
        return array(400, array('error' => $codeErr));
    }
    db_run('UPDATE `users` SET `pwd` = ? WHERE `id` = ?', array(hash_password($password), (int) $u['id']));
    return array(200, array('ok' => true));
});

// 当前用户
route('GET', '#^/api/auth/me$#', function ($params, $body) {
    $uid = require_auth();
    $u = get_user($uid);
    if (!$u) {
        return array(404, array('error' => '用户不存在'));
    }
    return array(200, array('user' => self_user($u)));
});

// 修改昵称 / 头像 / 签名（昵称一周最多改 2 次）
route('PATCH', '#^/api/auth/me$#', function ($params, $body) {
    $uid = require_auth();
    $u = get_user($uid);
    $username = array_key_exists('username', $body) ? $body['username'] : null;
    $avatar = array_key_exists('avatar', $body) ? $body['avatar'] : null;
    $bio = array_key_exists('bio', $body) ? $body['bio'] : null;

    if (array_key_exists('username', $body) && (string) $username !== (string) $u['username']) {
        $err = validate_username($username);
        if ($err) {
            return array(400, array('error' => $err));
        }
        $wk = jc_week_key();
        $count = ((string) $u['name_week'] === $wk) ? (int) $u['name_count'] : 0;
        if ($count >= 2) {
            return array(400, array('error' => '昵称一周只能修改 2 次'));
        }
        $uname = trim((string) $username);
        if (db_one('SELECT `id` FROM `users` WHERE `username` = ? AND `id` != ?', array($uname, $uid))) {
            return array(400, array('error' => '该昵称已被使用'));
        }
        db_run('UPDATE `users` SET `username` = ?, `name_week` = ?, `name_count` = ? WHERE `id` = ?', array($uname, $wk, $count + 1, $uid));
    }
    if ($avatar !== null) {
        db_run('UPDATE `users` SET `avatar` = ? WHERE `id` = ?', array((string) $avatar, $uid));
    }
    if ($bio !== null) {
        db_run('UPDATE `users` SET `bio` = ? WHERE `id` = ?', array((string) $bio, $uid));
    }

    $nu = get_user($uid);
    $remaining = ((string) $nu['name_week'] === jc_week_key()) ? max(0, 2 - (int) $nu['name_count']) : 2;
    return array(200, array('user' => self_user($nu), 'remaining' => $remaining));
});

route('POST', '#^/api/auth/logout$#', function ($params, $body) {
    $uid = require_auth();
    db_run('UPDATE `users` SET `online` = 0, `last_seen` = ? WHERE `id` = ?', array(now_ms(), $uid));
    return array(200, array('ok' => true));
});
