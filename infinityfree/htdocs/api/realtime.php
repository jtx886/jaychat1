<?php
/**
 * 实时（轮询模式）：
 *   GET  /api/presence   批量在线状态（无需鉴权，与 Node 一致）
 *   GET  /api/poll       增量拉取事件（需鉴权）
 *   POST /api/typing     正在输入（需鉴权）
 *
 * 在线判定：users.last_poll 在 60 秒内（配合 online=1）。
 */

// 批量在线状态
route('GET', '#^/api/presence$#', function ($params, $body) {
    $raw = isset($_GET['ids']) ? (string) $_GET['ids'] : '';
    $ids = array();
    foreach (explode(',', $raw) as $p) {
        $n = (int) trim($p);
        if ($n) {
            $ids[] = $n;
        }
    }
    $presence = array();
    if (!empty($ids)) {
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $rows = db_all(
            'SELECT `id`, `online`, `last_seen`, `last_poll` FROM `users` WHERE `id` IN (' . $placeholders . ')',
            $ids
        );
        foreach ($rows as $r) {
            $presence[] = array(
                'userId' => (int) $r['id'],
                'online' => user_is_online($r),
                'last_seen' => (int) $r['last_seen'],
            );
        }
    }
    return array(200, array('presence' => $presence));
});

// 增量拉取事件
route('GET', '#^/api/poll$#', function ($params, $body) {
    $uid = require_auth();

    // 更新在线状态：last_poll=now、online=1（上线时广播 presence）
    $before = get_user($uid);
    $wasOffline = !user_is_online($before);
    db_run('UPDATE `users` SET `online` = 1, `last_poll` = ?, `last_seen` = ? WHERE `id` = ?', array(now_ms(), now_ms(), $uid));

    if ($wasOffline) {
        $u = get_user($uid);
        $presenceUser = array(
            'id' => (int) $u['id'],
            'username' => (string) $u['username'],
            'avatar' => isset($u['avatar']) ? (string) $u['avatar'] : '',
            'last_seen' => (int) $u['last_seen'],
        );
        broadcast_event('presence', array('userId' => (int) $uid, 'online' => true, 'user' => $presenceUser));
    }

    // 未携带 since：视为首次连接，返回当前游标且不补发历史事件（避免重放积压）
    // 携带 since（含 0）：按增量拉取 id > since 的事件
    $hasSince = isset($_GET['since']) && $_GET['since'] !== '';

    if (!$hasSince) {
        $cursor = events_cursor_for_user($uid);
        events_cleanup();
        return array(200, array('cursor' => $cursor, 'events' => array()));
    }
    $since = (int) $_GET['since'];

    // 长轮询：wait=N（秒，最多 20）。有事件立即返回，没有则挂起到有新事件或超时，
    // 实时性接近 WebSocket，同时把轮询请求数从「每 3 秒一次」降到「每次事件一次」。
    $wait = isset($_GET['wait']) ? (int) $_GET['wait'] : 0;
    $wait = max(0, min(20, $wait));

    $rows = events_since($uid, $since, 200);
    if ($wait > 0 && empty($rows)) {
        $deadline = microtime(true) + $wait;
        while (empty($rows) && microtime(true) < $deadline) {
            usleep(600000);
            // 长轮询期间持续刷新 last_poll，避免被判定为离线
            db_run('UPDATE `users` SET `last_poll` = ? WHERE `id` = ?', array(now_ms(), $uid));
            $rows = events_since($uid, $since, 200);
        }
    }
    $events = array();
    $maxId = $since;
    foreach ($rows as $r) {
        $id = (int) $r['id'];
        if ($id > $maxId) {
            $maxId = $id;
        }
        $data = json_decode($r['data'], true);
        $events[] = array('type' => (string) $r['type'], 'data' => ($data === null ? empty_obj() : $data));
    }

    events_cleanup();
    return array(200, array('cursor' => $maxId, 'events' => $events));
});

// 正在输入
route('POST', '#^/api/typing$#', function ($params, $body) {
    $uid = require_auth();
    $convType = isset($body['convType']) ? $body['convType'] : null;
    $convId = isset($body['convId']) ? $body['convId'] : null;
    event_to_conversation($convType, $convId, 'typing', array(
        'convType' => $convType,
        'convId' => (string) $convId,
        'userId' => (int) $uid,
    ), $uid);
    return array(200, array('ok' => true));
});
