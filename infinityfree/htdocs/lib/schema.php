<?php
/**
 * 数据库表定义（单一声明源，按驱动生成 DDL）
 *
 * 列定义：[ name, kind, extras ]
 *   kind:   pk | int | bigint | str | str:N | text
 *   extras: 以空格分隔的标记
 *           notnull    NOT NULL
 *           unique     列级 UNIQUE
 *           auto       自增（仅限单个 pk 列）
 *           default:V  默认值（V 为空串表示 DEFAULT ''；纯数字不加引号）
 *
 * 表名/列名与 Node 版 SQLite schema 完全一致（db.js），便于对照。
 * 为保证 MySQL 也能跑：短字符串统一用 VARCHAR(n)（TEXT 列在 MySQL 不支持 DEFAULT ''），
 * 长文本/JSON 用 TEXT（应用层保证写入值）。
 */

function jc_schema_tables()
{
    return array(
        'users' => array(
            'cols' => array(
                array('id', 'pk', 'auto'),
                array('username', 'str:64', 'notnull unique'),
                array('email', 'str:128', 'notnull unique'),
                array('pwd', 'str:255', 'notnull'),
                // 头像可能是上传图片 URL，也可能是预设头像的 data URI（约 800 字符），需大于 255
                array('avatar', 'str:2000', 'default:'),
                array('bio', 'str:255', 'default:'),
                array('is_official', 'int', 'default:0'),
                array('online', 'int', 'default:0'),
                array('last_seen', 'bigint', 'default:0'),
                array('last_poll', 'bigint', 'default:0'),
                array('name_week', 'str:16', 'default:'),
                array('name_count', 'int', 'default:0'),
                // 角色：user | admin（管理员可在「我的 → 管理员后台」管理全站）
                array('role', 'str:16', 'default:user'),
                // 封禁：banned=1 时禁止登录；banned_until=0 表示永久封禁
                array('banned', 'int', 'default:0'),
                array('banned_until', 'bigint', 'default:0'),
                // 全站禁言：muted_until>now 时禁止在任何会话发消息
                array('muted_until', 'bigint', 'default:0'),
                // 最近一次访问的真实 IP / 时间 / UA（管理后台「用户IP」实时展示）
                array('last_ip', 'str:64', 'default:'),
                array('last_ip_at', 'bigint', 'default:0'),
                array('last_ua', 'str:190', 'default:'),
                array('created_at', 'bigint', 'notnull'),
            ),
        ),
        'verify_codes' => array(
            'cols' => array(
                array('id', 'pk', 'auto'),
                array('email', 'str:128', 'notnull'),
                array('code', 'str:16', 'notnull'),
                array('purpose', 'str:32', 'notnull'),
                array('expires_at', 'bigint', 'notnull'),
                array('used', 'int', 'default:0'),
                array('created_at', 'bigint', 'notnull'),
            ),
        ),
        'friendships' => array(
            'cols' => array(
                array('user_id', 'int', 'notnull'),
                array('friend_id', 'int', 'notnull'),
                array('remark', 'str:64', 'default:'),
                array('created_at', 'bigint', 'notnull'),
            ),
            'pk' => array('user_id', 'friend_id'),
        ),
        'friend_requests' => array(
            'cols' => array(
                array('id', 'pk', 'auto'),
                array('from_id', 'int', 'notnull'),
                array('to_id', 'int', 'notnull'),
                array('message', 'str:255', 'default:'),
                array('status', 'str:16', 'default:pending'),
                array('created_at', 'bigint', 'notnull'),
            ),
        ),
        'groups' => array( // MySQL 8 中 GROUPS 为保留字，生成时统一加反引号
            'cols' => array(
                array('id', 'pk', 'auto'),
                array('name', 'str:64', 'notnull'),
                // 头像可能是上传图片 URL，也可能是预设头像的 data URI（约 800 字符），需大于 255
                array('avatar', 'str:2000', 'default:'),
                array('owner_id', 'int', 'notnull'),
                array('announcement', 'str:255', 'default:'),
                array('is_official', 'int', 'default:0'),
                // 解散标记：1=已解散（会话与历史消息保留，仅禁止发送新消息）
                array('dissolved', 'int', 'default:0'),
                array('im_groupid', 'str:64', 'default:'),
                array('created_at', 'bigint', 'notnull'),
            ),
        ),
        'group_members' => array(
            'cols' => array(
                array('group_id', 'int', 'notnull'),
                array('user_id', 'int', 'notnull'),
                array('role', 'str:16', 'default:member'),
                array('mute_until', 'bigint', 'default:0'),
                array('dnd', 'int', 'default:0'),
                array('joined_at', 'bigint', 'notnull'),
            ),
            'pk' => array('group_id', 'user_id'),
        ),
        // 入群申请（群主 / 管理员在通知里同意或拒绝）
        'group_join_requests' => array(
            'cols' => array(
                array('id', 'pk', 'auto'),
                array('group_id', 'int', 'notnull'),
                array('user_id', 'int', 'notnull'),
                array('message', 'str:255', 'default:'),
                // pending | accepted | rejected
                array('status', 'str:16', 'default:pending'),
                array('handled_by', 'int', 'default:0'),
                array('created_at', 'bigint', 'notnull'),
                array('handled_at', 'bigint', 'default:0'),
            ),
        ),
        'messages' => array(
            'cols' => array(
                array('id', 'pk', 'auto'),
                array('conv_type', 'str:16', 'notnull'),
                array('conv_id', 'str:100', 'notnull'),
                array('sender_id', 'int', 'notnull'),
                array('msg_type', 'str:16', 'default:text'),
                // 合并转发的聊天记录以 JSON 存放，VARCHAR(2000) 不够，扩为 TEXT
                array('content', 'text', 'default:'),
                array('media_url', 'str:1000', 'default:'),
                array('media_thumb', 'str:1000', 'default:'),
                array('one_time', 'int', 'default:0'),
                array('burn_sec', 'int', 'default:5'),
                array('recalled', 'int', 'default:0'),
                array('extra', 'str:2000', 'default:'),
                array('created_at', 'bigint', 'notnull'),
            ),
        ),
        'message_reads' => array(
            'cols' => array(
                array('message_id', 'int', 'notnull'),
                array('user_id', 'int', 'notnull'),
                array('read_at', 'bigint', 'notnull'),
            ),
            'pk' => array('message_id', 'user_id'),
        ),
        // 「删除」聊天记录：仅从自己的视图隐藏，不影响对方（等价微信/QQ 的删除）
        'message_hides' => array(
            'cols' => array(
                array('message_id', 'int', 'notnull'),
                array('user_id', 'int', 'notnull'),
                array('hidden_at', 'bigint', 'notnull'),
            ),
            'pk' => array('user_id', 'message_id'),
        ),
        // 撤回消息原文留存（仅管理员后台「聊天记录」可查看；对普通客户端不下发）
        'message_recalled' => array(
            'cols' => array(
                array('message_id', 'pk'),
                array('conv_type', 'str:16', 'notnull'),
                array('conv_id', 'str:100', 'notnull'),
                array('sender_id', 'int', 'notnull'),
                array('msg_type', 'str:16', 'default:text'),
                array('content', 'str:2000', 'default:'),
                array('media_url', 'str:1000', 'default:'),
                array('media_thumb', 'str:1000', 'default:'),
                array('extra', 'str:2000', 'default:'),
                array('created_at', 'bigint', 'notnull'),
                array('recalled_at', 'bigint', 'notnull'),
            ),
        ),
        'message_burns' => array(
            'cols' => array(
                array('message_id', 'int', 'notnull'),
                array('user_id', 'int', 'notnull'),
                array('burned_at', 'bigint', 'notnull'),
            ),
            'pk' => array('message_id', 'user_id'),
        ),
        'moments' => array(
            'cols' => array(
                array('id', 'pk', 'auto'),
                array('author_id', 'int', 'notnull'),
                array('text', 'str:1000', 'default:'),
                array('media', 'str:4000', 'default:[]'),
                array('visibility', 'str:16', 'default:public'),
                array('allow_ids', 'str:2000', 'default:[]'),
                array('deny_ids', 'str:2000', 'default:[]'),
                array('deleted', 'int', 'default:0'),
                array('created_at', 'bigint', 'notnull'),
            ),
        ),
        'moment_likes' => array(
            'cols' => array(
                array('moment_id', 'int', 'notnull'),
                array('user_id', 'int', 'notnull'),
                array('created_at', 'bigint', 'notnull'),
            ),
            'pk' => array('moment_id', 'user_id'),
        ),
        'moment_comments' => array(
            'cols' => array(
                array('id', 'pk', 'auto'),
                array('moment_id', 'int', 'notnull'),
                array('user_id', 'int', 'notnull'),
                array('content', 'str:500', 'default:'),
                // 评论类型：text | image | video | sticker（支持图片/视频/表情/动画表情包）
                array('msg_type', 'str:16', 'default:text'),
                array('media_url', 'str:1000', 'default:'),
                array('media_thumb', 'str:1000', 'default:'),
                array('reply_to_user', 'int', 'default:0'),
                array('deleted', 'int', 'default:0'),
                array('created_at', 'bigint', 'notnull'),
            ),
        ),
        'dm_dnd' => array(
            'cols' => array(
                array('user_id', 'int', 'notnull'),
                array('peer_id', 'int', 'notnull'),
                array('dnd', 'int', 'default:0'),
            ),
            'pk' => array('user_id', 'peer_id'),
        ),
        'conversation_pins' => array(
            'cols' => array(
                array('user_id', 'int', 'notnull'),
                array('conv_type', 'str:16', 'notnull'),
                array('conv_id', 'str:100', 'notnull'),
                array('created_at', 'bigint', 'notnull'),
            ),
            'pk' => array('user_id', 'conv_type', 'conv_id'),
        ),
        'blocks' => array(
            'cols' => array(
                array('user_id', 'int', 'notnull'),
                array('blocked_id', 'int', 'notnull'),
                array('created_at', 'bigint', 'notnull'),
            ),
            'pk' => array('user_id', 'blocked_id'),
        ),
        'notifications' => array(
            'cols' => array(
                array('id', 'pk', 'auto'),
                array('user_id', 'int', 'notnull'),
                array('type', 'str:32', 'notnull'),
                array('actor_id', 'int', 'default:0'),
                array('text', 'str:500', 'default:'),
                array('ref_type', 'str:32', 'default:'),
                array('ref_id', 'int', 'default:0'),
                array('read', 'int', 'default:0'),
                array('created_at', 'bigint', 'notnull'),
            ),
        ),
        // 轮询事件表（替代 WebSocket 推送）
        'events' => array(
            'cols' => array(
                array('id', 'pk', 'auto'),
                array('user_id', 'int', 'notnull'),
                array('type', 'str:64', 'notnull'),
                array('data', 'text', 'notnull'),
                array('created_at', 'bigint', 'notnull'),
            ),
        ),
        // 应用设置（管理员后台写入：AI 配置等）
        'app_settings' => array(
            'cols' => array(
                array('name', 'str:64', 'notnull'),
                array('value', 'str:1000', 'default:'),
            ),
            'pk' => array('name'),
        ),
        // 我的添加（用户收藏的动画表情包）
        'sticker_favs' => array(
            'cols' => array(
                array('user_id', 'int', 'notnull'),
                // 表情地址的 md5（作为联合主键的一部分，避免超长索引）
                array('ukey', 'str:64', 'notnull'),
                array('url', 'str:1000', 'default:'),
                array('label', 'str:128', 'default:'),
                array('added_at', 'bigint', 'notnull'),
            ),
            'pk' => array('user_id', 'ukey'),
        ),
        // IP 访问记录（按 IP + 用户聚合，用于后台查看真实 IP）
        'ip_records' => array(
            'cols' => array(
                array('ip', 'str:64', 'notnull'),
                array('user_id', 'int', 'default:0'),
                array('hits', 'int', 'default:0'),
                array('first_seen', 'bigint', 'notnull'),
                array('last_seen', 'bigint', 'notnull'),
                array('last_path', 'str:190', 'default:'),
                array('ua', 'str:190', 'default:'),
            ),
            'pk' => array('ip', 'user_id'),
        ),
        // IP 黑名单（until=0 永久封禁）
        'ip_blocks' => array(
            'cols' => array(
                array('ip', 'str:64', 'notnull'),
                array('reason', 'str:190', 'default:'),
                array('until', 'bigint', 'default:0'),
                array('created_by', 'int', 'default:0'),
                array('created_at', 'bigint', 'notnull'),
            ),
            'pk' => array('ip'),
        ),
        // 接口限流计数（固定窗口）
        'rate_limits' => array(
            'cols' => array(
                array('k', 'str:190', 'notnull'),
                array('hits', 'int', 'default:0'),
                array('window_start', 'bigint', 'notnull'),
            ),
            'pk' => array('k'),
        ),
        // 头像文件备份：升级覆盖 uploads 后可从数据库自动恢复用户/群/AI 头像
        'avatar_files' => array(
            'cols' => array(
                array('url', 'str:255', 'notnull'),
                array('mime', 'str:64', 'default:image/jpeg'),
                array('data', 'mediumtext', 'notnull'),
                array('created_at', 'bigint', 'notnull'),
            ),
            'pk' => array('url'),
        ),
        // 安装标记表
        'jc_meta' => array(
            'cols' => array(
                array('name', 'str:64', 'notnull'),
                array('value', 'str:255', 'default:'),
            ),
            'pk' => array('name'),
        ),
    );
}

/** kind → 驱动相关类型 */
function jc_col_type($kind, $driver)
{
    if ($kind === 'pk') {
        return $driver === 'sqlite' ? 'INTEGER' : 'INT';
    }
    if ($kind === 'int') {
        return $driver === 'sqlite' ? 'INTEGER' : 'INT';
    }
    if ($kind === 'bigint') {
        return 'BIGINT';
    }
    if ($kind === 'text') {
        return 'TEXT';
    }
    if ($kind === 'mediumtext') {
        return $driver === 'sqlite' ? 'TEXT' : 'MEDIUMTEXT';
    }
    if (strpos($kind, 'str:') === 0) {
        $n = intval(substr($kind, 4));
        if ($n <= 0) {
            $n = 255;
        }
        return $driver === 'sqlite' ? 'TEXT' : ('VARCHAR(' . $n . ')');
    }
    return $driver === 'sqlite' ? 'TEXT' : 'VARCHAR(255)';
}

/** 默认值字面量 */
function jc_default_literal($val)
{
    if ($val === '') {
        return "''";
    }
    if (preg_match('/^-?\d+(\.\d+)?$/', $val)) {
        return $val;
    }
    if (strtolower($val) === 'null') {
        return 'NULL';
    }
    return "'" . str_replace("'", "''", $val) . "'";
}

/** 生成 CREATE TABLE 语句 */
function jc_create_table_sql($name, $def, $driver)
{
    $lines = array();
    $pkCols = isset($def['pk']) ? $def['pk'] : array();
    foreach ($def['cols'] as $col) {
        $colName = $col[0];
        $kind = $col[1];
        $extras = isset($col[2]) ? $col[2] : '';
        $isAuto = strpos(' ' . $extras . ' ', ' auto ') !== false;
        $isPk = ($kind === 'pk');
        $isNotnull = strpos(' ' . $extras . ' ', ' notnull ') !== false;
        $isUnique = strpos(' ' . $extras . ' ', ' unique ') !== false;
        $default = null;
        if (preg_match('/default:(\S*)/', $extras, $m)) {
            $default = $m[1];
        }

        $type = jc_col_type($kind, $driver);
        $defStr = '`' . $colName . '` ' . $type;
        if ($isNotnull) {
            $defStr .= ' NOT NULL';
        }
        if ($isUnique) {
            $defStr .= ' UNIQUE';
        }
        if ($default !== null) {
            $defStr .= ' DEFAULT ' . jc_default_literal($default);
        }
        // SQLite 自增主键必须内联为 INTEGER PRIMARY KEY AUTOINCREMENT
        if ($isPk && $isAuto && $driver === 'sqlite') {
            $defStr = '`' . $colName . '` INTEGER PRIMARY KEY AUTOINCREMENT';
        } elseif ($isPk && $isAuto && $driver !== 'sqlite') {
            $defStr .= ' AUTO_INCREMENT';
        }
        $lines[] = $defStr;
    }

    $autoCol = null;
    foreach ($def['cols'] as $col) {
        if ($col[1] === 'pk' && strpos(' ' . (isset($col[2]) ? $col[2] : '') . ' ', ' auto ') !== false) {
            $autoCol = $col[0];
        }
    }
    if ($autoCol !== null && $driver !== 'sqlite') {
        // MySQL：自增列需作为键
        $lines[] = 'PRIMARY KEY (`' . $autoCol . '`)';
    } elseif (!empty($pkCols)) {
        $quoted = array();
        foreach ($pkCols as $c) {
            $quoted[] = '`' . $c . '`';
        }
        $lines[] = 'PRIMARY KEY (' . implode(', ', $quoted) . ')';
    }

    // 关键：显式指定 utf8mb4，否则在默认字符集为 latin1 的主机上
    // （如 InfinityFree）会建出 latin1 表，与 utf8mb4 参数比较时报 1267。
    $opts = ($driver === 'sqlite') ? '' : ' DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci';
    return 'CREATE TABLE IF NOT EXISTS `' . $name . '` (' . implode(', ', $lines) . ')' . $opts;
}

/** 全部建表语句 */
function jc_schema_sql($driver)
{
    $sql = array();
    foreach (jc_schema_tables() as $name => $def) {
        $sql[] = jc_create_table_sql($name, $def, $driver);
    }
    return $sql;
}

/** 索引语句 */
function jc_schema_indexes($driver)
{
    $ine = ($driver === 'sqlite') ? 'IF NOT EXISTS ' : '';
    return array(
        'CREATE INDEX ' . $ine . 'idx_msg_conv ON `messages` (`conv_type`, `conv_id`, `id`)',
        'CREATE INDEX ' . $ine . 'idx_notif_user ON `notifications` (`user_id`, `read`)',
        'CREATE INDEX ' . $ine . 'idx_events_user ON `events` (`user_id`, `id`)',
        'CREATE INDEX ' . $ine . 'idx_recalled_conv ON `message_recalled` (`conv_type`, `conv_id`, `message_id`)',
        'CREATE INDEX ' . $ine . 'idx_verify_email ON `verify_codes` (`email`)',
        'CREATE INDEX ' . $ine . 'idx_gjoin_group ON `group_join_requests` (`group_id`, `status`)',
        'CREATE INDEX ' . $ine . 'idx_gjoin_user ON `group_join_requests` (`user_id`, `status`)',
        'CREATE INDEX ' . $ine . 'idx_ip_last ON `ip_records` (`last_seen`)',
        'CREATE INDEX ' . $ine . 'idx_ip_user ON `ip_records` (`user_id`)',
    );
}

/**
 * 把既有表强制转成 utf8mb4（修复在 latin1 默认字符集主机上已建好的旧库）。
 * sqlite 无需处理。
 */
function jc_schema_convert_sql($driver)
{
    if ($driver === 'sqlite') {
        return array();
    }
    $sql = array();
    foreach (jc_schema_tables() as $name => $def) {
        $sql[] = 'ALTER TABLE `' . $name . '` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci';
    }
    return $sql;
}
