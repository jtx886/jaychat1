<?php
/**
 * 配置加载
 * 优先级：内置默认值 < 环境变量 < htdocs/lib/config.local.php（返回数组覆盖）
 *
 * 说明：为兼容 InfinityFree，这里不依赖任何 PHP 8 专属语法。
 */

/** 内置默认配置 */
function jc_default_config()
{
    return array(
        // 数据库：mysql（线上） | sqlite（本地自测）
        'DB_DRIVER' => 'mysql',
        'DB_HOST' => 'localhost',
        'DB_PORT' => '3306',
        'DB_NAME' => 'jaychat',
        'DB_USER' => '',
        'DB_PASS' => '',
        'DB_CHARSET' => 'utf8mb4',
        // 仅 DB_DRIVER=sqlite 时使用
        'DB_PATH' => dirname(__DIR__) . '/data/jaychat.db',

        // 鉴权签名密钥：部署时请务必修改为随机长字符串
        'JWT_SECRET' => 'jaychat-dev-secret-change-me',

        // 开发模式：true 时 /api/health 返回 dev_mode=true
        'DEV_MODE' => true,

        // 是否允许把注册/找回验证码直接回传。
        // 默认关闭：回传验证码等于任何人都能重置任意邮箱账号，属于高危漏洞。
        // 仅在本地调试且 DEV_MODE=true 时才允许临时开启。
        'ALLOW_DEV_CODE' => false,

        // 上传大小上限（字节）。InfinityFree 单文件上限 10MB
        'UPLOAD_MAX_BYTES' => 10 * 1024 * 1024,

        // ---- 邮件（163 SMTP，SSL 465）----
        // 用于注册/找回密码验证码。可在 config.local.php 覆盖。
        'SMTP_HOST' => 'smtp.163.com',
        'SMTP_PORT' => 465,
        'SMTP_USER' => 'jtxnb886@163.com',
        'SMTP_PASS' => 'FLLRDtadYAfGXp9Y',
        'SMTP_FROM' => 'jtxnb886@163.com',
        'SMTP_FROM_NAME' => 'Jay Chat',

        // ---- Jay AI（可在管理员后台动态覆盖）----
        'AI_URL' => 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
        'AI_KEY' => 'd63d18de6bcf4a92a13a78696e401e83.0MIXAf8ANp2tG9BD',
        'AI_MODEL' => 'GLM-5.3',
        'AI_NAME' => 'Jay AI',
        'AI_AVATAR' => '',

        // 额外管理员邮箱（逗号分隔）；官方账号始终为管理员
        'ADMIN_EMAILS' => '',
    );
}

$GLOBALS['JC_CONFIG'] = null;

/** 读取配置项；$key 为 null 时返回全部配置 */
function jc_config($key = null)
{
    if ($GLOBALS['JC_CONFIG'] === null) {
        $cfg = jc_default_config();

        // 1) 环境变量覆盖
        $boolKeys = array('DEV_MODE', 'ALLOW_DEV_CODE');
        $intKeys = array('UPLOAD_MAX_BYTES', 'SMTP_PORT');
        $envKeys = array(
            'DB_DRIVER', 'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASS',
            'DB_PATH', 'JWT_SECRET', 'DEV_MODE', 'ALLOW_DEV_CODE', 'UPLOAD_MAX_BYTES',
            'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'SMTP_FROM_NAME',
            'AI_URL', 'AI_KEY', 'AI_MODEL', 'AI_NAME', 'AI_AVATAR', 'ADMIN_EMAILS',
        );
        foreach ($envKeys as $k) {
            $v = getenv($k);
            if ($v === false || $v === '') {
                continue;
            }
            if (in_array($k, $boolKeys, true)) {
                $cfg[$k] = !(strtolower($v) === 'false' || $v === '0');
            } elseif (in_array($k, $intKeys, true)) {
                $cfg[$k] = intval($v);
            } else {
                $cfg[$k] = $v;
            }
        }

        // 2) config.local.php 覆盖（最高优先级）
        $localFile = __DIR__ . '/config.local.php';
        if (is_file($localFile)) {
            $local = include $localFile;
            if (is_array($local)) {
                $cfg = array_merge($cfg, $local);
            }
        }

        $GLOBALS['JC_CONFIG'] = $cfg;
    }

    if ($key === null) {
        return $GLOBALS['JC_CONFIG'];
    }
    return array_key_exists($key, $GLOBALS['JC_CONFIG']) ? $GLOBALS['JC_CONFIG'][$key] : null;
}

/** token 有效期：30 天（毫秒） */
function jc_token_ttl()
{
    return 1000 * 60 * 60 * 24 * 30;
}

/** 官方群名称 */
function jc_official_group_name()
{
    return 'Jay Chat官方群';
}

/** 官方账号「杰同学」 */
function jc_official_account()
{
    return array(
        'username' => '杰同学',
        'email' => 'xujszjjzjzjxhxhh@qq.com',
        'password' => '101113',
    );
}

/** 额外管理员邮箱列表（不含官方账号，官方账号始终是管理员） */
function jc_admin_emails()
{
    $raw = (string) jc_config('ADMIN_EMAILS');
    $out = array();
    foreach (preg_split('/[\s,;]+/', $raw) as $e) {
        $e = trim(strtolower($e));
        if ($e !== '') {
            $out[] = $e;
        }
    }
    return $out;
}

/** 数据库 schema 版本（用于自检/安装判定） */
function jc_schema_version()
{
    // v2：强制所有表使用 utf8mb4，修复 latin1 默认字符集主机上的 1267 报错
    // v3：新增管理员角色、封禁/禁言字段，以及应用设置表与表情收藏表
    // v4：表情收藏 / 应用设置表结构复核，消息支持引用回复
    // v5：撤回消息原文留存表（管理后台「聊天记录」可查看撤回内容）
    // v6：动态评论支持图片 / 视频 / 表情 / 动画表情包（新增评论类型与媒体字段）
    // v7：群聊支持解散（新增 dissolved 标记，解散后保留会话与历史消息、禁止发言）
    // v8：安全加固（用户 IP 记录、IP 黑名单、接口限流表）
    // v9：头像列扩容（预设头像 data URI 超过 255 字符）+ 头像文件备份表（升级后自动恢复）
    return 9;
}
