<?php
/**
 * 引导：加载依赖、初始化数据库（首次请求自动建表）、种子官方数据。
 * 仅在处理 API 请求时引入，静态资源请求不会触发数据库操作。
 */

/** htdocs 根目录（含 index.php / uploads / assets） */
if (!defined('JC_HTDOCS')) {
    define('JC_HTDOCS', dirname(__DIR__));
}

require_once __DIR__ . '/util.php';
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/schema.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/http.php';
require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/store.php';
require_once __DIR__ . '/security.php';
require_once __DIR__ . '/events.php';
require_once __DIR__ . '/settings.php';
require_once __DIR__ . '/net.php';
require_once __DIR__ . '/mailer.php';

db_install();
seed_official();

// 用户上传目录在运行时确保存在（部署包不再包含 uploads/，避免解压时被整体清空）
jc_ensure_uploads();
// 每日一次：把存量头像 / 动态图片补进数据库备份，之后升级也不会丢
jc_media_backup_sweep();
