<?php
/**
 * /api/moments/* —— 朋友圈：发布 / 列表 / 详情 / 可见范围 / 删除 / 点赞 / 评论
 */

const JC_VISIBILITIES = array('public', 'private', 'friends', 'custom', 'exclude');

// 发布动态
route('POST', '#^/api/moments$#', function ($params, $body) {
    $uid = require_auth();
    $text = isset($body['text']) ? $body['text'] : '';
    $media = (isset($body['media']) && is_array($body['media'])) ? $body['media'] : array();
    $visibility = isset($body['visibility']) ? $body['visibility'] : 'public';
    $allowIds = (isset($body['allowIds']) && is_array($body['allowIds'])) ? $body['allowIds'] : array();
    $denyIds = (isset($body['denyIds']) && is_array($body['denyIds'])) ? $body['denyIds'] : array();

    $vis = in_array($visibility, JC_VISIBILITIES, true) ? $visibility : 'public';
    $items = array();
    foreach (array_slice($media, 0, 9) as $m) {
        $url = isset($m['url']) ? (string) $m['url'] : '';
        if ($url === '') {
            continue;
        }
        $items[] = array(
            'url' => $url,
            'type' => (isset($m['type']) && $m['type'] === 'video') ? 'video' : 'image',
            'thumb' => isset($m['thumb']) ? (string) $m['thumb'] : '',
        );
    }
    if (trim((string) $text) === '' && empty($items)) {
        return array(400, array('error' => '请输入内容或选择图片/视频'));
    }

    $id = db_insert(
        'INSERT INTO `moments` (`author_id`, `text`, `media`, `visibility`, `allow_ids`, `deny_ids`, `deleted`, `created_at`)
         VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
        array(
            $uid,
            mb_substr((string) $text, 0, 1000, 'UTF-8'),
            jc_json($items),
            $vis,
            jc_json(array_map('intval', $allowIds)),
            jc_json(array_map('intval', $denyIds)),
            now_ms(),
        )
    );
    $m = db_one('SELECT * FROM `moments` WHERE `id` = ?', array($id));
    $shaped = shape_moment($m, $uid);

    $targets = array();
    if ($vis === 'private') {
        $targets = array();
    } elseif ($vis === 'custom') {
        $targets = array_map('intval', $allowIds);
    } else {
        $targets = friend_ids($uid);
    }
    $uids = array_values(array_unique(array_merge(array($uid), $targets)));
    event_to_users($uids, 'moment:new', $shaped);
    return array(200, array('moment' => $shaped));
});

// 动态流
route('GET', '#^/api/moments$#', function ($params, $body) {
    $uid = require_auth();
    $scope = isset($_GET['scope']) ? (string) $_GET['scope'] : 'all';
    $rows = db_all('SELECT * FROM `moments` WHERE `deleted` = 0 ORDER BY `id` DESC LIMIT 300');
    $list = array();
    foreach ($rows as $m) {
        $isFriend = are_friends($uid, $m['author_id']);
        if ($scope === 'friends') {
            if (!((int) $m['author_id'] === (int) $uid || $isFriend)) {
                continue;
            }
        } else {
            if (!((int) $m['author_id'] === (int) $uid || can_view($m, $uid, $isFriend))) {
                continue;
            }
        }
        $list[] = shape_moment($m, $uid);
    }
    return array(200, array('moments' => $list, 'scope' => $scope));
});

// 我的动态
route('GET', '#^/api/moments/mine$#', function ($params, $body) {
    $uid = require_auth();
    $rows = db_all('SELECT * FROM `moments` WHERE `author_id` = ? AND `deleted` = 0 ORDER BY `id` DESC', array($uid));
    $list = array();
    foreach ($rows as $m) {
        $list[] = shape_moment($m, $uid);
    }
    return array(200, array('moments' => $list));
});

// 动态详情
route('GET', '#^/api/moments/(\d+)$#', function ($params, $body) {
    $uid = require_auth();
    $id = (int) $params[0];
    $m = db_one('SELECT * FROM `moments` WHERE `id` = ? AND `deleted` = 0', array($id));
    if (!$m) {
        return array(404, array('error' => '动态不存在或已删除'));
    }
    if ((int) $m['author_id'] !== (int) $uid && !can_view($m, $uid, are_friends($uid, $m['author_id']))) {
        return array(403, array('error' => '无权查看该动态'));
    }
    return array(200, array('moment' => shape_moment($m, $uid)));
});

// 修改动态可见范围
route('PATCH', '#^/api/moments/(\d+)$#', function ($params, $body) {
    $uid = require_auth();
    $id = (int) $params[0];
    $m = db_one('SELECT * FROM `moments` WHERE `id` = ? AND `deleted` = 0', array($id));
    if (!$m) {
        return array(404, array('error' => '动态不存在或已删除'));
    }
    if ((int) $m['author_id'] !== (int) $uid) {
        return array(403, array('error' => '只能修改自己的动态'));
    }
    $visibility = isset($body['visibility']) ? $body['visibility'] : null;
    $allowIds = (isset($body['allowIds']) && is_array($body['allowIds'])) ? $body['allowIds'] : array();
    $denyIds = (isset($body['denyIds']) && is_array($body['denyIds'])) ? $body['denyIds'] : array();
    if (!in_array($visibility, JC_VISIBILITIES, true)) {
        return array(400, array('error' => '可见范围不合法'));
    }
    $allow = $visibility === 'custom' ? array_map('intval', $allowIds) : array();
    $deny = $visibility === 'exclude' ? array_map('intval', $denyIds) : array();
    if (($visibility === 'custom' || $visibility === 'exclude') && empty($allow) && empty($deny)) {
        return array(400, array('error' => '请选择好友'));
    }
    db_run('UPDATE `moments` SET `visibility` = ?, `allow_ids` = ?, `deny_ids` = ? WHERE `id` = ?', array($visibility, jc_json($allow), jc_json($deny), $id));
    $shaped = shape_moment(db_one('SELECT * FROM `moments` WHERE `id` = ?', array($id)), $uid);
    $uids = array_values(array_unique(array_merge(array($uid), friend_ids($uid))));
    event_to_users($uids, 'moment:update', $shaped);
    return array(200, array('moment' => $shaped));
});

// 删除动态
route('DELETE', '#^/api/moments/(\d+)$#', function ($params, $body) {
    $uid = require_auth();
    $id = (int) $params[0];
    $m = db_one('SELECT * FROM `moments` WHERE `id` = ?', array($id));
    if (!$m) {
        return array(404, array('error' => '动态不存在'));
    }
    if ((int) $m['author_id'] !== (int) $uid) {
        return array(403, array('error' => '只能删除自己的动态'));
    }
    db_run('UPDATE `moments` SET `deleted` = 1 WHERE `id` = ?', array($id));
    event_to_users(friend_ids($uid), 'moment:delete', array('id' => $id));
    return array(200, array('ok' => true));
});

// 点赞 / 取消点赞
route('POST', '#^/api/moments/(\d+)/like$#', function ($params, $body) {
    $uid = require_auth();
    $id = (int) $params[0];
    $m = db_one('SELECT * FROM `moments` WHERE `id` = ? AND `deleted` = 0', array($id));
    if (!$m) {
        return array(404, array('error' => '动态不存在或已删除'));
    }
    $liked = db_one('SELECT 1 FROM `moment_likes` WHERE `moment_id` = ? AND `user_id` = ?', array($id, $uid));
    if ($liked) {
        db_run('DELETE FROM `moment_likes` WHERE `moment_id` = ? AND `user_id` = ?', array($id, $uid));
    } else {
        db_run('INSERT INTO `moment_likes` (`moment_id`, `user_id`, `created_at`) VALUES (?, ?, ?)', array($id, $uid, now_ms()));
        if ((int) $m['author_id'] !== (int) $uid) {
            create_notification(array(
                'user_id' => (int) $m['author_id'],
                'type' => 'moment_like',
                'actor_id' => $uid,
                'text' => public_user(get_user($uid))['username'] . ' 赞了你的动态',
                'ref_type' => 'moment',
                'ref_id' => $id,
            ));
        }
    }
    $shaped = shape_moment(db_one('SELECT * FROM `moments` WHERE `id` = ?', array($id)), $uid);
    $uids = array_values(array_unique(array_merge(array((int) $m['author_id']), friend_ids($uid), array($uid))));
    event_to_users($uids, 'moment:update', $shaped);
    return array(200, array('moment' => $shaped));
});

// 评论 / 回复（支持文字、图片、视频、表情、动画表情包）
route('POST', '#^/api/moments/(\d+)/comments$#', function ($params, $body) {
    $uid = require_auth();
    $id = (int) $params[0];
    $m = db_one('SELECT * FROM `moments` WHERE `id` = ? AND `deleted` = 0', array($id));
    if (!$m) {
        return array(404, array('error' => '动态不存在或已删除'));
    }
    $msgType = isset($body['msg_type']) ? (string) $body['msg_type'] : 'text';
    if (!in_array($msgType, array('text', 'image', 'video', 'sticker'), true)) {
        $msgType = 'text';
    }
    $content = isset($body['content']) ? trim((string) $body['content']) : '';
    $content = mb_substr($content, 0, 300, 'UTF-8');
    $mediaUrl = isset($body['media_url']) ? mb_substr(trim((string) $body['media_url']), 0, 1000, 'UTF-8') : '';
    $mediaThumb = isset($body['media_thumb']) ? mb_substr(trim((string) $body['media_thumb']), 0, 1000, 'UTF-8') : '';

    if ($msgType === 'text') {
        if ($content === '') {
            return array(400, array('error' => '评论内容不能为空'));
        }
    } elseif ($mediaUrl === '') {
        return array(400, array('error' => '请先选择要发送的图片/视频/表情'));
    }
    // 通知里展示的文本：有文字用文字，没有则用类型占位
    $preview = $content !== ''
        ? $content
        : ($msgType === 'image' ? '[图片]' : ($msgType === 'video' ? '[视频]' : '[动画表情]'));

    $replyTo = isset($body['replyToUserId']) ? (int) $body['replyToUserId'] : 0;
    $cid = db_insert(
        'INSERT INTO `moment_comments` (`moment_id`, `user_id`, `content`, `msg_type`, `media_url`, `media_thumb`, `reply_to_user`, `deleted`, `created_at`) VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)',
        array($id, $uid, $content, $msgType, $mediaUrl, $mediaThumb, $replyTo ?: 0, now_ms())
    );
    $me = public_user(get_user($uid));

    if ($replyTo && $replyTo !== (int) $uid) {
        create_notification(array(
            'user_id' => $replyTo,
            'type' => 'comment_reply',
            'actor_id' => $uid,
            'text' => $me['username'] . ' 回复了你的评论：' . $preview,
            'ref_type' => 'moment',
            'ref_id' => $id,
        ));
    }
    if ((int) $m['author_id'] !== (int) $uid) {
        create_notification(array(
            'user_id' => (int) $m['author_id'],
            'type' => 'moment_comment',
            'actor_id' => $uid,
            'text' => $me['username'] . ' 评论了你的动态：' . $preview,
            'ref_type' => 'moment',
            'ref_id' => $id,
        ));
    }
    $shaped = shape_moment(db_one('SELECT * FROM `moments` WHERE `id` = ?', array($id)), $uid);
    $uids = array_values(array_unique(array_merge(array((int) $m['author_id']), friend_ids($uid), array($uid))));
    event_to_users($uids, 'moment:update', $shaped);
    return array(200, array('moment' => $shaped, 'comment_id' => $cid));
});

// 删除评论
route('DELETE', '#^/api/moments/(\d+)/comments/(\d+)$#', function ($params, $body) {
    $uid = require_auth();
    $id = (int) $params[0];
    $cid = (int) $params[1];
    $m = db_one('SELECT * FROM `moments` WHERE `id` = ?', array($id));
    $c = db_one('SELECT * FROM `moment_comments` WHERE `id` = ? AND `moment_id` = ?', array($cid, $id));
    if (!$m || !$c) {
        return array(404, array('error' => '评论不存在'));
    }
    if ((int) $c['user_id'] !== (int) $uid && (int) $m['author_id'] !== (int) $uid) {
        return array(403, array('error' => '无权删除该评论'));
    }
    db_run('UPDATE `moment_comments` SET `deleted` = 1 WHERE `id` = ?', array($cid));
    $shaped = shape_moment($m, $uid);
    $uids = array_values(array_unique(array_merge(array((int) $m['author_id']), friend_ids($uid), array($uid))));
    event_to_users($uids, 'moment:update', $shaped);
    return array(200, array('ok' => true, 'moment' => $shaped));
});
