<?php
/**
 * /api/notifications/* —— 通知列表 / 未读数 / 标记已读 / 删除
 */

route('GET', '#^/api/notifications$#', function ($params, $body) {
    $uid = require_auth();
    $rows = db_all('SELECT * FROM `notifications` WHERE `user_id` = ? ORDER BY `id` DESC LIMIT 200', array($uid));
    $list = array();
    foreach ($rows as $n) {
        $list[] = array(
            'id' => (int) $n['id'],
            'type' => (string) $n['type'],
            'text' => isset($n['text']) ? (string) $n['text'] : '',
            'read' => !empty($n['read']),
            'ref_type' => isset($n['ref_type']) ? (string) $n['ref_type'] : '',
            'ref_id' => (int) $n['ref_id'],
            'created_at' => (int) $n['created_at'],
            'actor' => $n['actor_id'] ? public_user(get_user($n['actor_id'])) : null,
        );
    }
    $unread = (int) db_value('SELECT COUNT(*) FROM `notifications` WHERE `user_id` = ? AND `read` = 0', array($uid));
    return array(200, array('notifications' => $list, 'unread' => $unread));
});

route('GET', '#^/api/notifications/unread$#', function ($params, $body) {
    $uid = require_auth();
    $unread = (int) db_value('SELECT COUNT(*) FROM `notifications` WHERE `user_id` = ? AND `read` = 0', array($uid));
    return array(200, array('unread' => $unread));
});

route('POST', '#^/api/notifications/read$#', function ($params, $body) {
    $uid = require_auth();
    db_run('UPDATE `notifications` SET `read` = 1 WHERE `user_id` = ?', array($uid));
    return array(200, array('ok' => true));
});

route('DELETE', '#^/api/notifications/(\d+)$#', function ($params, $body) {
    $uid = require_auth();
    db_run('DELETE FROM `notifications` WHERE `id` = ? AND `user_id` = ?', array((int) $params[0], $uid));
    return array(200, array('ok' => true));
});
