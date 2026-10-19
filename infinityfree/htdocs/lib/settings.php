<?php
/**
 * 应用设置（app_settings 键值表）与管理员判定
 *
 * 管理员后台修改的 AI 配置会写入 app_settings，覆盖 config.php 中的默认值，
 * 因此无需改动文件即可接入任意第三方（OpenAI 兼容）接口。
 */

/** 读取全部设置（内存缓存） */
function jc_settings_all()
{
    if (isset($GLOBALS['JC_SETTINGS'])) {
        return $GLOBALS['JC_SETTINGS'];
    }
    $out = array();
    try {
        foreach (db_all('SELECT `name`, `value` FROM `app_settings`') as $r) {
            $out[(string) $r['name']] = (string) $r['value'];
        }
    } catch (Exception $e) {
        $out = array();
    }
    $GLOBALS['JC_SETTINGS'] = $out;
    return $out;
}

/** 读取单个设置，$default 为缺省值 */
function jc_setting($name, $default = '')
{
    $all = jc_settings_all();
    return array_key_exists($name, $all) ? $all[$name] : $default;
}

/** 写入/覆盖设置 */
function jc_setting_set($name, $value)
{
    $name = (string) $name;
    $value = (string) $value;
    $row = db_one('SELECT 1 FROM `app_settings` WHERE `name` = ?', array($name));
    if ($row) {
        db_run('UPDATE `app_settings` SET `value` = ? WHERE `name` = ?', array($value, $name));
    } else {
        db_run('INSERT INTO `app_settings` (`name`, `value`) VALUES (?, ?)', array($name, $value));
    }
    $GLOBALS['JC_SETTINGS'] = null; // 失效缓存
}

/** AI 配置（设置表优先，其次 config 默认值） */
function jc_ai_conf()
{
    return array(
        'url' => (string) jc_setting('ai_url', jc_config('AI_URL')),
        'key' => (string) jc_setting('ai_key', jc_config('AI_KEY')),
        'model' => (string) jc_setting('ai_model', jc_config('AI_MODEL')),
        'name' => (string) jc_setting('ai_name', jc_config('AI_NAME')),
        'avatar' => (string) jc_setting('ai_avatar', jc_config('AI_AVATAR')),
    );
}

/** AI 展示配置（聊天页面名称 + 头像），对外可读 */
function jc_ai_public()
{
    $c = jc_ai_conf();
    $name = $c['name'] !== '' ? $c['name'] : 'Jay AI';
    return array('name' => $name, 'avatar' => $c['avatar']);
}

/** 是否管理员：role=admin / 官方账号 / ADMIN_EMAILS 白名单 */
function jc_is_admin($u)
{
    if (!$u) {
        return false;
    }
    if (isset($u['role']) && (string) $u['role'] === 'admin') {
        return true;
    }
    if (!empty($u['is_official'])) {
        return true;
    }
    $email = isset($u['email']) ? strtolower((string) $u['email']) : '';
    return $email !== '' && in_array($email, jc_admin_emails(), true);
}

/** 管理员守卫：返回 uid，非管理员抛 403 */
function jc_require_admin()
{
    $uid = require_auth();
    $u = get_user($uid);
    if (!jc_is_admin($u)) {
        api_abort(403, '仅管理员可访问');
    }
    return $uid;
}

/** 封禁状态：返回 array(banned, until) */
function jc_ban_state($u)
{
    if (!$u || empty($u['banned'])) {
        return array('banned' => false, 'until' => 0);
    }
    $until = isset($u['banned_until']) ? (int) $u['banned_until'] : 0;
    if ($until > 0 && $until <= now_ms()) {
        return array('banned' => false, 'until' => 0); // 已到期
    }
    return array('banned' => true, 'until' => $until);
}

/**
 * 发送消息前的账号状态校验；返回错误文案或 null。
 * 用于封禁 / 全站禁言拦截。
 */
function jc_send_block_reason($u)
{
    if (!$u) {
        return '账号不存在';
    }
    $ban = jc_ban_state($u);
    if ($ban['banned']) {
        return $ban['until'] > 0
            ? ('你的账号已被封禁，剩余 ' . (int) ceil(($ban['until'] - now_ms()) / 1000) . ' 秒')
            : '你的账号已被永久封禁';
    }
    $muted = isset($u['muted_until']) ? (int) $u['muted_until'] : 0;
    if ($muted > now_ms()) {
        return '你已被禁言，剩余 ' . (int) ceil(($muted - now_ms()) / 1000) . ' 秒';
    }
    return null;
}
