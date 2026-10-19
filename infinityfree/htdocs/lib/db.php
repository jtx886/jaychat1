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
        if ($row !== null && (string) $row['value'] === $version) {
            $need = false;
        }
    } catch (Exception $e) {
        $need = true;
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
        } catch (Exception $e) {
        }
        try {
            if ($driver === 'sqlite') {
                db_ensure_column('messages', 'burn_sec', '`burn_sec` INTEGER DEFAULT 5');
                db_ensure_column('users', 'last_poll', '`last_poll` BIGINT DEFAULT 0');
            } else {
                db_ensure_column('messages', 'burn_sec', '`burn_sec` INT DEFAULT 5');
                db_ensure_column('users', 'last_poll', '`last_poll` BIGINT DEFAULT 0');
            }
        } catch (Exception $e) {
        }

        // 写入版本标记
        try {
            $row = db_one('SELECT `value` FROM `jc_meta` WHERE `name` = ?', array('schema_version'));
            if ($row === null) {
                db_run('INSERT INTO `jc_meta` (`name`, `value`) VALUES (?, ?)', array('schema_version', $version));
            } else {
                db_run('UPDATE `jc_meta` SET `value` = ? WHERE `name` = ?', array($version, 'schema_version'));
            }
        } catch (Exception $e) {
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
