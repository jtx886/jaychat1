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

        // 是否允许把注册/找回验证码直接回传（InfinityFree 无 SMTP，默认开启）
        // 强烈建议仅个人演示使用；设为 false 则 send-code 不会再回传 devCode
        'ALLOW_DEV_CODE' => true,

        // 上传大小上限（字节）。InfinityFree 单文件上限 10MB
        'UPLOAD_MAX_BYTES' => 10 * 1024 * 1024,
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
        $intKeys = array('UPLOAD_MAX_BYTES');
        $envKeys = array(
            'DB_DRIVER', 'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASS',
            'DB_PATH', 'JWT_SECRET', 'DEV_MODE', 'ALLOW_DEV_CODE', 'UPLOAD_MAX_BYTES',
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

/** 数据库 schema 版本（用于自检/安装判定） */
function jc_schema_version()
{
    // v2：强制所有表使用 utf8mb4，修复 latin1 默认字符集主机上的 1267 报错
    return 2;
}
