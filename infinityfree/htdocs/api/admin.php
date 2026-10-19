<?php
/**
 * /api/admin/* —— 管理员后台
 *
 *   GET    /api/admin/overview        总览：注册/在线/群聊/消息等全站数据
 *   GET    /api/admin/ai              AI 配置读取
 *   PATCH  /api/admin/ai              AI 配置保存（模型/密钥/接口/名称/头像）
 *   GET    /api/admin/users           用户列表（支持关键词搜索）
 *   POST   /api/admin/users/{id}/ban   封禁（days>0 封 N 天，days=0 永久）
 *   POST   /api/admin/users/{id}/unban 解封
 *   POST   /api/admin/users/{id}/mute  禁言（minutes 分钟）
 *   POST   /api/admin/users/{id}/unmute 解除禁言
 *
 * 仅管理员可访问（role=admin / 官方账号 / ADMIN_EMAILS 白名单）。
 */

/** 用户对象转后台展示结构 */
function admin_user_row($u)
{
    $ban = jc_ban_state($u);
    $muted = isset($u['muted_until']) ? (int) $u['muted_until'] : 0;
    return array(
        'id' => (int) $u['id'],
        'username' => (string) $u['username'],
        'email' => (string) $u['email'],
        'avatar' => isset($u['avatar']) ? (string) $u['avatar'] : '',
        'role' => isset($u['role']) ? (string) $u['role'] : 'user',
        'is_official' => !empty($u['is_official']),
        'is_admin' => jc_is_admin($u),
        'online' => user_is_online($u),
        'last_seen' => (int) (isset($u['last_seen']) ? $u['last_seen'] : 0),
        'created_at' => (int) $u['created_at'],
        'banned' => $ban['banned'],
        'banned_until' => $ban['until'],
        'muted' => $muted > now_ms(),
        'muted_until' => $muted,
    );
}

/** 目标用户校验：不能操作自己/其他管理员 */
function admin_load_target($gid)
{
    $u = get_user($gid);
    if (!$u) {
        api_abort(404, '用户不存在');
    }
    if ((int) $u['id'] === (int) require_auth()) {
        api_abort(400, '不能对自己执行该操作');
    }
    if (jc_is_admin($u)) {
        api_abort(403, '不能操作其他管理员');
    }
    return $u;
}

/* ------------------------------- 总览 ------------------------------- */

route('GET', '#^/api/admin/overview$#', function ($params, $body) {
    jc_require_admin();

    $now = now_ms();
    $utcToday = new DateTime('now', new DateTimeZone('UTC'));
    $utcToday->setTime(0, 0, 0);
    $todayStart = (int) $utcToday->getTimestamp() * 1000;
    $weekStart = $now - 7 * 86400000;

    $totalUsers = (int) db_value('SELECT COUNT(*) FROM `users`');
    $todayUsers = (int) db_value('SELECT COUNT(*) FROM `users` WHERE `created_at` >= ?', array($todayStart));
    $weekUsers = (int) db_value('SELECT COUNT(*) FROM `users` WHERE `created_at` >= ?', array($weekStart));
    $onlineUsers = (int) db_value('SELECT COUNT(*) FROM `users` WHERE `online` = 1 AND `last_poll` > ?', array($now - 60000));
    $groupCount = (int) db_value('SELECT COUNT(*) FROM `groups`');
    $msgCount = (int) db_value('SELECT COUNT(*) FROM `messages`');
    $todayMsg = (int) db_value('SELECT COUNT(*) FROM `messages` WHERE `created_at` >= ?', array($todayStart));
    $momentCount = (int) db_value('SELECT COUNT(*) FROM `moments` WHERE `deleted` = 0');
    $bannedCount = (int) db_value('SELECT COUNT(*) FROM `users` WHERE `banned` = 1');
    $mutedCount = (int) db_value('SELECT COUNT(*) FROM `users` WHERE `muted_until` > ?', array($now));

    // 近 7 天每日注册 / 消息量
    $days = array();
    for ($i = 6; $i >= 0; $i--) {
        $d = new DateTime('now', new DateTimeZone('UTC'));
        $d->setTime(0, 0, 0);
        $d->modify('-' . $i . ' day');
        $start = (int) $d->getTimestamp() * 1000;
        $end = $start + 86400000;
        $days[] = array(
            'date' => $d->format('Y-m-d'),
            'label' => $d->format('m-d'),
            'users' => (int) db_value('SELECT COUNT(*) FROM `users` WHERE `created_at` >= ? AND `created_at` < ?', array($start, $end)),
            'messages' => (int) db_value('SELECT COUNT(*) FROM `messages` WHERE `created_at` >= ? AND `created_at` < ?', array($start, $end)),
        );
    }

    // 最新注册用户
    $recent = array();
    foreach (db_all('SELECT * FROM `users` ORDER BY `id` DESC LIMIT 8') as $u) {
        $recent[] = admin_user_row($u);
    }

    return array(200, array(
        'stats' => array(
            'total_users' => $totalUsers,
            'today_users' => $todayUsers,
            'week_users' => $weekUsers,
            'online_users' => $onlineUsers,
            'groups' => $groupCount,
            'messages' => $msgCount,
            'today_messages' => $todayMsg,
            'moments' => $momentCount,
            'banned' => $bannedCount,
            'muted' => $mutedCount,
        ),
        'days' => $days,
        'recent_users' => $recent,
        'server_time' => $now,
    ));
});

/* ------------------------------ AI 配置 ------------------------------ */

route('GET', '#^/api/admin/ai$#', function ($params, $body) {
    jc_require_admin();
    $c = jc_ai_conf();
    return array(200, array(
        'config' => array(
            'url' => $c['url'],
            'key' => $c['key'],
            'model' => $c['model'],
            'name' => $c['name'] !== '' ? $c['name'] : 'Jay AI',
            'avatar' => $c['avatar'],
        ),
    ));
});

route('PATCH', '#^/api/admin/ai$#', function ($params, $body) {
    jc_require_admin();
    $map = array('url' => 'ai_url', 'key' => 'ai_key', 'model' => 'ai_model', 'name' => 'ai_name', 'avatar' => 'ai_avatar');
    foreach ($map as $field => $key) {
        if (array_key_exists($field, $body)) {
            $val = trim((string) $body[$field]);
            if ($field === 'url') {
                $val = mb_substr($val, 0, 500, 'UTF-8');
                if ($val !== '' && !preg_match('#^https?://#i', $val)) {
                    return array(400, array('error' => '接口地址需以 http:// 或 https:// 开头'));
                }
            } elseif ($field === 'name') {
                $val = mb_substr($val, 0, 20, 'UTF-8');
            } elseif ($field === 'model') {
                $val = mb_substr($val, 0, 100, 'UTF-8');
            }
            jc_setting_set($key, $val);
        }
    }
    return array(200, array('ok' => true, 'config' => jc_ai_conf_public_out()));
});

/** AI 配置输出（返回给前端，含明文密钥，仅管理员可见） */
function jc_ai_conf_public_out()
{
    $c = jc_ai_conf();
    return array(
        'url' => $c['url'],
        'key' => $c['key'],
        'model' => $c['model'],
        'name' => $c['name'] !== '' ? $c['name'] : 'Jay AI',
        'avatar' => $c['avatar'],
    );
}

/* ------------------------------ 用户管理 ------------------------------ */

route('GET', '#^/api/admin/users$#', function ($params, $body) {
    jc_require_admin();
    $q = isset($_GET['q']) ? trim((string) $_GET['q']) : '';
    $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 100;
    if ($limit < 1 || $limit > 300) {
        $limit = 100;
    }
    if ($q !== '') {
        $like = '%' . $q . '%';
        $rows = db_all(
            'SELECT * FROM `users` WHERE `username` LIKE ? OR `email` LIKE ? ORDER BY `id` DESC LIMIT ' . (int) $limit,
            array($like, $like)
        );
    } else {
        $rows = db_all('SELECT * FROM `users` ORDER BY `id` DESC LIMIT ' . (int) $limit);
    }
    $users = array();
    foreach ($rows as $u) {
        $users[] = admin_user_row($u);
    }
    return array(200, array('users' => $users, 'total' => (int) db_value('SELECT COUNT(*) FROM `users`')));
});

route('POST', '#^/api/admin/users/(\d+)/ban$#', function ($params, $body) {
    jc_require_admin();
    $u = admin_load_target((int) $params[0]);
    $days = isset($body['days']) ? (int) $body['days'] : 0;
    $until = $days > 0 ? (now_ms() + $days * 86400000) : 0;
    db_run('UPDATE `users` SET `banned` = 1, `banned_until` = ?, `online` = 0 WHERE `id` = ?', array($until, (int) $u['id']));
    $nu = get_user((int) $u['id']);
    event_to_user((int) $u['id'], 'account:banned', array('banned' => true, 'until' => $until));
    return array(200, array('ok' => true, 'user' => admin_user_row($nu)));
});

route('POST', '#^/api/admin/users/(\d+)/unban$#', function ($params, $body) {
    jc_require_admin();
    $u = get_user((int) $params[0]);
    if (!$u) {
        return array(404, array('error' => '用户不存在'));
    }
    db_run('UPDATE `users` SET `banned` = 0, `banned_until` = 0 WHERE `id` = ?', array((int) $u['id']));
    $nu = get_user((int) $u['id']);
    event_to_user((int) $u['id'], 'account:unbanned', array('banned' => false));
    return array(200, array('ok' => true, 'user' => admin_user_row($nu)));
});

route('POST', '#^/api/admin/users/(\d+)/mute$#', function ($params, $body) {
    jc_require_admin();
    $u = admin_load_target((int) $params[0]);
    $minutes = isset($body['minutes']) ? (int) $body['minutes'] : 0;
    if ($minutes < 1) {
        $minutes = 60;
    }
    if ($minutes > 30 * 24 * 60) {
        $minutes = 30 * 24 * 60;
    }
    $until = now_ms() + $minutes * 60000;
    db_run('UPDATE `users` SET `muted_until` = ? WHERE `id` = ?', array($until, (int) $u['id']));
    $nu = get_user((int) $u['id']);
    event_to_user((int) $u['id'], 'account:muted', array('until' => $until));
    return array(200, array('ok' => true, 'user' => admin_user_row($nu)));
});

route('POST', '#^/api/admin/users/(\d+)/unmute$#', function ($params, $body) {
    jc_require_admin();
    $u = get_user((int) $params[0]);
    if (!$u) {
        return array(404, array('error' => '用户不存在'));
    }
    db_run('UPDATE `users` SET `muted_until` = 0 WHERE `id` = ?', array((int) $u['id']));
    $nu = get_user((int) $u['id']);
    event_to_user((int) $u['id'], 'account:unmuted', array());
    return array(200, array('ok' => true, 'user' => admin_user_row($nu)));
});

/* --------------------------- AI 公开信息 --------------------------- */

// 聊天页展示用：AI 显示名称与头像（管理员可自定义）
route('GET', '#^/api/ai/profile$#', function ($params, $body) {
    require_auth();
    return array(200, array('profile' => jc_ai_public()));
});
