<?php
/**
 * Jay Chat 一键安装向导
 *
 * 用法：把本站文件上传到主机 htdocs 后，浏览器打开  https://你的域名/install.php
 * 填写数据库连接信息 → 一键完成建表与初始化，并自动写入 lib/config.local.php。
 * 安装完成后本页面不再提供安装表单，如需重装请先删除 lib/config.local.php。
 */

error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE & ~E_WARNING);
ini_set('display_errors', '0');

$root       = __DIR__;
$libDir     = $root . '/lib';
$configFile = $libDir . '/config.local.php';

function esc($s)
{
    return htmlspecialchars((string) $s, ENT_QUOTES, 'UTF-8');
}

$isPost = isset($_SERVER['REQUEST_METHOD']) && strtoupper($_SERVER['REQUEST_METHOD']) === 'POST';

// 读取已有配置
$existing = array();
if (is_file($configFile)) {
    $tmp = @include $configFile;
    if (is_array($tmp)) {
        $existing = $tmp;
    }
}

// 已安装判定：配置文件存在且能连上数据库（不依赖 bootstrap，避免重复 require）
$installed = false;
$connectErr = '';
if (!empty($existing['DB_HOST'])) {
    try {
        $dsn = 'mysql:host=' . $existing['DB_HOST']
            . ';port=' . (isset($existing['DB_PORT']) ? $existing['DB_PORT'] : '3306')
            . ';dbname=' . $existing['DB_NAME']
            . ';charset=utf8mb4';
        new PDO($dsn, $existing['DB_USER'], $existing['DB_PASS'], array(
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 8,
        ));
        $installed = true;
    } catch (Exception $e) {
        $connectErr = $e->getMessage();
    }
}

$errors = array();
$ok     = false;

$form = array(
    'DB_HOST'   => isset($_POST['DB_HOST']) ? trim($_POST['DB_HOST']) : (isset($existing['DB_HOST']) ? $existing['DB_HOST'] : ''),
    'DB_NAME'   => isset($_POST['DB_NAME']) ? trim($_POST['DB_NAME']) : (isset($existing['DB_NAME']) ? $existing['DB_NAME'] : ''),
    'DB_USER'   => isset($_POST['DB_USER']) ? trim($_POST['DB_USER']) : (isset($existing['DB_USER']) ? $existing['DB_USER'] : ''),
    'DB_PASS'   => isset($_POST['DB_PASS']) ? (string) $_POST['DB_PASS'] : (isset($existing['DB_PASS']) ? $existing['DB_PASS'] : ''),
    'JWT_SECRET' => isset($_POST['JWT_SECRET']) ? trim($_POST['JWT_SECRET']) : '',
);

if (!$installed && $isPost) {
    if ($form['DB_HOST'] === '') { $errors[] = '数据库地址（Host）不能为空'; }
    if ($form['DB_NAME'] === '') { $errors[] = '数据库名称（Database）不能为空'; }
    if ($form['DB_USER'] === '') { $errors[] = '数据库用户名不能为空'; }

    // 1) 连接测试
    if (!$errors) {
        try {
            $dsn = 'mysql:host=' . $form['DB_HOST'] . ';port=3306;dbname=' . $form['DB_NAME'] . ';charset=utf8mb4';
            new PDO($dsn, $form['DB_USER'], $form['DB_PASS'], array(
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_TIMEOUT => 10,
            ));
        } catch (Exception $e) {
            $errors[] = '数据库连接失败：' . $e->getMessage();
        }
    }

    // 2) 目录可写检查
    if (!$errors && !is_writable($libDir)) {
        $errors[] = 'lib 目录不可写，无法保存配置文件。请把 lib 目录权限改为 755（或 777）后重试。';
    }

    // 3) 写配置
    if (!$errors) {
        $secret = $form['JWT_SECRET'];
        if ($secret === '') {
            // 重装场景：优先复用数据库里已持久化的密钥，避免每次重装都让所有用户重新登录。
            // 首次安装时 jc_meta 表尚未创建，查询会抛异常而退回留空，由 lib/auth.php 首次使用时自动生成。
            $existingSecret = null;
            try {
                $pdo = new PDO($dsn, $form['DB_USER'], $form['DB_PASS'], array(
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_TIMEOUT => 8,
                ));
                $q = $pdo->query("SELECT `value` FROM `jc_meta` WHERE `name` = 'jwt_secret'");
                $r = $q ? $q->fetch(PDO::FETCH_ASSOC) : false;
                if ($r && isset($r['value']) && (string) $r['value'] !== '') {
                    $existingSecret = (string) $r['value'];
                }
            } catch (Exception $e) {
            }
            $secret = $existingSecret !== null ? $existingSecret : '';
        }
        $cfg = "<?php\n"
            . "// 由 install.php 于 " . date('Y-m-d H:i:s') . " 自动生成，请勿手动提交到版本库\n"
            . "return array(\n"
            . "    'DB_DRIVER' => 'mysql',\n"
            . "    'DB_HOST' => " . var_export($form['DB_HOST'], true) . ",\n"
            . "    'DB_PORT' => '3306',\n"
            . "    'DB_NAME' => " . var_export($form['DB_NAME'], true) . ",\n"
            . "    'DB_USER' => " . var_export($form['DB_USER'], true) . ",\n"
            . "    'DB_PASS' => " . var_export($form['DB_PASS'], true) . ",\n"
            . "    'DB_CHARSET' => 'utf8mb4',\n"
            . "    'DB_PATH' => __DIR__ . '/../data/jaychat.db',\n"
            . "    'JWT_SECRET' => " . var_export($secret, true) . ",\n"
            . "    'DEV_MODE' => true,\n"
            . "    'ALLOW_DEV_CODE' => true,\n"
            . "    'UPLOAD_MAX_BYTES' => 10 * 1024 * 1024,\n"
            . ");\n";
        if (@file_put_contents($configFile, $cfg) === false) {
            $errors[] = '写入 lib/config.local.php 失败。';
        }
    }

    // 4) 建表 + 初始化（首次请求自动建表 + 种子官方账号/官方群）
    if (!$errors) {
        try {
            require_once $root . '/lib/bootstrap.php';
            $ok = true;
        } catch (Throwable $e) {
            $errors[] = '初始化数据库失败：' . $e->getMessage();
        }
    }
}
?>
<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="theme-color" content="#20264f">
<title>Jay Chat 安装向导</title>
<style>
  *{box-sizing:border-box}
  body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;
       background:linear-gradient(160deg,#1b2140,#20264f 45%,#2b1f4d);color:#fff;min-height:100vh;padding:28px 16px 60px}
  .wrap{max-width:560px;margin:0 auto}
  .brand{display:flex;align-items:center;gap:12px;margin-bottom:18px}
  .logo{width:52px;height:52px;border-radius:16px;background:#fff;padding:6px}
  h1{font-size:22px;margin:0 0 4px}
  .sub{color:#b9c0e6;font-size:13px;margin:0}
  .card{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:18px;padding:20px;margin-top:16px}
  label{display:block;font-size:13px;color:#c9cff2;margin:14px 0 6px}
  input{width:100%;padding:12px 14px;border-radius:12px;border:1px solid rgba(255,255,255,.18);
        background:rgba(255,255,255,.08);color:#fff;font-size:15px;outline:none}
  input:focus{border-color:#7c8cff}
  .btn{display:block;width:100%;margin-top:20px;padding:14px;border:0;border-radius:14px;cursor:pointer;
       font-size:16px;font-weight:600;color:#fff;background:linear-gradient(90deg,#6b6bff,#37c6ff)}
  .btn:active{opacity:.9}
  .hint{font-size:12px;color:#9aa2cf;line-height:1.7;margin-top:10px}
  .msg{border-radius:12px;padding:12px 14px;font-size:14px;line-height:1.6;margin-bottom:6px}
  .err{background:rgba(255,90,90,.15);border:1px solid rgba(255,90,90,.5);color:#ffc9c9}
  .warn{background:rgba(255,190,70,.14);border:1px solid rgba(255,190,70,.45);color:#ffe1a8}
  .ok{background:rgba(70,220,150,.15);border:1px solid rgba(70,220,150,.5);color:#c3ffe4}
  a{color:#8fe3ff}
  code{background:rgba(255,255,255,.12);padding:1px 6px;border-radius:6px;font-size:12px}
  .steps{font-size:13px;color:#c2c8ee;line-height:1.9;margin:0;padding-left:18px}
  .big{font-size:40px;text-align:center;margin:6px 0 2px}
</style>
</head>
<body>
<div class="wrap">

  <div class="brand">
    <img class="logo" src="./logo.svg" alt="Jay Chat">
    <div>
      <h1>Jay Chat 安装向导</h1>
      <p class="sub">只需填写数据库连接信息，一键完成部署</p>
    </div>
  </div>

<?php if ($installed): ?>
  <div class="card">
    <div class="big">✅</div>
    <div class="msg ok">本站已完成安装，可以直接使用。</div>
    <p class="hint">
      官方账号：<code>杰同学</code> / 密码 <code>101113</code>，登录后可进入「Jay Chat官方群」。<br>
      注册新账号需要邮箱验证码；本部署无邮件服务，验证码会直接显示在页面上。
    </p>
    <button class="btn" onclick="location.href='./'">进入 Jay Chat</button>
    <p class="hint">如需重新安装，请先删除服务器上的 <code>lib/config.local.php</code>，再刷新本页。</p>
  </div>

<?php elseif ($ok): ?>
  <div class="card">
    <div class="big">🎉</div>
    <div class="msg ok">安装成功！数据库已建表，官方账号与官方群已初始化。</div>
    <p class="hint">官方账号：<code>杰同学</code> / 密码 <code>101113</code></p>
    <button class="btn" onclick="location.href='./'">进入 Jay Chat</button>
    <p class="hint">建议安装完成后删除 <code>install.php</code>（不删也不影响使用，重装需删除 <code>lib/config.local.php</code>）。</p>
  </div>

<?php else: ?>
  <div class="card">
    <p class="steps">在 InfinityFree 等免费主机上按下面步骤获取信息：</p>
    <ol class="steps">
      <li>登录 InfinityFree 控制面板 → <b>MySQL Databases</b></li>
      <li>能看到 <b>Host</b>、<b>Database</b>、<b>Username</b>、<b>Password</b> 四项</li>
      <li>把四项逐一填入下面，点击「开始安装」即可</li>
    </ol>

    <?php if ($connectErr !== ''): ?>
      <div class="msg warn" style="margin-top:14px">检测到已有配置文件，但连接数据库失败：<?php echo esc($connectErr); ?><br>请核对下面的信息后重新安装。</div>
    <?php endif; ?>

    <?php foreach ($errors as $e): ?>
      <div class="msg err" style="margin-top:12px"><?php echo esc($e); ?></div>
    <?php endforeach; ?>

    <form method="post" autocomplete="off">
      <label>数据库地址 Host</label>
      <input name="DB_HOST" value="<?php echo esc($form['DB_HOST']); ?>" placeholder="sqlXXX.infinityfree.com" required>

      <label>数据库名称 Database</label>
      <input name="DB_NAME" value="<?php echo esc($form['DB_NAME']); ?>" placeholder="if0_XXXXXXXX_jaychat" required>

      <label>数据库用户名 Username</label>
      <input name="DB_USER" value="<?php echo esc($form['DB_USER']); ?>" placeholder="if0_XXXXXXXX" required>

      <label>数据库密码 Password</label>
      <input name="DB_PASS" type="text" value="<?php echo esc($form['DB_PASS']); ?>" placeholder="你创建数据库时设置的密码" required>

      <label>站点签名密钥（可留空，自动生成）</label>
      <input name="JWT_SECRET" value="<?php echo esc($form['JWT_SECRET']); ?>" placeholder="留空则自动生成随机密钥">

      <button class="btn" type="submit">开始安装</button>
    </form>

    <p class="hint">
      提示：数据库密码是你在创建数据库时自己设置的；如果忘记了，可在控制面板删除并重新创建数据库。<br>
      部分主机要求数据库名与用户名带前缀（形如 <code>if0_XXXXXXXX_</code>），请照抄控制面板里的完整名称。
    </p>
  </div>
<?php endif; ?>

</div>
</body>
</html>
