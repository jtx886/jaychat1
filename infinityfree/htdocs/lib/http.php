<?php
/**
 * 极简路由与统一响应
 *
 * 处理器签名：function($params, $body) -> array($status, $data)
 * 通过 api_abort($status, $message) 抛出 ApiException 提前结束（由 index.php 捕获并输出）。
 */

class ApiException extends Exception
{
    public $status;

    public function __construct($status, $message)
    {
        parent::__construct($message);
        $this->status = (int) $status;
    }
}

/** 抛出业务错误（返回 {"error": $message}） */
function api_abort($status, $message)
{
    throw new ApiException($status, $message);
}

$GLOBALS['JC_ROUTES'] = array();

/** 注册路由：$pattern 为完整正则（含 ^ $ 与捕获组） */
function route($method, $pattern, $handler)
{
    $GLOBALS['JC_ROUTES'][] = array(strtoupper($method), $pattern, $handler);
}

/** 分发请求；未匹配抛出 404 */
function jc_dispatch($method, $path, $body)
{
    $method = strtoupper($method);
    // 部分共享主机/WAF 会拦截 PATCH，前端统一改用 POST；这里做兼容分发。
    $tries = ($method === 'POST') ? array('POST', 'PATCH') : array($method);
    foreach ($tries as $verb) {
        foreach ($GLOBALS['JC_ROUTES'] as $r) {
            if ($r[0] !== $verb) {
                continue;
            }
            if (preg_match($r[1], $path, $m)) {
                $params = array_slice($m, 1);
                return call_user_func($r[2], $params, $body);
            }
        }
    }
    throw new ApiException(404, '接口不存在');
}
