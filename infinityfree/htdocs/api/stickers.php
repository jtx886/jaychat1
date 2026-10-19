<?php
/**
 * /api/stickers/* —— 动画表情包（soogif 资源）
 *
 *   GET    /api/stickers/search?q=&limit=   关键词搜索表情包（结果）
 *   GET    /api/stickers/related?url=&label= 相关表情（根据标题关键词再搜一次）
 *   GET    /api/stickers/favs                我的添加
 *   POST   /api/stickers/favs {url,label}    添加到「我的添加」
 *   POST   /api/stickers/favs/remove {url}   从「我的添加」移除
 *
 * 「合成」分类在前端本地用 canvas 生成（关键词 + 模板），不占用服务端资源。
 */

/** 收藏条目统一归一化 */
function sticker_fav_row($r)
{
    return array(
        'id' => (string) $r['ukey'],
        'url' => (string) $r['url'],
        'thumb' => (string) $r['url'],
        'label' => isset($r['label']) ? (string) $r['label'] : '',
        'added_at' => (int) $r['added_at'],
    );
}

/** 读取我的收藏（按添加时间倒序） */
function sticker_favs_list($uid)
{
    $rows = db_all('SELECT * FROM `sticker_favs` WHERE `user_id` = ? ORDER BY `added_at` DESC', array((int) $uid));
    $out = array();
    foreach ($rows as $r) {
        $out[] = sticker_fav_row($r);
    }
    return $out;
}

/** 从表情标题中提取搜索关键词 */
function sticker_keyword_from_label($label)
{
    $label = trim((string) $label);
    // 去掉常见噪声词与标点，取前 6 个字符
    $label = preg_replace('#(表情包|表情|动图|gif|GIF|高清|无水印|热门|soogif|搜狗)#u', '', $label);
    $label = trim(preg_replace('#[\s\-_/、,，。.。!！?？~～]+#u', ' ', $label));
    if ($label === '') {
        $label = '搞笑';
    }
    return mb_substr($label, 0, 12, 'UTF-8');
}

/* ------------------------------ 搜索 ------------------------------ */

route('GET', '#^/api/stickers/search$#', function ($params, $body) {
    require_auth();
    $q = isset($_GET['q']) ? trim((string) $_GET['q']) : '';
    if ($q === '') {
        return array(400, array('error' => '请输入搜索关键词'));
    }
    $page = isset($_GET['page']) ? (int) $_GET['page'] : 1;
    if ($page < 1) {
        $page = 1;
    }
    $base = isset($_GET['base']) ? trim((string) $_GET['base']) : '';
    $r = jc_soogif_page(mb_substr($q, 0, 24, 'UTF-8'), $page, $base);
    if (empty($r['ok'])) {
        return array(502, array('error' => isset($r['error']) ? $r['error'] : '表情资源获取失败，请稍后重试'));
    }
    return array(200, array(
        'items' => $r['items'],
        'keyword' => $q,
        'page' => (int) $r['page'],
        'max_page' => (int) $r['max_page'],
        'base' => (string) $r['base'],
        'total' => (int) $r['total'],
    ));
});

/* ------------------------------ 相关表情 ------------------------------ */

route('GET', '#^/api/stickers/related$#', function ($params, $body) {
    require_auth();
    $url = isset($_GET['url']) ? (string) $_GET['url'] : '';
    $label = isset($_GET['label']) ? (string) $_GET['label'] : '';
    $kw = sticker_keyword_from_label($label);
    $items = jc_soogif_search($kw, 24);
    if ($items === null) {
        return array(502, array('error' => '相关表情获取失败，请稍后重试'));
    }
    // 去掉与当前表情完全相同的项
    $out = array();
    foreach ($items as $it) {
        if ($url !== '' && (string) $it['url'] === $url) {
            continue;
        }
        $out[] = $it;
    }
    return array(200, array('items' => $out, 'keyword' => $kw));
});

/* ------------------------------ 我的添加 ------------------------------ */

route('GET', '#^/api/stickers/favs$#', function ($params, $body) {
    $uid = require_auth();
    return array(200, array('items' => sticker_favs_list($uid)));
});

route('POST', '#^/api/stickers/favs$#', function ($params, $body) {
    $uid = require_auth();
    $url = isset($body['url']) ? trim((string) $body['url']) : '';
    $label = isset($body['label']) ? mb_substr(trim((string) $body['label']), 0, 128, 'UTF-8') : '';
    if ($url === '' || !preg_match('#^https?://#i', $url)) {
        return array(400, array('error' => '表情地址不合法'));
    }
    $url = mb_substr($url, 0, 1000, 'UTF-8');
    $ukey = md5($url);
    db_exec_ignore(
        'INSERT INTO `sticker_favs` (`user_id`, `ukey`, `url`, `label`, `added_at`) VALUES (?, ?, ?, ?, ?)',
        array((int) $uid, $ukey, $url, $label, now_ms())
    );
    return array(200, array('ok' => true, 'items' => sticker_favs_list($uid)));
});

route('POST', '#^/api/stickers/favs/remove$#', function ($params, $body) {
    $uid = require_auth();
    $url = isset($body['url']) ? trim((string) $body['url']) : '';
    if ($url === '') {
        return array(400, array('error' => '缺少表情地址'));
    }
    db_run('DELETE FROM `sticker_favs` WHERE `user_id` = ? AND `ukey` = ?', array((int) $uid, md5($url)));
    return array(200, array('ok' => true, 'items' => sticker_favs_list($uid)));
});
