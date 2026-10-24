<?php
/**
 * 数据库连接与轻量查询封装（PDO，兼容 mysql / sqlite 两种驱动）
 *
 * 所有查询都用标准 SQL + 位置占位符 ?，避免 MySQL 专有语法。
 */

/** 获取 PDO 单例 */
function db()
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }
    $driver = jc_config('DB_DRIVER');
    if ($driver === 'sqlite') {
        $path = jc_config('DB_PATH');
        $dir = dirname($path);
        if (!is_dir($dir)) {
            @mkdir($dir, 0777, true);
        }
        $pdo = new PDO('sqlite:' . $path);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $pdo->exec('PRAGMA journal_mode = WAL;');
    } else {
        $dsn = 'mysql:host=' . jc_config('DB_HOST')
            . ';port=' . jc_config('DB_PORT')
            . ';dbname=' . jc_config('DB_NAME')
            . ';charset=' . jc_config('DB_CHARSET');
        $pdo = new PDO($dsn, jc_config('DB_USER'), jc_config('DB_PASS'));
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        // 让整型列以原生 PHP int 返回（而非字符串）
        $pdo->setAttribute(PDO::ATTR_EMULATE_PREPARES, false);
        $pdo->setAttribute(PDO::ATTR_STRINGIFY_FETCHES, false);
        // 连接与表的字符集/排序规则必须一致：主机默认字符集可能是 latin1，
        // 若连接是 utf8mb4 而与 latin1 列比较就会报 1267 Illegal mix of collations。
        try {
            $pdo->exec('SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci');
        } catch (Exception $e) {
            // 该排序规则不可用时忽略，DSN 的 charset 仍然生效
        }
    }
    return $pdo;
}

/** 执行查询，返回 PDOStatement */
function db_query($sql, $params = array())
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt;
}

/** 取单行（无则返回 null） */
function db_one($sql, $params = array())
{
    $row = db_query($sql, $params)->fetch();
    return $row === false ? null : $row;
}

/** 取多行 */
function db_all($sql, $params = array())
{
    return db_query($sql, $params)->fetchAll();
}

/** 取单列标量（无则返回 null） */
function db_value($sql, $params = array())
{
    $row = db_query($sql, $params)->fetch(PDO::FETCH_NUM);
    return $row === false ? null : $row[0];
}

/** 执行写入，返回受影响行数 */
function db_run($sql, $params = array())
{
    return db_query($sql, $params)->rowCount();
}

/** 执行插入，返回自增主键（int） */
function db_insert($sql, $params = array())
{
    db_query($sql, $params);
    return (int) db()->lastInsertId();
}

/** 执行写入并忽略唯一约束冲突（等价 SQLite 的 INSERT OR IGNORE） */
function db_exec_ignore($sql, $params = array())
{
    try {
        return db_run($sql, $params);
    } catch (Exception $e) {
        return false;
    }
}

/** 取表的列名列表（跨驱动） */
function db_table_columns($table)
{
    $driver = jc_config('DB_DRIVER');
    try {
        if ($driver === 'sqlite') {
            $rows = db_all('PRAGMA table_info(`' . $table . '`)');
            $out = array();
            foreach ($rows as $r) {
                $out[] = $r['name'];
            }
            return $out;
        }
        $rows = db_all('SHOW COLUMNS FROM `' . $table . '`');
        $out = array();
        foreach ($rows as $r) {
            $out[] = $r['Field'];
        }
        return $out;
    } catch (Exception $e) {
        return array();
    }
}

/** 确保某列存在（轻量迁移） */
function db_ensure_column($table, $column, $ddl)
{
    $cols = db_table_columns($table);
    if (empty($cols)) {
        return;
    }
    if (!in_array($column, $cols, true)) {
        try {
            db()->exec('ALTER TABLE `' . $table . '` ADD COLUMN ' . $ddl);
        } catch (Exception $e) {
            // 忽略（并发/已存在）
        }
    }
}

/** 检查数据表是否存在（用于建表自愈） */
function db_table_exists($table)
{
    // 任何异常一律按「不存在」处理；绝不能让检查本身抛错，
    // 否则每个请求都会重跑全套建表 DDL，把数据库轰垮（v1.2.4 的崩溃教训）。
    try {
        $driver = jc_config('DB_DRIVER');
        if ($driver === 'sqlite') {
            return db_one("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", array($table)) !== null;
        }
        // information_schema 标准查询：占位符在 MySQL 原生预处理下 100% 可用
        // （SHOW TABLES LIKE ? 在部分驱动/版本下不可靠）
        return db_one(
            'SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?',
            array($table)
        ) !== null;
    } catch (Exception $e) {
        return false;
    } catch (Throwable $e) {
        return false;
    }
}

/** 首次请求自检：表/索引/列缺失则自动创建（与 database/schema.sql 等价） */
function db_install()
{
    static $done = false;
    if ($done) {
        return;
    }
    $driver = jc_config('DB_DRIVER');
    $version = (string) jc_schema_version();

    $need = true;
    try {
        $row = db_one('SELECT `value` FROM `jc_meta` WHERE `name` = ?', array('schema_version'));
        // 版本一致之外，还必须确认关键表真实存在：
        // 某些主机曾出现「建表被静默拒绝但版本号已写入」的情况，导致后续升级
        // 不再建表、所有依赖该表的接口 500（头像/上传/媒体全部失败）。
        if ($row !== null && (string) $row['value'] === $version && db_table_exists('avatar_files')) {
            $need = false;
        }
    } catch (Exception $e) {
        $need = true;
    } catch (Throwable $e) {
        $need = true;
    }

    // 建表冷却：若上次建表尝试失败（主机拒绝 DDL 等），5 分钟内不再重试。
    // 否则每个请求都会重跑几十条 DDL，数据库会被轰垮（v1.2.4 崩溃事故的教训）。
    $coolFile = (sys_get_temp_dir() ?: '/tmp') . '/jc_schema_cool_' . md5(__DIR__);
    if ($need && is_file($coolFile) && (int) @filemtime($coolFile) > time() - 300) {
        $need = false;
    }

    if ($need) {
        foreach (jc_schema_sql($driver) as $sql) {
            try {
                db()->exec($sql);
            } catch (Exception $e) {
                // 已存在等情况忽略
            }
        }
        foreach (jc_schema_indexes($driver) as $sql) {
            try {
                db()->exec($sql);
            } catch (Exception $e) {
                // 索引已存在忽略
            }
        }
        // 修复：若旧库建表时未指定字符集（主机默认为 latin1），这里强制转成 utf8mb4
        foreach (jc_schema_convert_sql($driver) as $sql) {
            try {
                db()->exec($sql);
            } catch (Exception $e) {
                // 已是 utf8mb4 或无权限时忽略
            }
        }
        // 轻量迁移：老库补齐新列
        try {
            db_ensure_column('groups', 'im_groupid', "`im_groupid` VARCHAR(64) DEFAULT ''");
            db_ensure_column('groups', 'dissolved', '`dissolved` INT DEFAULT 0');
        } catch (Exception $e) {
        }
        try {
            if ($driver === 'sqlite') {
                db_ensure_column('messages', 'burn_sec', '`burn_sec` INTEGER DEFAULT 5');
                db_ensure_column('users', 'last_poll', '`last_poll` BIGINT DEFAULT 0');
                db_ensure_column('users', 'role', "`role` TEXT DEFAULT 'user'");
                db_ensure_column('users', 'banned', '`banned` INTEGER DEFAULT 0');
                db_ensure_column('users', 'banned_until', '`banned_until` BIGINT DEFAULT 0');
                db_ensure_column('users', 'muted_until', '`muted_until` BIGINT DEFAULT 0');
                db_ensure_column('users', 'last_ip', "`last_ip` TEXT DEFAULT ''");
                db_ensure_column('users', 'last_ip_at', '`last_ip_at` BIGINT DEFAULT 0');
                db_ensure_column('users', 'last_ua', "`last_ua` TEXT DEFAULT ''");
                // 动态评论支持媒体
                db_ensure_column('moment_comments', 'msg_type', "`msg_type` TEXT DEFAULT 'text'");
                db_ensure_column('moment_comments', 'media_url', "`media_url` TEXT DEFAULT ''");
                db_ensure_column('moment_comments', 'media_thumb', "`media_thumb` TEXT DEFAULT ''");
            } else {
                db_ensure_column('messages', 'burn_sec', '`burn_sec` INT DEFAULT 5');
                db_ensure_column('users', 'last_poll', '`last_poll` BIGINT DEFAULT 0');
                db_ensure_column('users', 'role', "`role` VARCHAR(16) DEFAULT 'user'");
                db_ensure_column('users', 'banned', '`banned` INT DEFAULT 0');
                db_ensure_column('users', 'banned_until', '`banned_until` BIGINT DEFAULT 0');
                db_ensure_column('users', 'muted_until', '`muted_until` BIGINT DEFAULT 0');
                db_ensure_column('users', 'last_ip', '`last_ip` VARCHAR(64) DEFAULT ""');
                db_ensure_column('users', 'last_ip_at', '`last_ip_at` BIGINT DEFAULT 0');
                db_ensure_column('users', 'last_ua', '`last_ua` VARCHAR(190) DEFAULT ""');
                // 动态评论支持媒体
                db_ensure_column('moment_comments', 'msg_type', "`msg_type` VARCHAR(16) DEFAULT 'text'");
                db_ensure_column('moment_comments', 'media_url', '`media_url` VARCHAR(1000) DEFAULT ""');
                db_ensure_column('moment_comments', 'media_thumb', '`media_thumb` VARCHAR(1000) DEFAULT ""');
                // v10：合并转发需要大容量 content
                db()->exec('ALTER TABLE `messages` MODIFY `content` TEXT');
            }
        } catch (Exception $e) {
        }

        // v9 迁移：头像列扩容。预设头像是 data URI（约 800 字符），旧的 VARCHAR(255) 会被截断，
        // 表现为「选了预设头像但显示不出来 / 升级后头像需要重设」。
        if ($driver !== 'sqlite') {
            try {
                db()->exec('ALTER TABLE `users` MODIFY `avatar` VARCHAR(2000) NOT NULL DEFAULT \'\'');
            } catch (Exception $e) {
            }
            try {
                db()->exec('ALTER TABLE `groups` MODIFY `avatar` VARCHAR(2000) NOT NULL DEFAULT \'\'');
            } catch (Exception $e) {
            }
        }
        // 把当前正在使用的上传头像备份到数据库，之后升级即使覆盖 uploads 也能自动恢复
        if (function_exists('jc_avatar_backup_existing')) {
            try {
                jc_avatar_backup_existing();
            } catch (Exception $e) {
            }
        }

        // 只有确认关键表真正建成才推进版本号；
        // 若建表仍被主机拒绝，则记录冷却，5 分钟内不再重试，保护数据库。
        if (db_table_exists('avatar_files') && db_table_exists('jc_meta')) {
            try {
                $row = db_one('SELECT `value` FROM `jc_meta` WHERE `name` = ?', array('schema_version'));
                if ($row === null) {
                    db_run('INSERT INTO `jc_meta` (`name`, `value`) VALUES (?, ?)', array('schema_version', $version));
                } else {
                    db_run('UPDATE `jc_meta` SET `value` = ? WHERE `name` = ?', array($version, 'schema_version'));
                }
            } catch (Exception $e) {
            }
            @unlink($coolFile);
        } else {
            @touch($coolFile);
        }
    }

    $done = true;
}

/** 生成 MySQL 版建表脚本（供 database/schema.sql 使用） */
function db_schema_sql_mysql()
{
    $out = array();
    foreach (jc_schema_sql('mysql') as $sql) {
        $out[] = $sql . ';';
    }
    foreach (jc_schema_indexes('mysql') as $sql) {
        $out[] = $sql . ';';
    }
    return implode("\n\n", $out) . "\n";
}
