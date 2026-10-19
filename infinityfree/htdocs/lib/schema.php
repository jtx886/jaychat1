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
                array('avatar', 'str:255', 'default:'),
                array('bio', 'str:255', 'default:'),
                array('is_official', 'int', 'default:0'),
                array('online', 'int', 'default:0'),
                array('last_seen', 'bigint', 'default:0'),
                array('last_poll', 'bigint', 'default:0'),
                array('name_week', 'str:16', 'default:'),
                array('name_count', 'int', 'default:0'),
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
                array('avatar', 'str:255', 'default:'),
                array('owner_id', 'int', 'notnull'),
                array('announcement', 'str:255', 'default:'),
                array('is_official', 'int', 'default:0'),
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
        'messages' => array(
            'cols' => array(
                array('id', 'pk', 'auto'),
                array('conv_type', 'str:16', 'notnull'),
                array('conv_id', 'str:100', 'notnull'),
                array('sender_id', 'int', 'notnull'),
                array('msg_type', 'str:16', 'default:text'),
                array('content', 'str:2000', 'default:'),
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
        'CREATE INDEX ' . $ine . 'idx_verify_email ON `verify_codes` (`email`)',
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
