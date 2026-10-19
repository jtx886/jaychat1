<?php
/**
 * /api/ai/ask —— 官方群 @Jay AI 提问（前端 fire-and-forget 调用）
 */

/** Jay AI 人格设定 */
function jc_ai_system_prompt()
{
    return '你是「Jay AI」，Jay Chat 官方群里的智能机器人，性格热情、简洁、靠谱。'
        . '用中文回答，语气自然友好，回答尽量简短清晰，不要长篇大论，不要使用 Markdown 标题。';
}

/** 以 Jay AI（sender_id=0）身份在群里插入一条消息 */
function jc_insert_ai_message($gid, $content, $extra)
{
    $id = db_insert(
        'INSERT INTO `messages` (`conv_type`, `conv_id`, `sender_id`, `msg_type`, `content`, `media_url`, `media_thumb`, `one_time`, `burn_sec`, `recalled`, `extra`, `created_at`)
         VALUES (\'group\', ?, 0, \'text\', ?, \'\', \'\', 0, 5, 0, ?, ?)',
        array((string) $gid, (string) $content, jc_json($extra), now_ms())
    );
    $row = db_one('SELECT * FROM `messages` WHERE `id` = ?', array($id));
    return build_message($row);
}

// Jay AI 提问：任意群聊中 @Jay AI 均可触发（需为群成员）
route('POST', '#^/api/ai/ask$#', function ($params, $body) {
    $uid = require_auth();
    $gid = isset($body['groupId']) ? (int) $body['groupId'] : 0;
    $question = isset($body['question']) ? mb_substr((string) $body['question'], 0, 500, 'UTF-8') : '';
    $g = db_one('SELECT * FROM `groups` WHERE `id` = ?', array($gid));
    if (!$g) {
        return array(404, array('error' => '群聊不存在'));
    }
    if (!member_role($gid, $uid)) {
        return array(403, array('error' => '你不在该群中'));
    }

    // AI 调用可能较慢：允许客户端断开后继续执行，结果通过事件通道推送
    @ignore_user_abort(true);
    @set_time_limit(120);

    $asker = public_user(get_user($uid));
    $askerName = $asker ? $asker['username'] : '用户';

    // 1) 先发一条「正在思考」占位
    $thinking = jc_insert_ai_message($gid, '@' . $askerName . ' Jay AI 正在思考中…', array('ai' => true, 'pending' => true));
    event_to_group_members($gid, 'message', $thinking);

    // 2) 组装上下文（取最近 12 条）
    $rows = db_all(
        'SELECT * FROM `messages` WHERE `conv_type` = \'group\' AND `conv_id` = ? AND `recalled` = 0 ORDER BY `id` DESC LIMIT 12',
        array((string) $gid)
    );
    $rows = array_reverse($rows);
    $history = array();
    foreach ($rows as $m) {
        if ((int) $m['sender_id'] === 0) {
            $txt = preg_replace('/^@\S+\s*/u', '', (string) $m['content']);
            if ($txt !== '') {
                $history[] = array('role' => 'assistant', 'content' => $txt);
            }
        } else {
            $pu = public_user(get_user($m['sender_id']));
            $uname = $pu ? $pu['username'] : '用户';
            if (trim((string) $m['content']) !== '') {
                $history[] = array('role' => 'user', 'content' => $uname . ': ' . $m['content']);
            }
        }
    }

    $prompt = trim(preg_replace('/@?\s*jay\s*ai\s*[:：,，]?/iu', '', $question));
    if ($prompt === '') {
        $prompt = '你好';
    }
    $sys = jc_ai_system_prompt() . "\n当前提问者是「" . $askerName . "」，请在回答的第一行单独写「@" . $askerName . "」，从第二行开始回答。";
    $messages = array_merge(array(array('role' => 'system', 'content' => $sys)), $history, array(array('role' => 'user', 'content' => $prompt)));

    $r = jc_ai_chat($messages);
    $text = !empty($r['ok']) ? $r['text'] : ('抱歉，Jay AI 暂时无法回答（' . (isset($r['error']) ? $r['error'] : '未知错误') . '），请稍后再试。');
    if (strpos($text, '@' . $askerName) !== 0) {
        $text = '@' . $askerName . "\n" . $text;
    }

    // 3) 用最终结果替换「正在思考」
    db_run(
        'UPDATE `messages` SET `content` = ?, `extra` = ? WHERE `id` = ?',
        array(mb_substr($text, 0, 2000, 'UTF-8'), jc_json(array('ai' => true, 'mention' => $askerName, 'ok' => !empty($r['ok']))), (int) $thinking['id'])
    );
    $finalRow = db_one('SELECT * FROM `messages` WHERE `id` = ?', array((int) $thinking['id']));
    $finalMsg = build_message($finalRow);
    event_to_group_members($gid, 'message:update', $finalMsg);

    return array(200, array('ok' => true, 'reply' => $text));
});
