<?php
/**
 * 配置示例。真实配置请复制为 htdocs/lib/config.local.php（该文件不应提交到版本库）。
 * 优先级：内置默认值 < 环境变量 < htdocs/lib/config.local.php
 *
 * 也可以完全依赖环境变量（InfinityFree 免费主机通常无法设置环境变量，
 * 因此推荐用 config.local.php 覆盖）。
 */
return array(
    // ---- 数据库 ----
    // 线上填 mysql；本地自测可改成 sqlite（配合 DB_PATH）
    'DB_DRIVER' => 'mysql',
    'DB_HOST' => 'sqlXXX.infinityfree.com',   // InfinityFree 控制台 → MySQL Databases 里查看
    'DB_PORT' => '3306',
    'DB_NAME' => 'if0_XXXXXXXX_jaychat',      // 形如 if0_xxxxxxx_xxx
    'DB_USER' => 'if0_XXXXXXXX',
    'DB_PASS' => '你的数据库密码',
    'DB_CHARSET' => 'utf8mb4',
    // 仅 DB_DRIVER=sqlite 时使用
    'DB_PATH' => __DIR__ . '/../data/jaychat.db',

    // ---- 鉴权 ----
    // 生产环境务必改成随机长字符串
    'JWT_SECRET' => '请改成随机长字符串',

    // ---- 开发/降级开关 ----
    // DEV_MODE：true 时 /api/health 返回 dev_mode=true
    'DEV_MODE' => true,
    // ALLOW_DEV_CODE：无 SMTP 时把验证码随 send-code 响应返回（devCode）。
    // 开启后任何人都能注册任意邮箱，仅适合个人演示；正式环境请设 false。
    'ALLOW_DEV_CODE' => true,

    // ---- 上传 ----
    // 单文件大小上限（字节）。InfinityFree 单文件上限 10MB
    'UPLOAD_MAX_BYTES' => 10 * 1024 * 1024,
);
