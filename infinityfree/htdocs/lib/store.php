<?php
/**
 * 数据装配层（等价 Node 的 store.js + 部分 db.js seed 逻辑）
 */

/** 在线判定：online 列为 1 且 last_poll 在 60 秒内 */
function user_is_online($row)
{
    if (!$row) {
        return false;
    }
    if ((int) (isset($row['online']) ? $row['online'] : 0) !== 1) {
        return false;
    }
    $lp = (int) (isset($row['last_poll']) ? $row['last_poll'] : 0);
    return $lp > 0 && (now_ms() - $lp) < 60000;
}

/** 按 uid 判定在线 */
function is_online($uid)
{
    return user_is_online(get_user($uid));
}

/** 对外用户信息（等价 publicUser） */
function public_user($u)
{
    if (!$u) {
        return null;
    }
    return array(
        'id' => (int) $u['id'],
        'username' => (string) $u['username'],
        'avatar' => isset($u['avatar']) ? (string) $u['avatar'] : '',
        'is_official' => !empty($u['is_official']),
        'role' => isset($u['role']) ? (string) $u['role'] : 'user',
        'online' => user_is_online($u),
        'last_seen' => (int) (isset($u['last_seen']) ? $u['last_seen'] : 0),
    );
}

/** 本人信息（等价 selfUser） */
function self_user($u)
{
    if (!$u) {
        return null;
    }
    $base = public_user($u);
    $base['email'] = (string) $u['email'];
    $base['bio'] = isset($u['bio']) ? (string) $u['bio'] : '';
    $base['name_count'] = (int) (isset($u['name_count']) ? $u['name_count'] : 0);
    $base['name_week'] = isset($u['name_week']) ? (string) $u['name_week'] : '';
    $base['created_at'] = (int) $u['created_at'];
    $base['is_admin'] = jc_is_admin($u);
    $base['banned'] = jc_ban_state($u)['banned'];
    $base['muted_until'] = (int) (isset($u['muted_until']) ? $u['muted_until'] : 0);
    return $base;
}

/** 取用户整行 */
function get_user($id)
{
    return db_one('SELECT * FROM `users` WHERE `id` = ?', array((int) $id));
}

/** 私聊会话 id（两 user id 排序拼接） */
function dm_conv_id($a, $b)
{
    $x = (int) $a;
    $y = (int) $b;
    return $x < $y ? ($x . '_' . $y) : ($y . '_' . $x);
}

/** 是否好友 */
function are_friends($a, $b)
{
    $r = db_one('SELECT 1 FROM `friendships` WHERE `user_id` = ? AND `friend_id` = ?', array((int) $a, (int) $b));
    return $r !== null;
}

/** 我是否拉黑对方 */
function is_blocked($owner_id, $target_id)
{
    $r = db_one('SELECT 1 FROM `blocks` WHERE `user_id` = ? AND `blocked_id` = ?', array((int) $owner_id, (int) $target_id));
    return $r !== null;
}

/** 双向拉黑判断 */
function blocked_either($a, $b)
{
    return is_blocked($a, $b) || is_blocked($b, $a);
}

/** 我拉黑的用户 id 列表 */
function blocked_ids($uid)
{
    $rows = db_all('SELECT `blocked_id` FROM `blocks` WHERE `user_id` = ?', array((int) $uid));
    $out = array();
    foreach ($rows as $r) {
        $out[] = (int) $r['blocked_id'];
    }
    return $out;
}

/** 好友 id 列表 */
function friend_ids($uid)
{
    $rows = db_all('SELECT `friend_id` FROM `friendships` WHERE `user_id` = ?', array((int) $uid));
    $out = array();
    foreach ($rows as $r) {
        $out[] = (int) $r['friend_id'];
    }
    return $out;
}

/** 建立双向好友关系（等价 addFriend） */
function add_friend($a, $b, $remark = '')
{
    db_exec_ignore(
        'INSERT INTO `friendships` (`user_id`, `friend_id`, `remark`, `created_at`) VALUES (?, ?, ?, ?)',
        array((int) $a, (int) $b, $remark, now_ms())
    );
    db_exec_ignore(
        'INSERT INTO `friendships` (`user_id`, `friend_id`, `remark`, `created_at`) VALUES (?, ?, ?, ?)',
        array((int) $b, (int) $a, '', now_ms())
    );
}

/** 我的群聊（含 role / dnd / mute_until） */
function my_groups($uid)
{
    return db_all(
        'SELECT g.*, m.`role`, m.`dnd`, m.`mute_until` FROM `group_members` m JOIN `groups` g ON g.`id` = m.`group_id` WHERE m.`user_id` = ?',
        array((int) $uid)
    );
}

/** 群成员行 */
function group_members($gid)
{
    return db_all(
        'SELECT `user_id`, `role`, `mute_until`, `dnd`, `joined_at` FROM `group_members` WHERE `group_id` = ?',
        array((int) $gid)
    );
}

/** 群成员 id 列表 */
function group_member_ids($gid)
{
    $rows = group_members($gid);
    $out = array();
    foreach ($rows as $m) {
        $out[] = (int) $m['user_id'];
    }
    return $out;
}

/** 我在群里的角色，非成员返回 null */
function member_role($gid, $uid)
{
    $m = db_one('SELECT `role` FROM `group_members` WHERE `group_id` = ? AND `user_id` = ?', array((int) $gid, (int) $uid));
    return $m ? $m['role'] : null;
}

/** 会话参与者 id 列表 */
function conv_participants($conv_type, $conv_id)
{
    if ($conv_type === 'dm') {
        $parts = explode('_', (string) $conv_id);
        $out = array();
        foreach ($parts as $p) {
            $n = (int) $p;
            if ($n > 0) {
                $out[] = $n;
            }
        }
        return $out;
    }
    return group_member_ids((int) $conv_id);
}

/** 创建通知并写入 notification 事件（等价 createNotification） */
function create_notification($args)
{
    $user_id = (int) $args['user_id'];
    $type = $args['type'];
    $actor_id = isset($args['actor_id']) ? (int) $args['actor_id'] : 0;
    $text = isset($args['text']) ? $args['text'] : '';
    $ref_type = isset($args['ref_type']) ? $args['ref_type'] : '';
    $ref_id = isset($args['ref_id']) ? (int) $args['ref_id'] : 0;

    $id = db_insert(
        'INSERT INTO `notifications` (`user_id`, `type`, `actor_id`, `text`, `ref_type`, `ref_id`, `read`, `created_at`)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
        array($user_id, $type, $actor_id, $text, $ref_type, $ref_id, now_ms())
    );
    $notif = db_one('SELECT * FROM `notifications` WHERE `id` = ?', array($id));
    $notif = normalize_notification_row($notif);
    $actor = $actor_id ? public_user(get_user($actor_id)) : null;

    $payload = $notif;
    $payload['actor'] = $actor;
    event_to_user($user_id, 'notification', $payload);
    return $notif;
}

/** 通知行类型归一化 */
function normalize_notification_row($n)
{
    if (!$n) {
        return null;
    }
    return array(
        'id' => (int) $n['id'],
        'user_id' => (int) $n['user_id'],
        'type' => (string) $n['type'],
        'actor_id' => (int) $n['actor_id'],
        'text' => isset($n['text']) ? (string) $n['text'] : '',
        'ref_type' => isset($n['ref_type']) ? (string) $n['ref_type'] : '',
        'ref_id' => (int) $n['ref_id'],
        'read' => (int) (isset($n['read']) ? $n['read'] : 0),
        'created_at' => (int) $n['created_at'],
    );
}

/** 组装消息（等价 buildMessage） */
function build_message($row, $extra = array())
{
    if ((int) $row['sender_id'] === 0) {
        // Jay AI：使用管理员后台配置的展示名称与头像
        $ai = jc_ai_public();
        $sender = array(
            'id' => 0,
            'username' => $ai['name'],
            'avatar' => $ai['avatar'],
            'is_official' => true,
            'role' => 'ai',
            'online' => true,
            'last_seen' => 0,
        );
    } else {
        $sender = public_user(get_user($row['sender_id']));
    }
    $read_count = (int) db_value('SELECT COUNT(*) FROM `message_reads` WHERE `message_id` = ?', array((int) $row['id']));
    $burns_rows = db_all('SELECT `user_id` FROM `message_burns` WHERE `message_id` = ?', array((int) $row['id']));
    $burns = array();
    foreach ($burns_rows as $b) {
        $burns[] = (int) $b['user_id'];
    }
    $extra_json = isset($row['extra']) && $row['extra'] ? safe_json($row['extra']) : null;
    $out = array(
        'id' => (int) $row['id'],
        'conv_type' => (string) $row['conv_type'],
        'conv_id' => (string) $row['conv_id'],
        'sender_id' => (int) $row['sender_id'],
        'sender' => $sender,
        'msg_type' => (string) $row['msg_type'],
        'content' => (string) $row['content'],
        'media_url' => isset($row['media_url']) ? (string) $row['media_url'] : '',
        'media_thumb' => isset($row['media_thumb']) ? (string) $row['media_thumb'] : '',
        'one_time' => !empty($row['one_time']),
        'burn_sec' => isset($row['burn_sec']) && (int) $row['burn_sec'] ? (int) $row['burn_sec'] : 5,
        'recalled' => !empty($row['recalled']),
        'extra' => $extra_json,
        'read_count' => $read_count,
        'burned_by' => $burns,
        'created_at' => (int) $row['created_at'],
    );
    foreach ($extra as $k => $v) {
        $out[$k] = $v;
    }
    return $out;
}

/* ----------------------------- 种子数据 ----------------------------- */

/** 种子：官方账号「杰同学」+「Jay Chat官方群」（等价 seedOfficial） */
function seed_official()
{
    $acc = jc_official_account();
    $official = db_one('SELECT * FROM `users` WHERE `email` = ?', array($acc['email']));
    if (!$official) {
        $id = db_insert(
            'INSERT INTO `users` (`username`, `email`, `pwd`, `avatar`, `is_official`, `role`, `created_at`) VALUES (?, ?, ?, ?, 1, ?, ?)',
            array($acc['username'], $acc['email'], hash_password($acc['password']), '/assets/official-avatar.svg', 'admin', now_ms())
        );
        $official = db_one('SELECT * FROM `users` WHERE `id` = ?', array($id));
    } else {
        db_run('UPDATE `users` SET `is_official` = 1, `username` = ?, `role` = ? WHERE `id` = ?', array($acc['username'], 'admin', (int) $official['id']));
        $official = db_one('SELECT * FROM `users` WHERE `id` = ?', array((int) $official['id']));
    }

    $grp = db_one('SELECT * FROM `groups` WHERE `is_official` = 1');
    if (!$grp) {
        $gid = db_insert(
            'INSERT INTO `groups` (`name`, `avatar`, `owner_id`, `announcement`, `is_official`, `created_at`) VALUES (?, ?, ?, ?, 1, ?)',
            array(
                jc_official_group_name(),
                '/assets/official-group.svg',
                (int) $official['id'],
                '欢迎加入 Jay Chat 官方群，文明聊天，有问题可以 @Jay AI 提问。',
                now_ms(),
            )
        );
        $grp = db_one('SELECT * FROM `groups` WHERE `id` = ?', array($gid));
    } else {
        // 一并回写公告：旧库若在 latin1 字符集下建表，中文会被存成 ???，这里顺手修复
        db_run(
            'UPDATE `groups` SET `owner_id` = ?, `name` = ?, `announcement` = ? WHERE `id` = ?',
            array((int) $official['id'], jc_official_group_name(), '欢迎加入 Jay Chat 官方群，文明聊天，有问题可以 @Jay AI 提问。', (int) $grp['id'])
        );
        $grp = db_one('SELECT * FROM `groups` WHERE `id` = ?', array((int) $grp['id']));
    }

    db_exec_ignore(
        'INSERT INTO `group_members` (`group_id`, `user_id`, `role`, `joined_at`) VALUES (?, ?, ?, ?)',
        array((int) $grp['id'], (int) $official['id'], 'owner', now_ms())
    );

    return array('official' => $official, 'group' => $grp);
}

/** 新用户自动加入官方群（等价 joinOfficialGroup） */
function join_official_group($user_id)
{
    $grp = db_one('SELECT `id` FROM `groups` WHERE `is_official` = 1');
    if (!$grp) {
        return;
    }
    db_exec_ignore(
        'INSERT INTO `group_members` (`group_id`, `user_id`, `role`, `joined_at`) VALUES (?, ?, ?, ?)',
        array((int) $grp['id'], (int) $user_id, 'member', now_ms())
    );
}

/** 官方群 id */
function official_group_id()
{
    $grp = db_one('SELECT `id` FROM `groups` WHERE `is_official` = 1');
    return $grp ? (int) $grp['id'] : 0;
}
