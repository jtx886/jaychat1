<?php
/**
 * 轮询事件（替代 WebSocket 推送）
 *
 * Node 版在 realtime.js 的 sendToUser / sendToUsers / broadcast / broadcastGroup
 * 以及各 route 的调用点产生事件；这里等价改写为「写入 events 表」，
 * 前端通过 GET /api/poll?since=<id> 增量拉取。
 *
 * 事件 data 的字段结构必须与 Node 推给前端的一致（前端直接消费）。
 */

/** 写入一条事件（单个用户） */
function event_insert($uid, $type, $data)
{
    db_run(
        'INSERT INTO `events` (`user_id`, `type`, `data`, `created_at`) VALUES (?, ?, ?, ?)',
        array((int) $uid, (string) $type, jc_json($data), now_ms())
    );
}

/** 向多个用户写入同一事件（等价 sendToUsers） */
function event_to_users($uids, $type, $data)
{
    $seen = array();
    foreach ($uids as $uid) {
        $uid = (int) $uid;
        if ($uid <= 0 || isset($seen[$uid])) {
            continue;
        }
        $seen[$uid] = true;
        event_insert($uid, $type, $data);
    }
}

/** 向单个用户写入事件（等价 sendToUser） */
function event_to_user($uid, $type, $data)
{
    $uid = (int) $uid;
    if ($uid <= 0) {
        return;
    }
    event_insert($uid, $type, $data);
}

/** 向全体用户广播（等价 broadcast，可指定 exceptUid 排除） */
function broadcast_event($type, $data, $except_uid = null)
{
    $rows = db_all('SELECT `id` FROM `users`');
    foreach ($rows as $r) {
        $uid = (int) $r['id'];
        if ($except_uid !== null && $uid === (int) $except_uid) {
            continue;
        }
        event_insert($uid, $type, $data);
    }
}

/** 向群成员广播（等价 broadcastGroup / sendToUsers(groupMembers) ） */
function event_to_group_members($gid, $type, $data, $except_uid = null)
{
    $ids = group_member_ids($gid);
    if ($except_uid !== null) {
        $ids = array_values(array_filter($ids, function ($x) use ($except_uid) {
            return (int) $x !== (int) $except_uid;
        }));
    }
    event_to_users($ids, $type, $data);
}

/** 向会话参与者写入（等价 sendToUsers(convParticipants) ） */
function event_to_conversation($conv_type, $conv_id, $type, $data, $except_uid = null)
{
    $ids = conv_participants($conv_type, $conv_id);
    if ($except_uid !== null) {
        $ids = array_values(array_filter($ids, function ($x) use ($except_uid) {
            return (int) $x !== (int) $except_uid;
        }));
    }
    event_to_users($ids, $type, $data);
}

/** 该用户当前可见的最大事件 id（无则 0） */
function events_cursor_for_user($uid)
{
    $v = db_value('SELECT MAX(`id`) FROM `events` WHERE `user_id` = ?', array((int) $uid));
    return $v === null ? 0 : (int) $v;
}

/** 增量拉取：该用户 id > since 的事件，升序，最多 $limit 条 */
function events_since($uid, $since, $limit = 200)
{
    return db_all(
        'SELECT `id`, `type`, `data` FROM `events` WHERE `user_id` = ? AND `id` > ? ORDER BY `id` ASC LIMIT ' . (int) $limit,
        array((int) $uid, (int) $since)
    );
}

/** 惰性清理：删除 24 小时前的旧事件 */
function events_cleanup()
{
    db_run('DELETE FROM `events` WHERE `created_at` < ?', array(now_ms() - 24 * 60 * 60 * 1000));
}
