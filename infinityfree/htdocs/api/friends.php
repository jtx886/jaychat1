<?php
/**
 * /api/friends/* —— 好友列表 / 申请 / 接受 / 删除 / 拉黑 / 备注
 */

// 好友列表
route('GET', '#^/api/friends$#', function ($params, $body) {
    $uid = require_auth();
    $rows = db_all(
        'SELECT u.*, f.`remark` FROM `friendships` f JOIN `users` u ON u.`id` = f.`friend_id` WHERE f.`user_id` = ? ORDER BY f.`created_at` ASC',
        array($uid)
    );
    $friends = array();
    foreach ($rows as $u) {
        $p = public_user($u);
        $p['remark'] = isset($u['remark']) && $u['remark'] ? $u['remark'] : '';
        $friends[] = $p;
    }
    return array(200, array('friends' => $friends));
});

// 发送好友申请
route('POST', '#^/api/friends/request$#', function ($params, $body) {
    $uid = require_auth();
    $to = isset($body['toUserId']) ? (int) $body['toUserId'] : 0;
    $message = isset($body['message']) ? mb_substr((string) $body['message'], 0, 60, 'UTF-8') : '';
    if (!$to || $to === $uid) {
        return array(400, array('error' => '参数错误'));
    }
    if (!get_user($to)) {
        return array(404, array('error' => '用户不存在'));
    }
    if (is_blocked($to, $uid)) {
        return array(403, array('error' => '对方已拒绝接收好友申请'));
    }
    if (are_friends($uid, $to)) {
        return array(400, array('error' => '你们已经是好友了'));
    }
    $dup = db_one(
        'SELECT `id` FROM `friend_requests` WHERE `status` = ? AND `from_id` = ? AND `to_id` = ?',
        array('pending', $uid, $to)
    );
    if ($dup) {
        return array(400, array('error' => '已发送申请，等待对方验证'));
    }
    db_insert(
        'INSERT INTO `friend_requests` (`from_id`, `to_id`, `message`, `status`, `created_at`) VALUES (?, ?, ?, ?, ?)',
        array($uid, $to, $message, 'pending', now_ms())
    );
    $me = public_user(get_user($uid));
    create_notification(array(
        'user_id' => $to,
        'type' => 'friend_request',
        'actor_id' => $uid,
        'text' => $me['username'] . ' 请求添加你为好友',
        'ref_type' => 'friend_request',
    ));
    event_to_user($to, 'friend:request', array('from' => $me, 'message' => $message));
    return array(200, array('ok' => true));
});

// 我发出的申请
route('GET', '#^/api/friends/requests/sent$#', function ($params, $body) {
    $uid = require_auth();
    $rows = db_all('SELECT `to_id` FROM `friend_requests` WHERE `from_id` = ? AND `status` = ?', array($uid, 'pending'));
    $ids = array();
    foreach ($rows as $r) {
        $ids[] = (int) $r['to_id'];
    }
    return array(200, array('ids' => $ids));
});

// 收到的好友申请
route('GET', '#^/api/friends/requests$#', function ($params, $body) {
    $uid = require_auth();
    $rows = db_all('SELECT * FROM `friend_requests` WHERE `to_id` = ? AND `status` = ? ORDER BY `id` DESC', array($uid, 'pending'));
    $requests = array();
    foreach ($rows as $r) {
        $requests[] = array(
            'id' => (int) $r['id'],
            'message' => isset($r['message']) ? (string) $r['message'] : '',
            'created_at' => (int) $r['created_at'],
            'from' => public_user(get_user($r['from_id'])),
        );
    }
    return array(200, array('requests' => $requests));
});

// 通过
route('POST', '#^/api/friends/requests/(\d+)/accept$#', function ($params, $body) {
    $uid = require_auth();
    $r = db_one('SELECT * FROM `friend_requests` WHERE `id` = ? AND `to_id` = ?', array((int) $params[0], $uid));
    if (!$r || $r['status'] !== 'pending') {
        return array(400, array('error' => '申请不存在或已处理'));
    }
    db_run('UPDATE `friend_requests` SET `status` = ? WHERE `id` = ?', array('accepted', (int) $r['id']));
    add_friend($r['from_id'], $r['to_id']);
    $me = public_user(get_user($uid));
    create_notification(array(
        'user_id' => (int) $r['from_id'],
        'type' => 'friend_accept',
        'actor_id' => $uid,
        'text' => $me['username'] . ' 通过了你的好友申请',
        'ref_type' => 'friend',
    ));
    event_to_user((int) $r['from_id'], 'friend:accept', array('user' => $me));
    event_to_user($uid, 'friend:new', array('user' => public_user(get_user($r['from_id']))));
    return array(200, array('ok' => true));
});

// 拒绝
route('POST', '#^/api/friends/requests/(\d+)/reject$#', function ($params, $body) {
    $uid = require_auth();
    $r = db_one('SELECT * FROM `friend_requests` WHERE `id` = ? AND `to_id` = ?', array((int) $params[0], $uid));
    if (!$r) {
        return array(400, array('error' => '申请不存在'));
    }
    db_run('UPDATE `friend_requests` SET `status` = ? WHERE `id` = ?', array('rejected', (int) $r['id']));
    return array(200, array('ok' => true));
});

// 黑名单列表
route('GET', '#^/api/friends/blocks$#', function ($params, $body) {
    $uid = require_auth();
    $rows = db_all(
        'SELECT u.*, b.`created_at` AS `blocked_at` FROM `blocks` b JOIN `users` u ON u.`id` = b.`blocked_id` WHERE b.`user_id` = ? ORDER BY b.`created_at` DESC',
        array($uid)
    );
    $blocks = array();
    foreach ($rows as $u) {
        $p = public_user($u);
        $p['blocked_at'] = (int) $u['blocked_at'];
        $blocks[] = $p;
    }
    return array(200, array('blocks' => $blocks));
});

// 解除拉黑
route('DELETE', '#^/api/friends/block/(\d+)$#', function ($params, $body) {
    $uid = require_auth();
    $f = (int) $params[0];
    db_run('DELETE FROM `blocks` WHERE `user_id` = ? AND `blocked_id` = ?', array($uid, $f));
    return array(200, array('ok' => true));
});

// 拉黑（同时解除好友关系）
route('POST', '#^/api/friends/block$#', function ($params, $body) {
    $uid = require_auth();
    $f = isset($body['userId']) ? (int) $body['userId'] : 0;
    if (!$f || $f === $uid) {
        return array(400, array('error' => '参数错误'));
    }
    if (!get_user($f)) {
        return array(404, array('error' => '用户不存在'));
    }
    db_exec_ignore('INSERT INTO `blocks` (`user_id`, `blocked_id`, `created_at`) VALUES (?, ?, ?)', array($uid, $f, now_ms()));
    db_run('DELETE FROM `friendships` WHERE `user_id` = ? AND `friend_id` = ?', array($uid, $f));
    db_run('DELETE FROM `friendships` WHERE `user_id` = ? AND `friend_id` = ?', array($f, $uid));
    db_run('UPDATE `friend_requests` SET `status` = ? WHERE (`from_id` = ? AND `to_id` = ?) OR (`from_id` = ? AND `to_id` = ?)', array('rejected', $uid, $f, $f, $uid));
    event_to_user($f, 'friend:remove', array('userId' => $uid));
    return array(200, array('ok' => true));
});

// 删除好友
route('DELETE', '#^/api/friends/(\d+)$#', function ($params, $body) {
    $uid = require_auth();
    $f = (int) $params[0];
    db_run('DELETE FROM `friendships` WHERE `user_id` = ? AND `friend_id` = ?', array($uid, $f));
    db_run('DELETE FROM `friendships` WHERE `user_id` = ? AND `friend_id` = ?', array($f, $uid));
    event_to_user($f, 'friend:remove', array('userId' => $uid));
    return array(200, array('ok' => true));
});

// 设置好友备注
route('PATCH', '#^/api/friends/(\d+)$#', function ($params, $body) {
    $uid = require_auth();
    $f = (int) $params[0];
    if (!are_friends($uid, $f)) {
        return array(400, array('error' => '对方不是你的好友'));
    }
    $raw = array_key_exists('remark', $body) && $body['remark'] !== null ? (string) $body['remark'] : '';
    $remark = mb_substr($raw, 0, 20, 'UTF-8');
    db_run('UPDATE `friendships` SET `remark` = ? WHERE `user_id` = ? AND `friend_id` = ?', array($remark, $uid, $f));
    return array(200, array('ok' => true, 'remark' => $remark));
});
