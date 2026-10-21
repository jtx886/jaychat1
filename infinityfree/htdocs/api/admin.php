<?php
/**
 * /api/admin/* —— 管理员后台
 *
 *   GET    /api/admin/overview        总览：注册/在线/群聊/消息等全站数据
 *   GET    /api/admin/ai              AI 配置读取
 *   POST   /api/admin/ai              AI 配置保存（模型/密钥/接口/名称/头像）
 *   PATCH  /api/admin/ai              同上（兼容旧版前端）
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

$jc_ai_save = function ($params, $body) {
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
            } elseif ($field === 'key') {
                // 部分主机对超长请求有限制，密钥无需超过 500 字符
                $val = mb_substr($val, 0, 500, 'UTF-8');
            } elseif ($field === 'avatar') {
                $val = mb_substr($val, 0, 500, 'UTF-8');
            }
            jc_setting_set($key, $val);
        }
    }
    return array(200, array('ok' => true, 'config' => jc_ai_conf_public_out()));
};
// POST 为主：部分共享主机 / WAF 会拦截 PATCH 等非常用方法，导致配置看似保存成功但实际未落库
route('POST', '#^/api/admin/ai$#', $jc_ai_save);
route('PATCH', '#^/api/admin/ai$#', $jc_ai_save);

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

/* ---------------------------- 聊天记录 ---------------------------- */

/**
 * 私聊会话里取出与某用户相关的全部会话（用于「选完用户后看他和谁聊过」）。
 * 直接按 conv_id 拆分判断，避免 LIKE 模糊匹配误伤。
 */
function admin_dm_convs_of_user($uid)
{
    $uid = (int) $uid;
    $rows = db_all("SELECT DISTINCT `conv_id` FROM `messages` WHERE `conv_type` = 'dm'");
    $out = array();
    foreach ($rows as $r) {
        $parts = array_map('intval', explode('_', (string) $r['conv_id']));
        if (!in_array($uid, $parts, true)) {
            continue;
        }
        $peer = 0;
        foreach ($parts as $p) {
            if ($p !== $uid) {
                $peer = $p;
                break;
            }
        }
        if ($peer > 0) {
            $out[$peer] = (string) $r['conv_id'];
        }
    }
    return $out;
}

/** 管理端消息行（含撤回原文） */
function admin_message_row($m, $recalled_map = null)
{
    $row = build_message($m);
    if (!empty($m['recalled'])) {
        $r = null;
        if (is_array($recalled_map) && isset($recalled_map[(int) $m['id']])) {
            $r = $recalled_map[(int) $m['id']];
        } else {
            $r = db_one('SELECT * FROM `message_recalled` WHERE `message_id` = ?', array((int) $m['id']));
        }
        if ($r) {
            $row['orig'] = array(
                'msg_type' => (string) $r['msg_type'],
                'content' => (string) $r['content'],
                'media_url' => (string) $r['media_url'],
                'media_thumb' => isset($r['media_thumb']) ? (string) $r['media_thumb'] : '',
                'created_at' => (int) $r['created_at'],
                'recalled_at' => isset($r['recalled_at']) ? (int) $r['recalled_at'] : 0,
            );
        }
    }
    return $row;
}

/** 群聊列表（供后台选择指定群聊） */
route('GET', '#^/api/admin/chat/groups$#', function ($params, $body) {
    jc_require_admin();
    $rows = db_all('SELECT * FROM `groups` ORDER BY `id` DESC');
    $list = array();
    foreach ($rows as $g) {
        $gid = (int) $g['id'];
        $list[] = array(
            'id' => $gid,
            'name' => (string) $g['name'],
            'avatar' => isset($g['avatar']) ? (string) $g['avatar'] : '',
            'is_official' => !empty($g['is_official']),
            'member_count' => count(group_members($gid)),
            'msg_count' => (int) db_value('SELECT COUNT(*) FROM `messages` WHERE `conv_type` = \'group\' AND `conv_id` = ?', array((string) $gid)),
            'last_time' => (int) db_value('SELECT MAX(`created_at`) FROM `messages` WHERE `conv_type` = \'group\' AND `conv_id` = ?', array((string) $gid)),
        );
    }
    return array(200, array('groups' => $list));
});

/** 某用户的私聊对象列表 */
route('GET', '#^/api/admin/chat/peers$#', function ($params, $body) {
    jc_require_admin();
    $uid = isset($_GET['userId']) ? (int) $_GET['userId'] : 0;
    if ($uid <= 0) {
        return array(400, array('error' => '缺少 userId'));
    }
    $me = get_user($uid);
    if (!$me) {
        return array(404, array('error' => '用户不存在'));
    }
    $convs = admin_dm_convs_of_user($uid);
    $list = array();
    foreach ($convs as $peerId => $convId) {
        $peer = get_user($peerId);
        if (!$peer) {
            continue;
        }
        $lm = db_one(
            'SELECT * FROM `messages` WHERE `conv_type` = \'dm\' AND `conv_id` = ? ORDER BY `id` DESC LIMIT 1',
            array((string) $convId)
        );
        $list[] = array(
            'conv_id' => (string) $convId,
            'peer' => public_user($peer),
            'msg_count' => (int) db_value('SELECT COUNT(*) FROM `messages` WHERE `conv_type` = \'dm\' AND `conv_id` = ?', array((string) $convId)),
            'last_time' => $lm ? (int) $lm['created_at'] : 0,
            'last_text' => $lm ? (string) $lm['content'] : '',
            'last_recalled' => $lm ? !empty($lm['recalled']) : false,
        );
    }
    usort($list, function ($a, $b) {
        return $b['last_time'] - $a['last_time'];
    });
    return array(200, array(
        'user' => public_user($me),
        'peers' => $list,
    ));
});

/** 指定会话的全部聊天记录（私聊 / 群聊，含撤回原文） */
route('GET', '#^/api/admin/chat/messages$#', function ($params, $body) {
    jc_require_admin();
    $convType = isset($_GET['convType']) ? (string) $_GET['convType'] : 'group';
    $convId = isset($_GET['convId']) ? (string) $_GET['convId'] : '';
    if ($convType !== 'dm' && $convType !== 'group') {
        return array(400, array('error' => 'convType 不合法'));
    }
    if ($convId === '') {
        return array(400, array('error' => '缺少 convId'));
    }
    $before = isset($_GET['before']) ? (int) $_GET['before'] : 0;
    $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 60;
    if ($limit < 1 || $limit > 200) {
        $limit = 60;
    }
    if ($before > 0) {
        $rows = db_all(
            'SELECT * FROM `messages` WHERE `conv_type` = ? AND `conv_id` = ? AND `id` < ? ORDER BY `id` DESC LIMIT ' . (int) $limit,
            array($convType, $convId, $before)
        );
    } else {
        $rows = db_all(
            'SELECT * FROM `messages` WHERE `conv_type` = ? AND `conv_id` = ? ORDER BY `id` DESC LIMIT ' . (int) $limit,
            array($convType, $convId)
        );
    }
    $rows = array_reverse($rows);
    // 一次性把本页撤回记录取出来，避免逐条查询
    $recalledMap = array();
    $ids = array();
    foreach ($rows as $m) {
        if (!empty($m['recalled'])) {
            $ids[] = (int) $m['id'];
        }
    }
    if (!empty($ids)) {
        $rr = db_all(
            'SELECT * FROM `message_recalled` WHERE `message_id` IN (' . implode(',', array_map('intval', $ids)) . ')'
        );
        foreach ($rr as $r) {
            $recalledMap[(int) $r['message_id']] = $r;
        }
    }
    $list = array();
    foreach ($rows as $m) {
        $list[] = admin_message_row($m, $recalledMap);
    }
    return array(200, array(
        'messages' => $list,
        'has_more' => count($rows) >= $limit,
        'recalled_total' => (int) db_value('SELECT COUNT(*) FROM `messages` WHERE `conv_type` = ? AND `conv_id` = ? AND `recalled` = 1', array($convType, $convId)),
    ));
});

/* --------------------------- AI 公开信息 --------------------------- */

// 聊天页展示用：AI 显示名称与头像（管理员可自定义）
route('GET', '#^/api/ai/profile$#', function ($params, $body) {
    require_auth();
    return array(200, array('profile' => jc_ai_public()));
});

/* ---------------------------- 用户 IP / 拉黑 ---------------------------- */

/** IP 封禁行转展示结构 */
function admin_ip_block_row($b)
{
    return array(
        'ip' => (string) $b['ip'],
        'reason' => isset($b['reason']) ? (string) $b['reason'] : '',
        'until' => (int) $b['until'],
        'created_at' => (int) $b['created_at'],
        'created_by' => (int) (isset($b['created_by']) ? $b['created_by'] : 0),
    );
}

/**
 * 用户 IP 列表（实时）。
 * 返回：每个用户的最近真实 IP、最后活跃时间、在线状态、请求次数，以及全站封禁列表。
 */
route('GET', '#^/api/admin/ips$#', function ($params, $body) {
    jc_require_admin();

    $q = isset($_GET['q']) ? trim((string) $_GET['q']) : '';
    $onlineOnly = !empty($_GET['online']);
    $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 200;
    if ($limit < 1 || $limit > 500) {
        $limit = 200;
    }
    $now = now_ms();
    $onlineSince = $now - 60000;

    $where = array();
    $args = array();
    if ($q !== '') {
        $where[] = '(`username` LIKE ? OR `last_ip` LIKE ?)';
        $args[] = '%' . $q . '%';
        $args[] = '%' . $q . '%';
    }
    if ($onlineOnly) {
        $where[] = '`last_poll` > ?';
        $args[] = $onlineSince;
    }
    $sql = 'SELECT `id`, `username`, `avatar`, `is_official`, `role`, `online`, `last_seen`, `last_poll`, '
        . '`last_ip`, `last_ip_at`, `last_ua` FROM `users`'
        . ($where ? (' WHERE ' . implode(' AND ', $where)) : '')
        . ' ORDER BY `last_ip_at` DESC, `last_seen` DESC LIMIT ' . (int) $limit;
    $rows = db_all($sql, $args);

    // 封禁表（有效期内）
    $blocks = db_all('SELECT * FROM `ip_blocks` ORDER BY `created_at` DESC');
    $blockMap = array();
    $activeBlocks = array();
    foreach ($blocks as $b) {
        $until = (int) $b['until'];
        if ($until > 0 && $until <= $now) {
            continue;
        }
        $blockMap[(string) $b['ip']] = $until;
        $activeBlocks[] = admin_ip_block_row($b);
    }

    // 该 IP 的累计请求次数（聚合）
    $hitMap = array();
    if (!empty($rows)) {
        $ips = array();
        foreach ($rows as $u) {
            $ip = (string) $u['last_ip'];
            if ($ip !== '') {
                $ips[$ip] = true;
            }
        }
        if (!empty($ips)) {
            $ipList = array_keys($ips);
            $place = implode(',', array_fill(0, count($ipList), '?'));
            $hr = db_all('SELECT `ip`, SUM(`hits`) AS `hits` FROM `ip_records` WHERE `ip` IN (' . $place . ') GROUP BY `ip`', $ipList);
            foreach ($hr as $h) {
                $hitMap[(string) $h['ip']] = (int) $h['hits'];
            }
        }
    }

    $list = array();
    foreach ($rows as $u) {
        $ip = (string) $u['last_ip'];
        $list[] = array(
            'id' => (int) $u['id'],
            'username' => (string) $u['username'],
            'avatar' => (string) $u['avatar'],
            'is_official' => !empty($u['is_official']),
            'is_admin' => jc_is_admin($u),
            'online' => ((int) $u['last_poll']) > $onlineSince,
            'last_seen' => (int) $u['last_seen'],
            'ip' => $ip,
            'ip_at' => (int) $u['last_ip_at'],
            'ua' => (string) $u['last_ua'],
            'hits' => isset($hitMap[$ip]) ? $hitMap[$ip] : 0,
            'blocked' => isset($blockMap[$ip]),
            'block_until' => isset($blockMap[$ip]) ? $blockMap[$ip] : 0,
        );
    }

    $d = new DateTime('now', new DateTimeZone('UTC'));
    $d->setTime(0, 0, 0);
    $todayStart = (int) $d->getTimestamp() * 1000;

    return array(200, array(
        'users' => $list,
        'blocks' => $activeBlocks,
        'stats' => array(
            'users' => (int) db_value('SELECT COUNT(*) FROM `users`'),
            'today_ips' => (int) db_value('SELECT COUNT(DISTINCT `ip`) FROM `ip_records` WHERE `last_seen` >= ?', array($todayStart)),
            'online' => (int) db_value('SELECT COUNT(*) FROM `users` WHERE `last_poll` > ?', array($onlineSince)),
            'blocked' => count($activeBlocks),
        ),
        'my_ip' => jc_client_ip(),
    ));
});

/** 拉黑 IP（days=0 永久） */
route('POST', '#^/api/admin/ips/block$#', function ($params, $body) {
    $adminId = jc_require_admin();
    $ip = isset($body['ip']) ? trim((string) $body['ip']) : '';
    $reason = isset($body['reason']) ? mb_substr(trim((string) $body['reason']), 0, 190, 'UTF-8') : '';
    $days = isset($body['days']) ? (int) $body['days'] : 0;

    if (!jc_valid_ip($ip) || $ip === '0.0.0.0') {
        return array(400, array('error' => 'IP 地址不合法'));
    }
    if ($ip === jc_client_ip()) {
        return array(400, array('error' => '不能拉黑当前登录 IP（会把自己也挡在门外）'));
    }
    $until = $days > 0 ? now_ms() + $days * 86400000 : 0;

    $exist = db_one('SELECT `ip` FROM `ip_blocks` WHERE `ip` = ?', array($ip));
    if ($exist) {
        db_run('UPDATE `ip_blocks` SET `reason` = ?, `until` = ?, `created_by` = ?, `created_at` = ? WHERE `ip` = ?',
            array($reason, $until, $adminId, now_ms(), $ip));
    } else {
        db_run('INSERT INTO `ip_blocks` (`ip`, `reason`, `until`, `created_by`, `created_at`) VALUES (?, ?, ?, ?, ?)',
            array($ip, $reason, $until, $adminId, now_ms()));
    }
    return array(200, array('ok' => true, 'ip' => $ip, 'until' => $until));
});

/** 解除 IP 拉黑 */
route('POST', '#^/api/admin/ips/unblock$#', function ($params, $body) {
    jc_require_admin();
    $ip = isset($body['ip']) ? trim((string) $body['ip']) : '';
    if (!jc_valid_ip($ip)) {
        return array(400, array('error' => 'IP 地址不合法'));
    }
    db_run('DELETE FROM `ip_blocks` WHERE `ip` = ?', array($ip));
    return array(200, array('ok' => true, 'ip' => $ip));
});
