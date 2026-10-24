<?php
/**
 * /api/users/* —— 搜索、资料、某人动态
 */

/** 是否可见某条动态（等价 canView） */
function can_view($m, $viewer_id, $is_friend)
{
    if (!empty($m['deleted']) || $m['visibility'] === 'private') {
        return false;
    }
    if ((int) $m['author_id'] === (int) $viewer_id) {
        return true;
    }
    $allow = safe_json($m['allow_ids']);
    $deny = safe_json($m['deny_ids']);
    $allow = is_array($allow) ? $allow : array();
    $deny = is_array($deny) ? $deny : array();
    if ($m['visibility'] === 'friends') {
        return (bool) $is_friend;
    }
    if ($m['visibility'] === 'custom') {
        return in_array((int) $viewer_id, array_map('intval', $allow), true);
    }
    if ($m['visibility'] === 'exclude') {
        return $is_friend && !in_array((int) $viewer_id, array_map('intval', $deny), true);
    }
    return true; // public
}

/** 组装动态（等价 shapeMoment） */
function shape_moment($m, $viewer_id)
{
    $author = public_user(get_user($m['author_id']));
    $media = safe_json($m['media']);
    $media = is_array($media) ? $media : array();

    $like_rows = db_all('SELECT `user_id`, `created_at` FROM `moment_likes` WHERE `moment_id` = ?', array((int) $m['id']));
    $likes = array();
    $liked = false;
    foreach ($like_rows as $l) {
        $lu = public_user(get_user($l['user_id']));
        if ($lu && (int) $lu['id'] === (int) $viewer_id) {
            $liked = true;
        }
        $likes[] = array('user' => $lu, 'created_at' => (int) $l['created_at']);
    }

    $comment_rows = db_all('SELECT * FROM `moment_comments` WHERE `moment_id` = ? AND `deleted` = 0 ORDER BY `id` ASC', array((int) $m['id']));
    $comments = array();
    foreach ($comment_rows as $c) {
        $comments[] = array(
            'id' => (int) $c['id'],
            'user' => public_user(get_user($c['user_id'])),
            'content' => (string) $c['content'],
            'msg_type' => isset($c['msg_type']) ? (string) $c['msg_type'] : 'text',
            'media_url' => isset($c['media_url']) ? (string) $c['media_url'] : '',
            'media_thumb' => isset($c['media_thumb']) ? (string) $c['media_thumb'] : '',
            'reply_to_user' => $c['reply_to_user'] ? public_user(get_user($c['reply_to_user'])) : null,
            'created_at' => (int) $c['created_at'],
            'is_mine' => (int) $c['user_id'] === (int) $viewer_id,
        );
    }

    return array(
        'id' => (int) $m['id'],
        'author' => $author,
        'text' => (string) $m['text'],
        'media' => $media,
        'visibility' => (string) $m['visibility'],
        'created_at' => (int) $m['created_at'],
        'likes' => $likes,
        'liked' => $liked,
        'comments' => $comments,
        'is_mine' => (int) $m['author_id'] === (int) $viewer_id,
        'is_friend' => are_friends($viewer_id, $m['author_id']),
    );
}

// 搜索用户（按昵称模糊搜索 + 按用户 ID 精确搜索）
route('GET', '#^/api/users/search$#', function ($params, $body) {
    $uid = require_auth();
    $q = isset($_GET['q']) ? trim((string) $_GET['q']) : '';
    if ($q === '') {
        return array(200, array('users' => array()));
    }
    $rows = db_all(
        'SELECT * FROM `users` WHERE (`username` LIKE ? OR `id` = ?) AND `id` != ? ORDER BY `is_official` DESC, `id` ASC LIMIT 20',
        array('%' . $q . '%', (int) $q, $uid)
    );
    $users = array();
    foreach ($rows as $u) {
        $p = public_user($u);
        $p['is_friend'] = are_friends($uid, $u['id']);
        $pending = db_one(
            'SELECT `id`, `from_id`, `to_id` FROM `friend_requests` WHERE `status` = ? AND ((`from_id` = ? AND `to_id` = ?) OR (`from_id` = ? AND `to_id` = ?)) LIMIT 1',
            array('pending', $uid, $u['id'], $u['id'], $uid)
        );
        $p['request'] = $pending
            ? array('id' => (int) $pending['id'], 'direction' => ((int) $pending['from_id'] === (int) $uid ? 'out' : 'in'))
            : null;
        $users[] = $p;
    }
    return array(200, array('users' => $users));
});

// 好友（或本人）可看到的动态
route('GET', '#^/api/users/(\d+)/moments$#', function ($params, $body) {
    $uid = require_auth();
    $target = (int) $params[0];
    $self = ($target === $uid);
    $is_friend = are_friends($uid, $target);
    $rows = db_all('SELECT * FROM `moments` WHERE `author_id` = ? AND `deleted` = 0 ORDER BY `id` DESC LIMIT 200', array($target));
    $list = array();
    foreach ($rows as $m) {
        if ($self || can_view($m, $uid, $is_friend)) {
            $list[] = shape_moment($m, $uid);
        }
    }
    return array(200, array('moments' => $list, 'is_friend' => $is_friend, 'is_self' => $self));
});

// 用户资料
route('GET', '#^/api/users/(\d+)$#', function ($params, $body) {
    $uid = require_auth();
    $u = get_user((int) $params[0]);
    if (!$u) {
        return array(404, array('error' => '用户不存在'));
    }
    $remarkRow = db_one('SELECT `remark` FROM `friendships` WHERE `user_id` = ? AND `friend_id` = ?', array($uid, (int) $u['id']));
    $remark = ($remarkRow && $remarkRow['remark']) ? $remarkRow['remark'] : '';
    $p = public_user($u);
    $p['remark'] = $remark;
    $p['is_friend'] = are_friends($uid, (int) $u['id']);
    return array(200, array('user' => $p));
});
