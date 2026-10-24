<?php
/**
 * /api/groups/* —— 群聊创建 / 详情 / 邀请 / 踢人 / 管理员 / 禁言 / 转让 / 退群 / dnd
 */

function role_weight($r)
{
    return $r === 'owner' ? 2 : ($r === 'admin' ? 1 : 0);
}

/** 群简要信息（等价 groupBrief） */
function group_brief($g, $uid)
{
    $members = group_members($g['id']);
    $online = 0;
    $my_dnd = false;
    foreach ($members as $m) {
        if (is_online((int) $m['user_id'])) {
            $online++;
        }
        if ((int) $m['user_id'] === (int) $uid) {
            $my_dnd = !empty($m['dnd']);
        }
    }
    $role = member_role($g['id'], $uid);
    return array(
        'id' => (int) $g['id'],
        'name' => (string) $g['name'],
        'avatar' => isset($g['avatar']) ? (string) $g['avatar'] : '',
        'owner_id' => (int) $g['owner_id'],
        'announcement' => isset($g['announcement']) ? (string) $g['announcement'] : '',
        'is_official' => !empty($g['is_official']),
        'dissolved' => !empty($g['dissolved']),
        'im_groupid' => isset($g['im_groupid']) ? (string) $g['im_groupid'] : '',
        'member_count' => count($members),
        'online_count' => $online,
        'my_role' => $role ? $role : 'member',
        'dnd' => $my_dnd,
    );
}

// 创建群聊
route('POST', '#^/api/groups$#', function ($params, $body) {
    $uid = require_auth();
    $name = isset($body['name']) ? mb_substr(trim((string) $body['name']), 0, 20, 'UTF-8') : '';
    if ($name === '') {
        return array(400, array('error' => '请输入群名称'));
    }
    $memberIds = array();
    if (isset($body['memberIds']) && is_array($body['memberIds'])) {
        foreach ($body['memberIds'] as $m) {
            $mi = (int) $m;
            if ($mi && $mi !== $uid) {
                $memberIds[] = $mi;
            }
        }
    }
    $gid = db_insert(
        'INSERT INTO `groups` (`name`, `avatar`, `owner_id`, `announcement`, `is_official`, `created_at`) VALUES (?, ?, ?, ?, 0, ?)',
        array($name, '', $uid, '', now_ms())
    );
    db_run('INSERT INTO `group_members` (`group_id`, `user_id`, `role`, `joined_at`) VALUES (?, ?, ?, ?)', array($gid, $uid, 'owner', now_ms()));
    foreach ($memberIds as $m) {
        if (!get_user($m)) {
            continue;
        }
        db_exec_ignore(
            'INSERT INTO `group_members` (`group_id`, `user_id`, `role`, `joined_at`) VALUES (?, ?, ?, ?)',
            array($gid, $m, 'member', now_ms())
        );
    }
    $g = db_one('SELECT * FROM `groups` WHERE `id` = ?', array($gid));
    $brief = group_brief($g, $uid);
    event_to_users(array_merge(array($uid), $memberIds), 'group:new', array('group' => $brief));
    return array(200, array('group' => $brief));
});

// 我的群聊
route('GET', '#^/api/groups$#', function ($params, $body) {
    $uid = require_auth();
    $groups = array();
    foreach (my_groups($uid) as $g) {
        $groups[] = group_brief($g, $uid);
    }
    return array(200, array('groups' => $groups));
});

// 群在线成员
route('GET', '#^/api/groups/(\d+)/online$#', function ($params, $body) {
    $uid = require_auth();
    $gid = (int) $params[0];
    if (!member_role($gid, $uid)) {
        return array(403, array('error' => '你不在该群聊中'));
    }
    $members = group_members($gid);
    $online = array();
    foreach ($members as $m) {
        if (is_online((int) $m['user_id'])) {
            $online[] = public_user(get_user($m['user_id']));
        }
    }
    return array(200, array('online' => $online, 'count' => count($online), 'total' => count($members)));
});

// 群详情
route('GET', '#^/api/groups/(\d+)$#', function ($params, $body) {
    $uid = require_auth();
    $gid = (int) $params[0];
    $g = db_one('SELECT * FROM `groups` WHERE `id` = ?', array($gid));
    if (!$g) {
        return array(404, array('error' => '群聊不存在'));
    }
    $role = member_role($gid, $uid);
    if (!$role) {
        return array(403, array('error' => '你不在该群聊中'));
    }
    $members = array();
    foreach (group_members($gid) as $m) {
        $pu = public_user(get_user($m['user_id']));
        $pu['role'] = $m['role'];
        $pu['mute_until'] = (int) (isset($m['mute_until']) ? $m['mute_until'] : 0);
        $pu['dnd'] = !empty($m['dnd']);
        $pu['joined_at'] = (int) $m['joined_at'];
        $members[] = $pu;
    }
    usort($members, function ($a, $b) {
        $d = role_weight($b['role']) - role_weight($a['role']);
        if ($d !== 0) {
            return $d;
        }
        return $a['id'] - $b['id'];
    });
    $online_count = 0;
    $my_mute = 0;
    foreach ($members as $m) {
        if ($m['online']) {
            $online_count++;
        }
        if ((int) $m['id'] === (int) $uid) {
            $my_mute = $m['mute_until'];
        }
    }
    $brief = group_brief($g, $uid);
    $brief['owner'] = public_user(get_user($g['owner_id']));
    return array(200, array(
        'group' => $brief,
        'members' => $members,
        'online_count' => $online_count,
        'my_role' => $role,
        'my_mute_until' => $my_mute,
        'can' => array(
            'edit' => ($role === 'owner' || $role === 'admin'),
            'kick' => ($role === 'owner'),
            'set_admin' => ($role === 'owner'),
            'mute' => ($role === 'owner' || $role === 'admin'),
            'transfer' => ($role === 'owner' && empty($g['is_official'])),
            'invite' => true,
            'quit' => (!empty($g['is_official']) ? false : ($role !== 'owner')),
            // 解散：仅群主、且非官方群、且当前未解散
            'dissolve' => ($role === 'owner' && empty($g['is_official']) && empty($g['dissolved'])),
        ),
    ));
});

// 编辑群名称 / 头像 / 公告
route('PATCH', '#^/api/groups/(\d+)$#', function ($params, $body) {
    $uid = require_auth();
    $gid = (int) $params[0];
    $role = member_role($gid, $uid);
    if ($role !== 'owner' && $role !== 'admin') {
        return array(403, array('error' => '只有群主或管理员可以修改'));
    }
    if (array_key_exists('name', $body) && $body['name'] !== null) {
        $n = mb_substr(trim((string) $body['name']), 0, 20, 'UTF-8');
        if ($n === '') {
            return array(400, array('error' => '群名称不能为空'));
        }
        db_run('UPDATE `groups` SET `name` = ? WHERE `id` = ?', array($n, $gid));
    }
    if (array_key_exists('avatar', $body) && $body['avatar'] !== null) {
        $avatarValue = jc_normalize_avatar($body['avatar']);
        if ($avatarValue === null) {
            return array(400, array('error' => '头像格式不合法'));
        }
        db_run('UPDATE `groups` SET `avatar` = ? WHERE `id` = ?', array($avatarValue, $gid));
        // 备份上传群头像文件：升级覆盖 uploads 后可自动恢复
        jc_file_backup($avatarValue);
    }
    if (array_key_exists('announcement', $body) && $body['announcement'] !== null) {
        db_run('UPDATE `groups` SET `announcement` = ? WHERE `id` = ?', array(mb_substr((string) $body['announcement'], 0, 200, 'UTF-8'), $gid));
    }
    $g = db_one('SELECT * FROM `groups` WHERE `id` = ?', array($gid));
    $brief = group_brief($g, $uid);
    event_to_group_members($gid, 'group:update', array('groupId' => $gid, 'group' => $brief));
    return array(200, array('group' => $brief));
});

// 邀请好友入群
route('POST', '#^/api/groups/(\d+)/invite$#', function ($params, $body) {
    $uid = require_auth();
    $gid = (int) $params[0];
    if (!member_role($gid, $uid)) {
        return array(403, array('error' => '你不在该群聊中'));
    }
    $ids = array();
    if (isset($body['userIds']) && is_array($body['userIds'])) {
        foreach ($body['userIds'] as $v) {
            $vi = (int) $v;
            if ($vi) {
                $ids[] = $vi;
            }
        }
    }
    $added = array();
    foreach ($ids as $target) {
        if (!get_user($target)) {
            continue;
        }
        if (member_role($gid, $target)) {
            continue;
        }
        db_run(
            'INSERT INTO `group_members` (`group_id`, `user_id`, `role`, `joined_at`) VALUES (?, ?, ?, ?)',
            array($gid, $target, 'member', now_ms())
        );
        $added[] = $target;
        $gname = db_one('SELECT `name` FROM `groups` WHERE `id` = ?', array($gid));
        create_notification(array(
            'user_id' => $target,
            'type' => 'group_invite',
            'actor_id' => $uid,
            'text' => public_user(get_user($uid))['username'] . ' 邀请你加入群聊「' . $gname['name'] . '」',
            'ref_type' => 'group',
            'ref_id' => $gid,
        ));
    }
    if (!empty($added)) {
        $g = db_one('SELECT * FROM `groups` WHERE `id` = ?', array($gid));
        event_to_group_members($gid, 'group:members', array('groupId' => $gid, 'group' => group_brief($g, $uid)));
    }
    return array(200, array('ok' => true, 'added' => $added));
});

// 踢人（群主）
route('POST', '#^/api/groups/(\d+)/kick$#', function ($params, $body) {
    $uid = require_auth();
    $gid = (int) $params[0];
    $g = db_one('SELECT * FROM `groups` WHERE `id` = ?', array($gid));
    if (!$g) {
        return array(404, array('error' => '群聊不存在'));
    }
    if ((int) $g['owner_id'] !== (int) $uid) {
        return array(403, array('error' => '只有群主可以移出成员'));
    }
    $target = isset($body['userId']) ? (int) $body['userId'] : 0;
    if (!$target || $target === (int) $g['owner_id']) {
        return array(400, array('error' => '参数错误'));
    }
    db_run('DELETE FROM `group_members` WHERE `group_id` = ? AND `user_id` = ?', array($gid, $target));
    event_to_user($target, 'group:removed', array('groupId' => $gid, 'name' => $g['name']));
    event_to_group_members($gid, 'group:members', array('groupId' => $gid, 'group' => group_brief($g, $uid)));
    return array(200, array('ok' => true));
});

// 设置 / 取消管理员（群主）
route('POST', '#^/api/groups/(\d+)/set-admin$#', function ($params, $body) {
    $uid = require_auth();
    $gid = (int) $params[0];
    $g = db_one('SELECT * FROM `groups` WHERE `id` = ?', array($gid));
    if (!$g) {
        return array(404, array('error' => '群聊不存在'));
    }
    if ((int) $g['owner_id'] !== (int) $uid) {
        return array(403, array('error' => '只有群主可以设置管理员'));
    }
    $target = isset($body['userId']) ? (int) $body['userId'] : 0;
    $admin = !empty($body['admin']);
    if (!$target || $target === (int) $g['owner_id'] || !member_role($gid, $target)) {
        return array(400, array('error' => '参数错误'));
    }
    db_run('UPDATE `group_members` SET `role` = ? WHERE `group_id` = ? AND `user_id` = ?', array($admin ? 'admin' : 'member', $gid, $target));
    event_to_group_members($gid, 'group:members', array('groupId' => $gid, 'group' => group_brief($g, $uid)));
    return array(200, array('ok' => true));
});

// 禁言 / 解除禁言（群主、管理员）
route('POST', '#^/api/groups/(\d+)/mute$#', function ($params, $body) {
    $uid = require_auth();
    $gid = (int) $params[0];
    $role = member_role($gid, $uid);
    if ($role !== 'owner' && $role !== 'admin') {
        return array(403, array('error' => '没有权限'));
    }
    $target = isset($body['userId']) ? (int) $body['userId'] : 0;
    $duration = isset($body['durationSec']) ? (int) $body['durationSec'] : 0;
    if ($duration < 0) {
        $duration = 0;
    }
    $targetRole = member_role($gid, $target);
    if (!$target || !$targetRole) {
        return array(400, array('error' => '参数错误'));
    }
    if ($targetRole === 'owner') {
        return array(400, array('error' => '不能禁言群主'));
    }
    if ($role === 'admin' && $targetRole === 'admin') {
        return array(400, array('error' => '管理员不能禁言其他管理员'));
    }
    $until = $duration > 0 ? now_ms() + $duration * 1000 : 0;
    db_run('UPDATE `group_members` SET `mute_until` = ? WHERE `group_id` = ? AND `user_id` = ?', array($until, $gid, $target));
    event_to_user($target, 'group:muted', array('groupId' => $gid, 'mute_until' => $until));
    $g = db_one('SELECT * FROM `groups` WHERE `id` = ?', array($gid));
    event_to_group_members($gid, 'group:members', array('groupId' => $gid, 'group' => group_brief($g, $uid)));
    return array(200, array('ok' => true, 'mute_until' => $until));
});

// 转让群主
route('POST', '#^/api/groups/(\d+)/transfer$#', function ($params, $body) {
    $uid = require_auth();
    $gid = (int) $params[0];
    $g = db_one('SELECT * FROM `groups` WHERE `id` = ?', array($gid));
    if (!$g) {
        return array(404, array('error' => '群聊不存在'));
    }
    if ((int) $g['owner_id'] !== (int) $uid) {
        return array(403, array('error' => '只有群主可以转让'));
    }
    if (!empty($g['is_official'])) {
        return array(400, array('error' => '官方群不能转让'));
    }
    $target = isset($body['userId']) ? (int) $body['userId'] : 0;
    if (!$target || !member_role($gid, $target)) {
        return array(400, array('error' => '参数错误'));
    }
    db_run('UPDATE `group_members` SET `role` = ? WHERE `group_id` = ? AND `user_id` = ?', array('member', $gid, (int) $g['owner_id']));
    db_run('UPDATE `group_members` SET `role` = ? WHERE `group_id` = ? AND `user_id` = ?', array('owner', $gid, $target));
    db_run('UPDATE `groups` SET `owner_id` = ? WHERE `id` = ?', array($target, $gid));
    $g2 = db_one('SELECT * FROM `groups` WHERE `id` = ?', array($gid));
    event_to_group_members($gid, 'group:members', array('groupId' => $gid, 'group' => group_brief($g2, $uid)));
    return array(200, array('ok' => true));
});

// 退出群聊（官方群禁止退出，群主需先转让）
route('POST', '#^/api/groups/(\d+)/quit$#', function ($params, $body) {
    $uid = require_auth();
    $gid = (int) $params[0];
    $g = db_one('SELECT * FROM `groups` WHERE `id` = ?', array($gid));
    if (!$g) {
        return array(404, array('error' => '群聊不存在'));
    }
    if (!member_role($gid, $uid)) {
        return array(400, array('error' => '你不在该群聊中'));
    }
    if (!empty($g['is_official'])) {
        return array(400, array('error' => '官方群不能退出'));
    }
    if ((int) $g['owner_id'] === (int) $uid) {
        return array(400, array('error' => '群主请先转让群主后再退出'));
    }
    db_run('DELETE FROM `group_members` WHERE `group_id` = ? AND `user_id` = ?', array($gid, $uid));
    event_to_group_members($gid, 'group:members', array('groupId' => $gid, 'group' => group_brief($g, $uid)));
    return array(200, array('ok' => true));
});

// 消息免打扰
route('PATCH', '#^/api/groups/(\d+)/dnd$#', function ($params, $body) {
    $uid = require_auth();
    $gid = (int) $params[0];
    if (!member_role($gid, $uid)) {
        return array(403, array('error' => '你不在该群聊中'));
    }
    $dnd = !empty($body['dnd']) ? 1 : 0;
    db_run('UPDATE `group_members` SET `dnd` = ? WHERE `group_id` = ? AND `user_id` = ?', array($dnd, $gid, $uid));
    return array(200, array('ok' => true, 'dnd' => (bool) $dnd));
});

// 解散群聊（仅群主；官方群不允许）
// 解散后：群与成员关系保留，首页仍显示该会话，成员可只读历史消息，但不能再发消息。
route('POST', '#^/api/groups/(\d+)/dissolve$#', function ($params, $body) {
    $uid = require_auth();
    $gid = (int) $params[0];
    $g = db_one('SELECT * FROM `groups` WHERE `id` = ?', array($gid));
    if (!$g) {
        return array(404, array('error' => '群聊不存在'));
    }
    if (!empty($g['is_official'])) {
        return array(400, array('error' => '官方群不能解散'));
    }
    if ((int) $g['owner_id'] !== (int) $uid) {
        return array(403, array('error' => '只有群主可以解散群聊'));
    }
    if (!empty($g['dissolved'])) {
        return array(400, array('error' => '群聊已解散'));
    }
    db_run('UPDATE `groups` SET `dissolved` = 1 WHERE `id` = ?', array($gid));
    $g2 = db_one('SELECT * FROM `groups` WHERE `id` = ?', array($gid));
    $brief = group_brief($g2, $uid);
    event_to_group_members($gid, 'group:dissolved', array('groupId' => $gid, 'group' => $brief));
    event_to_group_members($gid, 'group:update', array('groupId' => $gid, 'group' => $brief));
    return array(200, array('ok' => true));
});

/* ---------------------- 群聊搜索 / 申请加入 / 审核 ---------------------- */

// 搜索群聊（支持群名称模糊搜索 + 群 ID 精确搜索）
route('GET', '#^/api/groups/search$#', function ($params, $body) {
    $uid = require_auth();
    $q = isset($_GET['q']) ? trim((string) $_GET['q']) : '';
    if ($q === '') {
        return array(200, array('groups' => array()));
    }
    jc_rate_limit('group_search', 60, 60000, 'user:' . $uid);

    // 归一化：全角数字转半角、去掉所有空白（含全角空格/零宽字符），
    // 兼容用户直接粘贴「群 ID：12」「群号：#12」「12 号群」等写法。
    $compact = strtr($q, array(
        '０' => '0', '１' => '1', '２' => '2', '３' => '3', '４' => '4',
        '５' => '5', '６' => '6', '７' => '7', '８' => '8', '９' => '9',
        '：' => ':', '＃' => '#', '　' => ' ',
    ));
    $compact = preg_replace('/[\s\x{3000}\x{200B}\x{FEFF}]+/u', '', $compact);
    if ($compact === null) {
        $compact = '';
    }
    // 是否带了「群 ID / ID / 群号 / #」这类前缀（用于识别「群 ID：12 · 3 人在线」这种整行粘贴）
    $hadPrefix = (bool) preg_match('/^(#|群\s*id|群号|id)/iu', $compact);
    $compact = preg_replace('/^[#＃]+/u', '', $compact);
    $compact = preg_replace('/^(群\s*id|群号|id)\s*[:：#]?/iu', '', $compact);
    $compact = preg_replace('/^[#＃]+/u', '', $compact);
    if ($compact === null) {
        $compact = '';
    }

    $like = '%' . $q . '%';
    $idNum = null;
    if (preg_match('/^(\d+)\s*号?(群)?$/u', $compact, $m)
        || ($hadPrefix && preg_match('/^(\d+)/u', $compact, $m))) {
        $idNum = (int) $m[1];
    }
    if ($idNum !== null) {
        // 纯数字（含「群 ID：12」「#12」「12号群」等写法）：群 ID / IM 群号精确匹配，
        // 同时保留名称里的数字匹配
        $rows = db_all(
            'SELECT * FROM `groups` WHERE (`id` = ? OR `im_groupid` = ? OR `name` LIKE ?) AND `dissolved` = 0 ORDER BY `id` ASC LIMIT 20',
            array($idNum, (string) $idNum, $like)
        );
    } else {
        $rows = db_all(
            'SELECT * FROM `groups` WHERE (`name` LIKE ? OR `im_groupid` LIKE ?) AND `dissolved` = 0 ORDER BY `id` ASC LIMIT 20',
            array($like, $like)
        );
    }
    $out = array();
    foreach ($rows as $g) {
        $role = member_role($g['id'], $uid);
        $pending = db_one(
            'SELECT `id` FROM `group_join_requests` WHERE `group_id` = ? AND `user_id` = ? AND `status` = ?',
            array((int) $g['id'], $uid, 'pending')
        );
        $count = (int) db_value('SELECT COUNT(*) FROM `group_members` WHERE `group_id` = ?', array((int) $g['id']));
        $out[] = array(
            'id' => (int) $g['id'],
            'name' => (string) $g['name'],
            'avatar' => isset($g['avatar']) ? (string) $g['avatar'] : '',
            'is_official' => !empty($g['is_official']),
            'member_count' => $count,
            'is_member' => $role !== null,
            'my_role' => $role ? $role : '',
            'pending' => $pending !== null,
        );
    }
    return array(200, array('groups' => $out));
});

// 我提交的入群申请（待审核的群 ID）
route('GET', '#^/api/groups/join-requests/sent$#', function ($params, $body) {
    $uid = require_auth();
    $rows = db_all(
        'SELECT `group_id` FROM `group_join_requests` WHERE `user_id` = ? AND `status` = ?',
        array($uid, 'pending')
    );
    $ids = array();
    foreach ($rows as $r) {
        $ids[] = (int) $r['group_id'];
    }
    return array(200, array('ids' => $ids));
});

// 申请加入群聊（需要群主 / 管理员在通知里审核）
route('POST', '#^/api/groups/(\d+)/join-request$#', function ($params, $body) {
    $uid = require_auth();
    $gid = (int) $params[0];
    $g = db_one('SELECT * FROM `groups` WHERE `id` = ?', array($gid));
    if (!$g) {
        return array(404, array('error' => '群聊不存在'));
    }
    if (!empty($g['dissolved'])) {
        return array(400, array('error' => '该群聊已解散'));
    }
    if (member_role($gid, $uid) !== null) {
        return array(400, array('error' => '你已在该群聊中'));
    }
    // 防骚扰：单用户每小时最多申请 10 个群
    jc_rate_limit('group_join', 10, 3600000, 'user:' . $uid);
    $dup = db_one(
        'SELECT `id` FROM `group_join_requests` WHERE `group_id` = ? AND `user_id` = ? AND `status` = ?',
        array($gid, $uid, 'pending')
    );
    if ($dup) {
        return array(400, array('error' => '已提交申请，等待管理员审核'));
    }
    $message = isset($body['message']) ? mb_substr(trim((string) $body['message']), 0, 60, 'UTF-8') : '';
    $rid = db_insert(
        'INSERT INTO `group_join_requests` (`group_id`, `user_id`, `message`, `status`, `created_at`) VALUES (?, ?, ?, ?, ?)',
        array($gid, $uid, $message, 'pending', now_ms())
    );
    $me = public_user(get_user($uid));
    // 通知群主与所有管理员
    $admins = db_all(
        'SELECT `user_id` FROM `group_members` WHERE `group_id` = ? AND (`role` = ? OR `role` = ?)',
        array($gid, 'owner', 'admin')
    );
    foreach ($admins as $a) {
        if ((int) $a['user_id'] === (int) $uid) {
            continue;
        }
        create_notification(array(
            'user_id' => (int) $a['user_id'],
            'type' => 'group_join_request',
            'actor_id' => $uid,
            'text' => $me['username'] . ' 申请加入群聊「' . $g['name'] . '」' . ($message ? '：' . $message : ''),
            'ref_type' => 'group_join_request',
            'ref_id' => (int) $rid,
        ));
        event_to_user((int) $a['user_id'], 'group:join_request', array('groupId' => $gid, 'requestId' => (int) $rid));
    }
    return array(200, array('ok' => true, 'requestId' => (int) $rid));
});

// 同意入群申请（群主 / 管理员）
route('POST', '#^/api/groups/join-requests/(\d+)/accept$#', function ($params, $body) {
    $uid = require_auth();
    $r = db_one('SELECT * FROM `group_join_requests` WHERE `id` = ?', array((int) $params[0]));
    if (!$r) {
        return array(404, array('error' => '申请不存在'));
    }
    if ((string) $r['status'] !== 'pending') {
        return array(400, array('error' => '该申请已处理'));
    }
    $gid = (int) $r['group_id'];
    $role = member_role($gid, $uid);
    if ($role !== 'owner' && $role !== 'admin') {
        return array(403, array('error' => '只有群主或管理员可以审核'));
    }
    $g = db_one('SELECT * FROM `groups` WHERE `id` = ?', array($gid));
    if (!$g) {
        return array(404, array('error' => '群聊不存在'));
    }
    $applicant = (int) $r['user_id'];
    if (member_role($gid, $applicant) === null) {
        db_exec_ignore(
            'INSERT INTO `group_members` (`group_id`, `user_id`, `role`, `joined_at`) VALUES (?, ?, ?, ?)',
            array($gid, $applicant, 'member', now_ms())
        );
    }
    db_run(
        'UPDATE `group_join_requests` SET `status` = ?, `handled_by` = ?, `handled_at` = ? WHERE `id` = ?',
        array('accepted', $uid, now_ms(), (int) $r['id'])
    );
    // 该申请已处理：清掉所有群主/管理员收到的待审核通知，避免其他人再点「同意/拒绝」时提示已处理
    db_run(
        'DELETE FROM `notifications` WHERE `ref_type` = ? AND `ref_id` = ?',
        array('group_join_request', (int) $r['id'])
    );
    create_notification(array(
        'user_id' => $applicant,
        'type' => 'group_join_accept',
        'actor_id' => $uid,
        'text' => '你加入群聊「' . $g['name'] . '」的申请已通过',
        'ref_type' => 'group',
        'ref_id' => $gid,
    ));
    event_to_user($applicant, 'group:new', array('group' => group_brief($g, $applicant)));
    event_to_group_members($gid, 'group:members', array('groupId' => $gid, 'group' => group_brief($g, $uid)));
    return array(200, array('ok' => true));
});

// 拒绝入群申请（群主 / 管理员）
route('POST', '#^/api/groups/join-requests/(\d+)/reject$#', function ($params, $body) {
    $uid = require_auth();
    $r = db_one('SELECT * FROM `group_join_requests` WHERE `id` = ?', array((int) $params[0]));
    if (!$r) {
        return array(404, array('error' => '申请不存在'));
    }
    if ((string) $r['status'] !== 'pending') {
        return array(400, array('error' => '该申请已处理'));
    }
    $gid = (int) $r['group_id'];
    $role = member_role($gid, $uid);
    if ($role !== 'owner' && $role !== 'admin') {
        return array(403, array('error' => '只有群主或管理员可以审核'));
    }
    $g = db_one('SELECT * FROM `groups` WHERE `id` = ?', array($gid));
    if (!$g) {
        return array(404, array('error' => '群聊不存在'));
    }
    db_run(
        'UPDATE `group_join_requests` SET `status` = ?, `handled_by` = ?, `handled_at` = ? WHERE `id` = ?',
        array('rejected', $uid, now_ms(), (int) $r['id'])
    );
    // 该申请已处理：清掉所有群主/管理员收到的待审核通知
    db_run(
        'DELETE FROM `notifications` WHERE `ref_type` = ? AND `ref_id` = ?',
        array('group_join_request', (int) $r['id'])
    );
    create_notification(array(
        'user_id' => (int) $r['user_id'],
        'type' => 'group_join_reject',
        'actor_id' => $uid,
        'text' => '你加入群聊「' . $g['name'] . '」的申请未通过',
        'ref_type' => 'group',
        'ref_id' => $gid,
    ));
    return array(200, array('ok' => true));
});

// 删除已解散的群聊（仅移除自己的会话，不再显示在首页；历史消息保留在服务端）
route('POST', '#^/api/groups/(\d+)/delete-chat$#', function ($params, $body) {
    $uid = require_auth();
    $gid = (int) $params[0];
    $g = db_one('SELECT * FROM `groups` WHERE `id` = ?', array($gid));
    if (!$g) {
        return array(404, array('error' => '群聊不存在'));
    }
    if (empty($g['dissolved'])) {
        return array(400, array('error' => '群聊尚未解散'));
    }
    if (!member_role($gid, $uid)) {
        return array(400, array('error' => '你不在该群聊中'));
    }
    db_run('DELETE FROM `group_members` WHERE `group_id` = ? AND `user_id` = ?', array($gid, $uid));
    event_to_group_members($gid, 'group:members', array('groupId' => $gid, 'group' => group_brief($g, $uid)));
    return array(200, array('ok' => true));
});
