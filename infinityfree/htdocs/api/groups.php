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
        db_run('UPDATE `groups` SET `avatar` = ? WHERE `id` = ?', array((string) $body['avatar'], $gid));
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
