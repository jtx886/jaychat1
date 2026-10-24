<?php
/**
 * /api/conversations  /api/messages  /api/upload  /api/dm-dnd
 */

const JC_RECALL_WINDOW = 180000; // 3 分钟

function last_message($conv_type, $conv_id, $viewer_uid = 0)
{
    $hideSql = '';
    $params = array($conv_type, (string) $conv_id);
    if ($viewer_uid > 0) {
        // 自己「删除」过的消息不再出现在会话预览里
        $hideSql = ' AND `id` NOT IN (SELECT `message_id` FROM `message_hides` WHERE `user_id` = ?)';
        $params[] = (int) $viewer_uid;
    }
    return db_one(
        'SELECT * FROM `messages` WHERE `conv_type` = ? AND `conv_id` = ? AND `recalled` = 0' . $hideSql . ' ORDER BY `id` DESC LIMIT 1',
        $params
    );
}

function is_burned($message_id, $uid)
{
    return db_one('SELECT 1 FROM `message_burns` WHERE `message_id` = ? AND `user_id` = ?', array((int) $message_id, (int) $uid)) !== null;
}

function unread_count($conv_type, $conv_id, $uid)
{
    $rows = db_all(
        'SELECT `id`, `one_time` FROM `messages` WHERE `conv_type` = ? AND `conv_id` = ? AND `sender_id` != ? AND `recalled` = 0
         AND `id` NOT IN (SELECT `message_id` FROM `message_reads` WHERE `user_id` = ?)
         AND `id` NOT IN (SELECT `message_id` FROM `message_hides` WHERE `user_id` = ?)',
        array($conv_type, (string) $conv_id, (int) $uid, (int) $uid, (int) $uid)
    );
    $n = 0;
    foreach ($rows as $r) {
        if (!empty($r['one_time']) && is_burned((int) $r['id'], $uid)) {
            continue;
        }
        $n++;
    }
    return $n;
}

function preview_of($m)
{
    $text = isset($m['content']) ? (string) $m['content'] : '';
    if ($m['msg_type'] === 'image') {
        $text = '[图片]';
    } elseif ($m['msg_type'] === 'video') {
        $text = '[视频]';
    } elseif ($m['msg_type'] === 'sticker') {
        $text = '[动画表情]';
    } elseif ($m['msg_type'] === 'forward') {
        $fj = safe_json($m['content']);
        $n = is_array($fj) ? count($fj) : 0;
        $text = $n > 0 ? ('[聊天记录] ' . $n . ' 条消息') : '[聊天记录]';
    }
    if (!empty($m['one_time'])) {
        $text = '[一次性消息]';
    }
    if ((int) $m['sender_id'] === 0) {
        $sender = jc_ai_public()['name'];
    } else {
        $pu = public_user(get_user($m['sender_id']));
        $sender = $pu ? $pu['username'] : '';
    }
    return array(
        'text' => $text,
        'sender' => $sender,
        'msg_type' => (string) $m['msg_type'],
        'one_time' => !empty($m['one_time']),
        'created_at' => (int) $m['created_at'],
    );
}

/** 是否有权访问该会话（等价 checkAccess） */
function check_access($uid, $conv_type, $conv_id)
{
    if ($conv_type === 'group') {
        return (bool) member_role((int) $conv_id, $uid);
    }
    $parts = array_map('intval', explode('_', (string) $conv_id));
    if (!in_array((int) $uid, $parts, true)) {
        return false;
    }
    $peer = null;
    foreach ($parts as $x) {
        if ($x !== (int) $uid) {
            $peer = $x;
            break;
        }
    }
    if ($peer === null) {
        return false;
    }
    $peerU = get_user($peer);
    return are_friends($uid, $peer) || ($peerU && !empty($peerU['is_official']));
}

function mark_read_bulk($uid, $ids, $conv_type, $conv_id)
{
    if (empty($ids)) {
        return;
    }
    foreach ($ids as $id) {
        db_exec_ignore('INSERT INTO `message_reads` (`message_id`, `user_id`, `read_at`) VALUES (?, ?, ?)', array((int) $id, (int) $uid, now_ms()));
    }
    $counts = new stdClass();
    foreach ($ids as $id) {
        $c = (int) db_value('SELECT COUNT(*) FROM `message_reads` WHERE `message_id` = ?', array((int) $id));
        $counts->{(string) (int) $id} = $c;
    }
    $payload = array(
        'convType' => $conv_type,
        'convId' => (string) $conv_id,
        'readerId' => (int) $uid,
        'messageIds' => array_map('intval', $ids),
        'counts' => $counts,
        'readAt' => now_ms(),
    );
    event_to_conversation($conv_type, $conv_id, 'message:read', $payload);
}

/* ------------------------------- 媒体上传 ------------------------------- */

const JC_VIDEO_EXT = array('.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv', '.3gp', '.flv', '.wmv', '.mpeg', '.mpg');

/** 依据真实文件内容判断类型与安全扩展名；不支持的类型返回 null */
function jc_upload_type($tmp, $clientExt)
{
    $mime = '';
    if (function_exists('finfo_open')) {
        $fi = @finfo_open(FILEINFO_MIME_TYPE);
        if ($fi) {
            $mime = (string) @finfo_file($fi, $tmp);
            @finfo_close($fi);
        }
    }
    // SVG 可携带脚本，直接拒绝，避免存储型 XSS
    if ($mime === 'image/svg+xml') {
        return null;
    }
    $imageMap = array(
        'image/jpeg' => '.jpg', 'image/png' => '.png', 'image/gif' => '.gif',
        'image/webp' => '.webp', 'image/bmp' => '.bmp',
    );
    $videoMap = array(
        'video/mp4' => '.mp4', 'video/quicktime' => '.mov', 'video/webm' => '.webm',
        'video/x-msvideo' => '.avi', 'video/x-matroska' => '.mkv', 'video/3gpp' => '.3gp',
        'video/x-flv' => '.flv', 'video/x-ms-wmv' => '.wmv', 'video/mpeg' => '.mpeg',
    );
    if (isset($imageMap[$mime])) {
        return array('kind' => 'image', 'ext' => $imageMap[$mime], 'mime' => $mime);
    }
    if (isset($videoMap[$mime])) {
        return array('kind' => 'video', 'ext' => $videoMap[$mime], 'mime' => $mime);
    }
    // 主机未开启 fileinfo 时，退化为扩展名白名单（仍拒绝脚本类扩展名）
    $allowed = array_merge(array_values($imageMap), array_values($videoMap), JC_VIDEO_EXT);
    $clientExt = strtolower((string) $clientExt);
    if (in_array($clientExt, $allowed, true)) {
        $isVideo = in_array($clientExt, JC_VIDEO_EXT, true);
        return array(
            'kind' => $isVideo ? 'video' : 'image',
            'ext' => $clientExt,
            'mime' => $isVideo ? 'video/mp4' : 'image/jpeg',
        );
    }
    return null;
}

/**
 * 统一接收上传内容，兼容两种协议：
 *   1) multipart/form-data —— 标准方式，PHP 已解析到 $_FILES['file']
 *   2) application/octet-stream —— 原始二进制（配合 X-File-Name 头），
 *      用于部分共享主机/WAF 直接拦截 multipart 请求（返回 403）的场景。
 *
 * 返回：array('tmp','name','size','cleanup') 或 array('error'=>代码,'limit'=>描述)；无内容返回 null。
 */
function jc_upload_input()
{
    $f = isset($_FILES['file']) ? $_FILES['file'] : null;
    if (is_array($f) && isset($f['error']) && !is_array($f['error'])) {
        $err = (int) $f['error'];
        if ($err !== UPLOAD_ERR_OK) {
            return array('error' => $err, 'limit' => (string) ini_get('upload_max_filesize'));
        }
        $tmp = isset($f['tmp_name']) ? (string) $f['tmp_name'] : '';
        if ($tmp === '' || !is_uploaded_file($tmp)) {
            return array('error' => UPLOAD_ERR_NO_FILE, 'limit' => (string) ini_get('post_max_size'));
        }
        return array(
            'tmp' => $tmp,
            'name' => isset($f['name']) ? (string) $f['name'] : '',
            'size' => isset($f['size']) ? (int) $f['size'] : (int) @filesize($tmp),
            'cleanup' => false,
        );
    }

    $ct = isset($_SERVER['CONTENT_TYPE']) ? strtolower((string) $_SERVER['CONTENT_TYPE']) : '';
    if (strpos($ct, 'application/octet-stream') !== 0) {
        return null;
    }
    $tmp = @tempnam(sys_get_temp_dir(), 'jcu');
    if (!$tmp) {
        return array('error' => UPLOAD_ERR_CANT_WRITE, 'limit' => '');
    }
    $src = @fopen('php://input', 'rb');
    $dst = @fopen($tmp, 'wb');
    if (!$src || !$dst) {
        if ($src) { @fclose($src); }
        if ($dst) { @fclose($dst); }
        @unlink($tmp);
        return array('error' => UPLOAD_ERR_CANT_WRITE, 'limit' => '');
    }
    $size = (int) @stream_copy_to_stream($src, $dst);
    @fclose($src);
    @fclose($dst);
    if ($size <= 0) {
        @unlink($tmp);
        return array('error' => UPLOAD_ERR_NO_FILE, 'limit' => (string) ini_get('post_max_size'));
    }
    $name = isset($_SERVER['HTTP_X_FILE_NAME']) ? rawurldecode((string) $_SERVER['HTTP_X_FILE_NAME']) : '';
    return array('tmp' => $tmp, 'name' => $name, 'size' => $size, 'cleanup' => true);
}

/**
 * 把已落地到临时路径的文件校验并保存到 uploads/YYYYMM/。
 * 返回 array($status, $data)，与路由返回值一致。
 */
function jc_store_upload($tmp, $name, $size, $cleanup)
{
    $maxBytes = (int) jc_config('UPLOAD_MAX_BYTES');
    if ($maxBytes > 0 && $size > $maxBytes) {
        if ($cleanup) {
            @unlink($tmp);
        }
        return array(400, array('error' => '文件过大，当前部署最多支持 ' . round($maxBytes / 1048576, 1) . 'MB'));
    }

    $clientExt = strtolower((string) pathinfo((string) $name, PATHINFO_EXTENSION));
    $clientExt = $clientExt !== '' ? ('.' . substr($clientExt, 0, 10)) : '';

    // 以真实文件内容判定类型，扩展名由服务端决定，避免上传 .php/.svg 等危险文件
    $info = jc_upload_type($tmp, $clientExt);
    if (!$info) {
        if ($cleanup) {
            @unlink($tmp);
        }
        return array(400, array('error' => '不支持的文件类型（仅支持图片与视频）'));
    }
    $kind = $info['kind'];
    $isVideo = $kind === 'video';

    $sub = date('Ym');
    $dir = JC_HTDOCS . '/uploads/' . $sub;
    if (!is_dir($dir)) {
        @mkdir($dir, 0777, true);
    }
    $filename = now_ms() . '_' . bin2hex(random_bytes(6)) . $info['ext'];
    // 视频统一追加 .dat 后缀：部分共享主机（如 InfinityFree）会按扩展名限制/清理视频文件，
    // 改由 /api/media 以正确的 Content-Type 输出，避免直接访问 .mp4 被拦截。
    if ($isVideo) {
        $filename .= '.dat';
    }
    $dest = $dir . '/' . $filename;
    $moved = $cleanup ? @rename($tmp, $dest) : @move_uploaded_file($tmp, $dest);
    if ($cleanup && is_file($tmp)) {
        @unlink($tmp);
    }
    if (!$moved) {
        return array(400, array('error' => '上传失败，请检查 uploads 目录是否可写'));
    }

    $rel = '/uploads/' . $sub . '/' . $filename;
    // 响应发送完成后再写数据库备份：大文件 base64 后的 INSERT 可能耗时 1~2 秒，
    // 放在请求体内会明显拖慢上传返回；shutdown 阶段执行，用户先拿到上传结果。
    // 即使之后部署包覆盖 uploads 目录或主机清理文件，/api/media 也能自动恢复。
    if (function_exists('jc_file_backup')) {
        register_shutdown_function('jc_file_backup', $rel);
    }

    return array(200, array(
        'url' => $rel,
        'thumb' => '',
        'kind' => $kind,
        'size' => $size,
        'mime' => $info['mime'],
    ));
}

route('POST', '#^/api/upload$#', function ($params, $body) {
    $uid = require_auth();
    // 防止刷上传占满空间/带宽：单用户每分钟最多 60 次
    // （一次上传可能经历 form → raw → 分片自动降级，次数要留足余量）
    jc_rate_limit('upload', 60, 60000, 'user:' . $uid);

    $up = jc_upload_input();
    if ($up === null) {
        return array(400, array('error' => '未收到文件'));
    }
    if (isset($up['error'])) {
        $err = (int) $up['error'];
        if ($err === UPLOAD_ERR_INI_SIZE || $err === UPLOAD_ERR_FORM_SIZE) {
            return array(400, array('error' => '文件过大，服务器允许的单文件上限为 ' . $up['limit']));
        }
        if ($err === UPLOAD_ERR_NO_FILE) {
            return array(400, array('error' => '未收到文件，可能是文件超过服务器 post_max_size=' . $up['limit']));
        }
        return array(400, array('error' => '上传失败'));
    }

    return jc_store_upload($up['tmp'], $up['name'], (int) $up['size'], !empty($up['cleanup']));
});

/**
 * 分片上传：POST /api/upload/chunk
 *   X-Upload-Id    会话 id（16~64 位十六进制，客户端随机生成）
 *   X-Chunk-Index  当前分片序号（从 0 开始）
 *   X-Chunk-Total  分片总数
 *   X-File-Name    原始文件名（URL 编码）
 *   body           该分片的原始二进制（建议 ≤ 1MB）
 * 用于视频等大文件：单片体积小，永远不会撞主机的单请求上限，
 * 所有分片到齐后由服务端合并、校验类型并落盘。
 */
route('POST', '#^/api/upload/chunk$#', function ($params, $body) {
    $uid = require_auth();
    // 分片数量多，单独放宽限流（按用户，每分钟 600 片 ≈ 450MB 上限）
    jc_rate_limit('upload_chunk', 600, 60000, 'user:' . $uid);

    $id = isset($_SERVER['HTTP_X_UPLOAD_ID']) ? strtolower(trim((string) $_SERVER['HTTP_X_UPLOAD_ID'])) : '';
    if (!preg_match('/^[a-f0-9]{16,64}$/', $id)) {
        return array(400, array('error' => '上传会话不合法'));
    }
    $index = isset($_SERVER['HTTP_X_CHUNK_INDEX']) ? (int) $_SERVER['HTTP_X_CHUNK_INDEX'] : -1;
    $total = isset($_SERVER['HTTP_X_CHUNK_TOTAL']) ? (int) $_SERVER['HTTP_X_CHUNK_TOTAL'] : 0;
    if ($index < 0 || $total <= 0 || $index >= $total || $total > 400) {
        return array(400, array('error' => '分片参数不合法'));
    }

    $dir = JC_HTDOCS . '/uploads/_chunks/' . $id;
    if (!is_dir($dir) && !@mkdir($dir, 0777, true)) {
        return array(400, array('error' => '上传失败：临时目录不可写'));
    }
    // 顺手清理 2 小时前的残留分片（用户中途取消上传会留下），避免占满空间
    if ($index === 0) {
        foreach ((array) @glob(JC_HTDOCS . '/uploads/_chunks/*', GLOB_ONLYDIR) as $old) {
            if ($old === $dir || !is_dir($old)) {
                continue;
            }
            if ((int) @filemtime($old) < time() - 7200) {
                foreach ((array) @glob($old . '/*') as $f) {
                    @unlink($f);
                }
                @rmdir($old);
            }
        }
    }
    $part = $dir . '/' . $index . '.part';
    $src = @fopen('php://input', 'rb');
    $dst = @fopen($part, 'wb');
    if (!$src || !$dst) {
        if ($src) { @fclose($src); }
        if ($dst) { @fclose($dst); }
        return array(400, array('error' => '上传失败：写入临时文件失败'));
    }
    $bytes = (int) @stream_copy_to_stream($src, $dst);
    @fclose($src);
    @fclose($dst);
    if ($bytes <= 0) {
        @unlink($part);
        return array(400, array('error' => '分片内容为空'));
    }

    // 统计已到达的分片数
    $have = 0;
    for ($i = 0; $i < $total; $i++) {
        if (is_file($dir . '/' . $i . '.part')) {
            $have++;
        }
    }
    if ($have < $total) {
        return array(200, array('ok' => true, 'done' => false, 'received' => $have, 'total' => $total));
    }

    // 全部分片到齐 → 合并
    $assembled = $dir . '/_assembled.tmp';
    $out = @fopen($assembled, 'wb');
    if (!$out) {
        return array(400, array('error' => '上传失败：无法合并分片'));
    }
    $size = 0;
    for ($i = 0; $i < $total; $i++) {
        $fp = @fopen($dir . '/' . $i . '.part', 'rb');
        if (!$fp) {
            @fclose($out);
            return array(400, array('error' => '上传失败：分片缺失'));
        }
        $size += (int) @stream_copy_to_stream($fp, $out);
        @fclose($fp);
    }
    @fclose($out);

    $name = isset($_SERVER['HTTP_X_FILE_NAME']) ? rawurldecode((string) $_SERVER['HTTP_X_FILE_NAME']) : '';
    $result = jc_store_upload($assembled, $name, $size, true);

    // 无论成功与否都清理分片目录，避免占用空间
    for ($i = 0; $i < $total; $i++) {
        @unlink($dir . '/' . $i . '.part');
    }
    @unlink($assembled);
    @rmdir($dir);
    @rmdir(dirname($dir));

    return $result;
});

/* ------------------------------- 媒体输出 -------------------------------
 * GET /api/media?f=YYYYMM/xxx.mp4.dat
 * 以正确的 MIME 输出 uploads 下的文件，支持 Range（视频拖动进度条必需）。
 * 视频文件在磁盘上以 .dat 结尾，避免个别主机按扩展名拦截 .mp4。
 */
route('GET', '#^/api/media$#', function ($params, $body) {
    $rel = isset($_GET['f']) ? (string) $_GET['f'] : '';
    $rel = str_replace('\\', '/', trim($rel));
    if ($rel === '' || strpos($rel, '..') !== false || substr($rel, 0, 1) === '/') {
        return array(400, array('error' => '参数不合法'));
    }
    $root = realpath(JC_HTDOCS . '/uploads');
    $full = realpath(JC_HTDOCS . '/uploads/' . $rel);
    $valid = $root && $full && strpos($full, $root . DIRECTORY_SEPARATOR) === 0 && is_file($full);
    if (!$valid) {
        // 文件可能被部署包覆盖或主机清理：尝试从数据库备份写回磁盘后继续正常输出
        if (jc_file_restore_to_disk('/uploads/' . $rel)) {
            $full = realpath(JC_HTDOCS . '/uploads/' . $rel);
            $valid = $full && $root && strpos($full, $root . DIRECTORY_SEPARATOR) === 0 && is_file($full);
        }
    }
    if (!$valid) {
        // 404 必须禁止缓存，否则浏览器会把「暂时缺失」永久记成失败，
        // 即使之后文件恢复也仍然显示加载失败。
        header('Cache-Control: no-store, no-cache, must-revalidate');
        return array(404, array('error' => '文件不存在或已被服务器清理'));
    }

    $size = (int) filesize($full);
    $mime = jc_media_mime($full);
    header('Content-Type: ' . $mime);
    header('Accept-Ranges: bytes');
    header('Cache-Control: public, max-age=604800');
    header('Access-Control-Allow-Origin: *');
    header('X-Content-Type-Options: nosniff');

    $start = 0;
    $end = $size > 0 ? $size - 1 : 0;
    $range = isset($_SERVER['HTTP_RANGE']) ? (string) $_SERVER['HTTP_RANGE'] : '';
    if ($range !== '' && preg_match('/bytes=(\d*)-(\d*)/', $range, $m)) {
        if ($m[1] === '' && $m[2] !== '') {
            $start = max(0, $size - (int) $m[2]);
        } else {
            $start = (int) $m[1];
            if ($m[2] !== '') {
                $end = min((int) $m[2], $size - 1);
            }
        }
        if ($size === 0 || $start > $end || $start >= $size) {
            http_response_code(416);
            header('Content-Range: bytes */' . $size);
            exit;
        }
        http_response_code(206);
        header('Content-Range: bytes ' . $start . '-' . $end . '/' . $size);
    }
    header('Content-Length: ' . ($size === 0 ? 0 : $end - $start + 1));
    @set_time_limit(0);
    // 关闭输出缓冲，边读边发：大视频不必一次性读进内存，也不会被主机缓冲截断
    while (ob_get_level() > 0) {
        @ob_end_flush();
    }

    $fp = @fopen($full, 'rb');
    if (!$fp) {
        http_response_code(404);
        exit;
    }
    if ($size > 0) {
        fseek($fp, $start);
        $left = $end - $start + 1;
        while ($left > 0 && !feof($fp)) {
            $chunk = fread($fp, min(65536, $left));
            if ($chunk === false || $chunk === '') {
                break;
            }
            echo $chunk;
            $left -= strlen($chunk);
            @flush();
        }
    }
    fclose($fp);
    exit;
});

/** 根据扩展名推断 MIME（.dat 时取前一段扩展名，例如 xxx.mp4.dat → mp4） */
function jc_media_mime($path)
{
    $name = strtolower((string) $path);
    if (substr($name, -4) === '.dat') {
        $name = substr($name, 0, -4);
    }
    $ext = (string) pathinfo($name, PATHINFO_EXTENSION);
    $map = array(
        'mp4' => 'video/mp4', 'm4v' => 'video/mp4', 'mov' => 'video/quicktime',
        'webm' => 'video/webm', 'ogv' => 'video/ogg', 'avi' => 'video/x-msvideo',
        'mkv' => 'video/x-matroska', '3gp' => 'video/3gpp', 'flv' => 'video/x-flv',
        'wmv' => 'video/x-ms-wmv', 'mpeg' => 'video/mpeg', 'mpg' => 'video/mpeg',
        'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png',
        'gif' => 'image/gif', 'webp' => 'image/webp', 'bmp' => 'image/bmp',
        'svg' => 'image/svg+xml',
    );
    return isset($map[$ext]) ? $map[$ext] : 'application/octet-stream';
}

/* ------------------------------- 会话列表 ------------------------------- */

route('GET', '#^/api/conversations$#', function ($params, $body) {
    $uid = require_auth();
    $blocked = array();
    foreach (blocked_ids($uid) as $b) {
        $blocked[(int) $b] = true;
    }

    $pinnedRows = db_all('SELECT `conv_type`, `conv_id`, `created_at` FROM `conversation_pins` WHERE `user_id` = ?', array($uid));
    $pinnedMap = array();
    foreach ($pinnedRows as $r) {
        $pinnedMap[$r['conv_type'] . '_' . $r['conv_id']] = (int) $r['created_at'];
    }
    $pinnedAt = function ($ct, $ci) use ($pinnedMap) {
        $k = $ct . '_' . $ci;
        return isset($pinnedMap[$k]) ? $pinnedMap[$k] : 0;
    };

    $list = array();

    // 群聊
    $groups = db_all('SELECT g.*, m.`dnd` FROM `group_members` m JOIN `groups` g ON g.`id` = m.`group_id` WHERE m.`user_id` = ?', array($uid));
    foreach ($groups as $g) {
        $cid = (string) $g['id'];
        $lm = last_message('group', $cid, $uid);
        $members = group_members($g['id']);
        $online = 0;
        foreach ($members as $m) {
            if (is_online((int) $m['user_id'])) {
                $online++;
            }
        }
        $lastTime = $lm ? (int) $lm['created_at'] : (int) $g['created_at'];
        $list[] = array(
            'key' => 'group_' . $cid,
            'conv_type' => 'group',
            'conv_id' => $cid,
            'name' => (string) $g['name'],
            'avatar' => isset($g['avatar']) ? (string) $g['avatar'] : '',
            'is_official' => !empty($g['is_official']),
            'dissolved' => !empty($g['dissolved']),
            'dnd' => !empty($g['dnd']),
            'member_count' => count($members),
            'online_count' => $online,
            'unread' => unread_count('group', $cid, $uid),
            'mention' => mention_unread_count('group', $cid, $uid),
            'last' => $lm ? preview_of($lm) : null,
            'last_time' => $lastTime,
            'sort_time' => $lastTime,
            'pinned' => $pinnedAt('group', $cid),
        );
    }

    // 私聊（好友）
    $friends = db_all('SELECT u.*, f.`remark` FROM `friendships` f JOIN `users` u ON u.`id` = f.`friend_id` WHERE f.`user_id` = ?', array($uid));
    $seen = array();
    foreach ($friends as $f) {
        if (isset($blocked[(int) $f['id']])) {
            continue;
        }
        $cid = dm_conv_id($uid, $f['id']);
        $seen[$cid] = true;
        $lm = last_message('dm', $cid, $uid);
        $dndRow = db_one('SELECT `dnd` FROM `dm_dnd` WHERE `user_id` = ? AND `peer_id` = ?', array($uid, (int) $f['id']));
        $list[] = array(
            'key' => 'dm_' . $cid,
            'conv_type' => 'dm',
            'conv_id' => $cid,
            'name' => (isset($f['remark']) && $f['remark']) ? $f['remark'] : (string) $f['username'],
            'avatar' => isset($f['avatar']) ? (string) $f['avatar'] : '',
            'is_official' => !empty($f['is_official']),
            'peer' => public_user($f),
            'online' => is_online((int) $f['id']),
            'dnd' => ($dndRow && !empty($dndRow['dnd'])),
            'unread' => unread_count('dm', $cid, $uid),
            'last' => $lm ? preview_of($lm) : null,
            'last_time' => $lm ? (int) $lm['created_at'] : 0,
            'sort_time' => $lm ? (int) $lm['created_at'] : 0,
            'pinned' => $pinnedAt('dm', $cid),
        );
    }

    // 历史私聊但已非好友
    $dmRows = db_all(
        "SELECT DISTINCT `conv_id` FROM `messages` WHERE `conv_type` = 'dm' AND (`conv_id` LIKE ? OR `conv_id` LIKE ?)",
        array('%_' . $uid, $uid . '_%')
    );
    foreach ($dmRows as $r) {
        $convId = $r['conv_id'];
        if (isset($seen[$convId])) {
            continue;
        }
        $parts = explode('_', $convId);
        $peerId = 0;
        foreach ($parts as $x) {
            if ((int) $x !== (int) $uid) {
                $peerId = (int) $x;
                break;
            }
        }
        if (isset($blocked[$peerId])) {
            continue;
        }
        $peer = get_user($peerId);
        if (!$peer) {
            continue;
        }
        $lm = last_message('dm', $convId, $uid);
        $list[] = array(
            'key' => 'dm_' . $convId,
            'conv_type' => 'dm',
            'conv_id' => (string) $convId,
            'name' => (string) $peer['username'],
            'avatar' => isset($peer['avatar']) ? (string) $peer['avatar'] : '',
            'peer' => public_user($peer),
            'online' => is_online($peerId),
            'dnd' => false,
            'unread' => unread_count('dm', $convId, $uid),
            'last' => $lm ? preview_of($lm) : null,
            'last_time' => $lm ? (int) $lm['created_at'] : 0,
            'sort_time' => $lm ? (int) $lm['created_at'] : 0,
            'pinned' => $pinnedAt('dm', $convId),
        );
    }

    usort($list, function ($a, $b) {
        if ($a['pinned'] !== $b['pinned']) {
            return $b['pinned'] - $a['pinned'];
        }
        return $b['sort_time'] - $a['sort_time'];
    });

    $totalUnread = 0;
    foreach ($list as $c) {
        $totalUnread += (int) $c['unread'];
    }

    $grp = db_one('SELECT `id` FROM `groups` WHERE `is_official` = 1');
    return array(200, array(
        'conversations' => $list,
        'total_unread' => $totalUnread,
        'official_group_id' => $grp ? (int) $grp['id'] : 0,
    ));
});

/* ------------------------------- 会话置顶 ------------------------------- */

route('PATCH', '#^/api/conversations/pin$#', function ($params, $body) {
    $uid = require_auth();
    $convType = isset($body['convType']) ? (string) $body['convType'] : '';
    $convId = isset($body['convId']) ? (string) $body['convId'] : '';
    $pinned = !empty($body['pinned']) ? 1 : 0;
    if (($convType !== 'dm' && $convType !== 'group') || $convId === '') {
        return array(400, array('error' => '参数不合法'));
    }
    if (!check_access($uid, $convType, $convId)) {
        return array(403, array('error' => '无权操作该会话'));
    }
    if ($pinned) {
        $ex = db_one('SELECT 1 FROM `conversation_pins` WHERE `user_id` = ? AND `conv_type` = ? AND `conv_id` = ?', array($uid, $convType, $convId));
        if ($ex) {
            db_run('UPDATE `conversation_pins` SET `created_at` = ? WHERE `user_id` = ? AND `conv_type` = ? AND `conv_id` = ?', array(now_ms(), $uid, $convType, $convId));
        } else {
            db_run('INSERT INTO `conversation_pins` (`user_id`, `conv_type`, `conv_id`, `created_at`) VALUES (?, ?, ?, ?)', array($uid, $convType, $convId, now_ms()));
        }
    } else {
        db_run('DELETE FROM `conversation_pins` WHERE `user_id` = ? AND `conv_type` = ? AND `conv_id` = ?', array($uid, $convType, $convId));
    }
    return array(200, array('ok' => true, 'pinned' => (bool) $pinned));
});

/* ------------------------------- 消息历史 ------------------------------- */

route('GET', '#^/api/messages$#', function ($params, $body) {
    $uid = require_auth();
    $convType = isset($_GET['convType']) ? (string) $_GET['convType'] : 'dm';
    $convId = isset($_GET['convId']) ? (string) $_GET['convId'] : '';
    if ($convId === '') {
        return array(400, array('error' => '缺少会话 ID'));
    }
    if (!check_access($uid, $convType, $convId)) {
        return array(403, array('error' => '无权访问该会话'));
    }
    $before = isset($_GET['before']) ? (int) $_GET['before'] : 0;
    $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 60;
    if ($limit > 200) {
        $limit = 200;
    }
    if ($limit < 1) {
        $limit = 1;
    }
    if ($before) {
        $rows = db_all(
            'SELECT * FROM `messages` WHERE `conv_type` = ? AND `conv_id` = ? AND `id` < ?
             AND `id` NOT IN (SELECT `message_id` FROM `message_hides` WHERE `user_id` = ?)
             ORDER BY `id` DESC LIMIT ' . (int) $limit,
            array($convType, $convId, $before, $uid)
        );
    } else {
        $rows = db_all(
            'SELECT * FROM `messages` WHERE `conv_type` = ? AND `conv_id` = ?
             AND `id` NOT IN (SELECT `message_id` FROM `message_hides` WHERE `user_id` = ?)
             ORDER BY `id` DESC LIMIT ' . (int) $limit,
            array($convType, $convId, $uid)
        );
    }
    $rows = array_reverse($rows);

    $list = array();
    $readIds = array();
    foreach ($rows as $m) {
        if (!empty($m['one_time']) && (int) $m['sender_id'] !== (int) $uid && is_burned((int) $m['id'], $uid)) {
            continue;
        }
        $list[] = build_message($m);
        if ((int) $m['sender_id'] !== (int) $uid) {
            $readIds[] = (int) $m['id'];
        }
    }
    $markRead = isset($_GET['markRead']) ? (string) $_GET['markRead'] : 'true';
    if ($markRead !== 'false') {
        mark_read_bulk($uid, $readIds, $convType, $convId);
    }
    return array(200, array('messages' => $list, 'has_more' => count($rows) >= $limit));
});

/* ------------------------------- 发送消息 ------------------------------- */

route('POST', '#^/api/messages$#', function ($params, $body) {
    $uid = require_auth();
    // 防刷屏/灌水：单用户每分钟最多 60 条消息
    jc_rate_limit('message_send', 60, 60000, 'user:' . $uid);
    $convType = isset($body['convType']) ? $body['convType'] : null;
    $convId = isset($body['convId']) ? $body['convId'] : null;
    $msgType = isset($body['msg_type']) && $body['msg_type'] !== '' ? $body['msg_type'] : 'text';
    $content = isset($body['content']) ? $body['content'] : '';
    $mediaUrl = isset($body['media_url']) ? $body['media_url'] : '';
    $mediaThumb = isset($body['media_thumb']) ? $body['media_thumb'] : '';
    $oneTime = !empty($body['one_time']);
    $burnSec = isset($body['burn_sec']) ? $body['burn_sec'] : 0;
    $clientId = isset($body['clientId']) ? $body['clientId'] : null;
    $replyTo = isset($body['reply_to']) ? (int) $body['reply_to'] : 0;

    // 封禁 / 全站禁言拦截
    $blockReason = jc_send_block_reason(get_user($uid));
    if ($blockReason !== null) {
        return array(403, array('error' => $blockReason));
    }

    if ($convType === 'dm') {
        $peer = 0;
        foreach (explode('_', (string) $convId) as $x) {
            if ((int) $x !== (int) $uid) {
                $peer = (int) $x;
                break;
            }
        }
        if (blocked_either($uid, $peer)) {
            return array(403, array('error' => '你与对方已互相拉黑，无法发送消息'));
        }
    }
    if (!check_access($uid, $convType, $convId)) {
        return array(403, array('error' => '无权在该会话发送消息'));
    }

    if ($convType === 'group') {
        $gid = (int) $convId;
        $grp = db_one('SELECT `dissolved` FROM `groups` WHERE `id` = ?', array($gid));
        if ($grp && !empty($grp['dissolved'])) {
            return array(403, array('error' => '该群聊已解散，无法发送消息'));
        }
        $me = db_one('SELECT `mute_until` FROM `group_members` WHERE `group_id` = ? AND `user_id` = ?', array($gid, $uid));
        if ($me && (int) $me['mute_until'] && (int) $me['mute_until'] > now_ms()) {
            return array(403, array('error' => '你已被禁言，剩余 ' . (int) ceil(((int) $me['mute_until'] - now_ms()) / 1000) . ' 秒'));
        }
    }

    if ($msgType === 'text' && trim((string) $content) === '') {
        return array(400, array('error' => '消息不能为空'));
    }
    if ($msgType === 'sticker' && trim((string) $content) === '' && !$mediaUrl) {
        return array(400, array('error' => '表情不能为空'));
    }
    // 合并转发的聊天记录：content 是 JSON 数组（每条含 senderName/msg_type/content/media_url/created_at）
    if ($msgType === 'forward') {
        $fj = json_decode((string) $content, true);
        if (!is_array($fj) || empty($fj)) {
            return array(400, array('error' => '聊天记录内容不合法'));
        }
        if (count($fj) > 50) {
            return array(400, array('error' => '单次最多合并转发 50 条消息'));
        }
        if (strlen((string) $content) > 60000) {
            return array(400, array('error' => '聊天记录过大，请减少选择条数'));
        }
    } elseif ($msgType !== 'text' && $msgType !== 'sticker' && !$mediaUrl) {
        return array(400, array('error' => '缺少媒体文件'));
    }

    // 引用回复：拼装被引用消息摘要，写入 extra.reply
    $extra = array();
    if ($clientId !== null && $clientId !== '') {
        $extra['client_id'] = $clientId;
    }
    if ($replyTo > 0) {
        $rm = db_one('SELECT * FROM `messages` WHERE `id` = ?', array($replyTo));
        if ($rm && (string) $rm['conv_type'] === (string) $convType && (string) $rm['conv_id'] === (string) $convId) {
            if ((int) $rm['sender_id'] === 0) {
                $rname = jc_ai_public()['name'];
            } else {
                $rpu = public_user(get_user($rm['sender_id']));
                $rname = $rpu ? $rpu['username'] : '用户';
            }
            if (!empty($rm['recalled'])) {
                $rtext = '该消息已撤回';
            } elseif ($rm['msg_type'] === 'image') {
                $rtext = '[图片]';
            } elseif ($rm['msg_type'] === 'video') {
                $rtext = '[视频]';
            } elseif ($rm['msg_type'] === 'sticker') {
                $rtext = '[动画表情]';
            } else {
                $rtext = (string) $rm['content'];
            }
            $extra['reply'] = array(
                'id' => $replyTo,
                'name' => $rname,
                'text' => mb_substr($rtext, 0, 80, 'UTF-8'),
            );
        }
    }

    $burn = 5;
    if ($oneTime) {
        $b = (int) $burnSec;
        if ($b < 1) {
            $b = 5;
        }
        if ($b > 300) {
            $b = 300;
        }
        $burn = $b;
    }
    $id = db_insert(
        'INSERT INTO `messages` (`conv_type`, `conv_id`, `sender_id`, `msg_type`, `content`, `media_url`, `media_thumb`, `one_time`, `burn_sec`, `recalled`, `extra`, `created_at`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)',
        array(
            (string) $convType,
            (string) $convId,
            $uid,
            (string) $msgType,
            // 合并转发是序列化 JSON，放宽到 60000；普通消息仍截断 2000
            mb_substr((string) $content, 0, $msgType === 'forward' ? 60000 : 2000, 'UTF-8'),
            (string) $mediaUrl,
            (string) $mediaThumb,
            $oneTime ? 1 : 0,
            $burn,
            empty($extra) ? '' : jc_json($extra),
            now_ms(),
        )
    );
    $row = db_one('SELECT * FROM `messages` WHERE `id` = ?', array($id));
    db_exec_ignore('INSERT INTO `message_reads` (`message_id`, `user_id`, `read_at`) VALUES (?, ?, ?)', array($id, $uid, now_ms()));

    $msg = build_message($row);
    // 群聊 @ 提醒：被 @ 的成员会在通知里收到「有人 @ 了你」
    if ($convType === 'group' && $msgType === 'text') {
        jc_notify_group_mentions((int) $convId, $uid, (string) $content, (int) $id);
    }
    event_to_conversation($convType, $convId, 'message', $msg);
    return array(200, array('message' => $msg));
});

/* ------------------------------- 已读回执 ------------------------------- */

route('POST', '#^/api/messages/(\d+)/read$#', function ($params, $body) {
    $uid = require_auth();
    $id = (int) $params[0];
    $m = db_one('SELECT * FROM `messages` WHERE `id` = ?', array($id));
    if (!$m) {
        return array(404, array('error' => '消息不存在'));
    }
    if (!check_access($uid, $m['conv_type'], $m['conv_id'])) {
        return array(403, array('error' => '无权操作'));
    }
    mark_read_bulk($uid, array($id), $m['conv_type'], $m['conv_id']);
    $c = (int) db_value('SELECT COUNT(*) FROM `message_reads` WHERE `message_id` = ?', array($id));
    return array(200, array('ok' => true, 'read_count' => $c));
});

/* -------------------------------- 撤回 -------------------------------- */

route('POST', '#^/api/messages/(\d+)/recall$#', function ($params, $body) {
    $uid = require_auth();
    $id = (int) $params[0];
    $m = db_one('SELECT * FROM `messages` WHERE `id` = ?', array($id));
    if (!$m) {
        return array(404, array('error' => '消息不存在'));
    }
    $senderSelf = (int) $m['sender_id'] === (int) $uid;
    // 群主撤回群内消息（自己的或群员的）都不受 3 分钟限制；私聊和普通成员仍有 3 分钟限制
    $isGroupMsg = (string) $m['conv_type'] === 'group';
    $isOwner = $isGroupMsg ? member_role((int) $m['conv_id'], $uid) === 'owner' : false;
    if (!$senderSelf && !($isOwner && (int) $m['sender_id'] !== 0)) {
        return array(403, array('error' => '只能撤回自己发送的消息'));
    }
    if (!$isOwner && now_ms() - (int) $m['created_at'] > JC_RECALL_WINDOW) {
        return array(400, array('error' => '超过 3 分钟的消息不能撤回'));
    }
    // 原文留档（仅管理员后台「聊天记录」可查看，普通客户端仍只看到「该消息已撤回」）
    db_exec_ignore(
        'INSERT INTO `message_recalled` (`message_id`, `conv_type`, `conv_id`, `sender_id`, `msg_type`, `content`, `media_url`, `media_thumb`, `extra`, `created_at`, `recalled_at`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        array(
            $id,
            (string) $m['conv_type'],
            (string) $m['conv_id'],
            (int) $m['sender_id'],
            (string) $m['msg_type'],
            (string) $m['content'],
            (string) $m['media_url'],
            (string) $m['media_thumb'],
            (string) $m['extra'],
            (int) $m['created_at'],
            now_ms(),
        )
    );
    db_run('UPDATE `messages` SET `recalled` = 1, `content` = ?, `media_url` = ?, `media_thumb` = ? WHERE `id` = ?', array('', '', '', $id));
    event_to_conversation($m['conv_type'], $m['conv_id'], 'message:recall', array(
        'id' => $id,
        'convType' => (string) $m['conv_type'],
        'convId' => (string) $m['conv_id'],
        'senderId' => (int) $m['sender_id'],
    ));
    return array(200, array('ok' => true));
});

/* --------------------------- 多选删除（仅隐藏自己的视图） --------------------------- */

route('POST', '#^/api/messages/hide$#', function ($params, $body) {
    $uid = require_auth();
    $ids = array();
    if (isset($body['ids']) && is_array($body['ids'])) {
        foreach ($body['ids'] as $v) {
            $n = (int) $v;
            if ($n > 0) {
                $ids[] = $n;
            }
        }
    }
    $ids = array_values(array_unique($ids));
    if (empty($ids)) {
        return array(400, array('error' => '未选择消息'));
    }
    if (count($ids) > 100) {
        return array(400, array('error' => '一次最多删除 100 条'));
    }
    // 只允许隐藏自己有权访问的会话里的消息
    foreach ($ids as $id) {
        $m = db_one('SELECT `conv_type`, `conv_id` FROM `messages` WHERE `id` = ?', array($id));
        if ($m && check_access($uid, $m['conv_type'], $m['conv_id'])) {
            db_exec_ignore(
                'INSERT INTO `message_hides` (`message_id`, `user_id`, `hidden_at`) VALUES (?, ?, ?)',
                array($id, $uid, now_ms())
            );
        }
    }
    return array(200, array('ok' => true, 'count' => count($ids)));
});

/* ---------------------------- 一次性查看销毁 ---------------------------- */

route('POST', '#^/api/messages/(\d+)/burn$#', function ($params, $body) {
    $uid = require_auth();
    $id = (int) $params[0];
    $m = db_one('SELECT * FROM `messages` WHERE `id` = ?', array($id));
    if (!$m) {
        return array(404, array('error' => '消息不存在'));
    }
    if (empty($m['one_time'])) {
        return array(400, array('error' => '该消息不是一次性消息'));
    }
    if ((int) $m['sender_id'] === (int) $uid) {
        return array(400, array('error' => '发送者不会销毁'));
    }
    if (!check_access($uid, $m['conv_type'], $m['conv_id'])) {
        return array(403, array('error' => '无权操作'));
    }
    db_exec_ignore('INSERT INTO `message_burns` (`message_id`, `user_id`, `burned_at`) VALUES (?, ?, ?)', array($id, $uid, now_ms()));
    event_to_conversation($m['conv_type'], $m['conv_id'], 'message:burn', array(
        'id' => $id,
        'userId' => $uid,
        'convType' => (string) $m['conv_type'],
        'convId' => (string) $m['conv_id'],
    ));
    return array(200, array('ok' => true));
});

/* ---------------------------- 私聊免打扰 ---------------------------- */

route('PATCH', '#^/api/dm-dnd$#', function ($params, $body) {
    $uid = require_auth();
    $peer = isset($body['peerId']) ? (int) $body['peerId'] : 0;
    if (!$peer) {
        return array(400, array('error' => '参数错误'));
    }
    $dnd = !empty($body['dnd']) ? 1 : 0;
    $ex = db_one('SELECT 1 FROM `dm_dnd` WHERE `user_id` = ? AND `peer_id` = ?', array($uid, $peer));
    if ($ex) {
        db_run('UPDATE `dm_dnd` SET `dnd` = ? WHERE `user_id` = ? AND `peer_id` = ?', array($dnd, $uid, $peer));
    } else {
        db_run('INSERT INTO `dm_dnd` (`user_id`, `peer_id`, `dnd`) VALUES (?, ?, ?)', array($uid, $peer, $dnd));
    }
    return array(200, array('ok' => true, 'dnd' => (bool) $dnd));
});
