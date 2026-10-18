<?php
/**
 * /api/im/usersig  与  /api/ai/ask —— InfinityFree 上不可用，做优雅降级桩
 *
 * 返回 400 + {"error": ...}，前端 http() 会抛出 ApiError 并被调用方 catch 掉
 * （App.jsx 对 loginIM 有 .catch）。
 */

// 腾讯云 IM 登录票据：当前部署未启用
route('GET', '#^/api/im/usersig$#', function ($params, $body) {
    require_auth();
    return array(400, array('error' => '当前部署未启用腾讯云 IM'));
});

// Jay AI 提问：当前部署未启用
route('POST', '#^/api/ai/ask$#', function ($params, $body) {
    require_auth();
    return array(400, array('error' => '当前部署未启用 Jay AI'));
});
