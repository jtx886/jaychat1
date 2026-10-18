# Jay Chat · InfinityFree 免费主机部署包

把 Jay Chat 从 Node.js 后端移植为 **纯 PHP + MySQL** 版本，可部署在 InfinityFree 等只支持
PHP 的免费虚拟主机上。前端与 Node 版**完全共用同一份构建产物**，接口契约逐字段一致。

> 免费主机限制：只支持 PHP 8.x，**不支持** Node.js / WebSocket / 常驻进程 / cron / SSH，
> 单文件上传上限 10MB。因此实时推送降级为 **HTTP 轮询**，前端会自动探测并切换。

---

## 一、目录结构

```
infinityfree/
├── config.sample.php          # 配置示例（复制为 htdocs/lib/config.local.php）
├── database/
│   └── schema.sql             # MySQL 建表脚本（可选：首次请求也会自动建表）
└── htdocs/                    # ← 把这些内容整体上传到主机的 htdocs 目录
    ├── index.php              # 入口（前端 + /api 分发）
    ├── .htaccess              # 重写规则（/api 分发、静态直出、SPA 兜底）
    ├── index.html             # 前端页面（Vite 构建产物）
    ├── assets/                # 前端 JS/CSS（构建产物）
    ├── logo.svg / logo-192.png
    ├── api/                   # 各业务模块（auth/users/friends/groups/messages/…）
    ├── lib/                   # 框架：配置、PDO、鉴权、SQL 构建、事件总线
    └── uploads/               # 用户上传目录（已放 .htaccess 禁止执行脚本）
```

---

## 二、部署步骤

### 1. 注册并创建站点
1. 注册 [InfinityFree](https://infinityfree.net/) 账号，创建一个免费站点（获得 `xxx.infinityfreeapp.com` 域名）。
2. 进入控制面板，若域名不是自己的，按提示修改 NS 或等待系统分配子域名。

### 2. 创建 MySQL 数据库
1. 控制面板 → **MySQL Databases** → 创建一个数据库。
2. 记下系统给出的四项信息（在数据库详情页可见）：
   - Host（形如 `sqlXXX.infinityfree.com`）
   - Database 名（形如 `if0_XXXXXXXX_jaychat`）
   - Username（形如 `if0_XXXXXXXX`）
   - Password（你自己设置的密码）

### 3. 上传网站文件
1. 控制面板 → **Online File Manager**（或 FTP）。
2. 进入站点的 `htdocs/` 目录，**删除**它里面默认自带的文件。
3. 把本包 `htdocs/` 目录下的**所有内容**上传到站点的 `htdocs/` 里。
   - 保持目录层级：`htdocs/index.php`、`htdocs/api/...`、`htdocs/lib/...` 等。
   - `assets/` 里的文件名带哈希，整个目录一起传，不要改名。

### 4. 填写配置
1. 复制 `config.sample.php`，上传并重命名为 `htdocs/lib/config.local.php`。
2. 按上一步记录，修改数据库连接、签名密钥等：

```php
<?php
return array(
    'DB_DRIVER' => 'mysql',
    'DB_HOST'   => 'sqlXXX.infinityfree.com',   // ← 你的 Host
    'DB_PORT'   => '3306',
    'DB_NAME'   => 'if0_XXXXXXXX_jaychat',      // ← 你的 Database 名
    'DB_USER'   => 'if0_XXXXXXXX',              // ← 你的 Username
    'DB_PASS'   => '你的数据库密码',             // ← 你的密码

    // 生产环境务必改成随机长字符串
    'JWT_SECRET' => '换成一段很长的随机字符串',

    // 无 SMTP：true 时 send-code 会把验证码直接回传（仅个人演示；正式环境请设 false）
    'ALLOW_DEV_CODE' => true,
);
```

> 也可以完全不建 `config.local.php`，改用环境变量覆盖（但 InfinityFree 免费主机
> 一般无法设置环境变量，所以推荐上面的方式）。

### 5. 建表
两种方式任选其一（**首次访问任何 API 时也会自动建表**，通常无需手动操作）：
- **自动**：直接访问站点 `https://你的域名/api/health`，返回 `{"ok":true,...}` 即表示数据库已就绪。
- **手动**：控制面板 → **phpMyAdmin** → 选择该数据库 → 导入 `database/schema.sql`。

### 6. 访问站点
打开 `https://你的域名/` 即可看到前端页面。

---

## 三、本地自测（可选）

需要 PHP 8.x；本机用 SQLite 驱动即可跑通，无需 MySQL：

```bash
cd htdocs
DB_DRIVER=sqlite DB_PATH=/tmp/jc/jaychat.db JWT_SECRET=dev \
  php -S 127.0.0.1:8099 index.php
# 浏览器打开 http://127.0.0.1:8099
```

- `DB_DRIVER=sqlite` 时数据落在 `DB_PATH`，与 `database/schema.sql` 的表结构等价。
- 同一套标准 SQL 同时兼容 MySQL（线上）与 SQLite（本地），无需维护两份 schema。

---

## 四、实时能力说明

| 能力 | Node 版 | 本 PHP 版 |
| --- | --- | --- |
| 消息/好友/动态等实时推送 | WebSocket | **HTTP 轮询**（`/api/poll`，约 3 秒间隔） |
| 正在输入（typing） | WebSocket | `POST /api/typing` + 轮询下发 |
| 在线状态 | WebSocket 心跳 | `last_poll` 60 秒窗口判定 |

- 前端**无需任何配置**：WebSocket 连接失败 2 次后自动探测 `/api/poll`，探测成功即永久切换为轮询模式。
- 事件结构与 Node 版 WebSocket 推送**逐字段一致**（`message` / `presence` / `typing` / `moment:*` / `notification` …），前端订阅逻辑不变。

---

## 五、与完整版的差异（受免费主机限制）

- **邮件验证码**：免费主机无 SMTP，`send-code` 不真正发信；开启 `ALLOW_DEV_CODE` 时把验证码随响应回传（字段 `devCode`）。
- **腾讯云 IM / AI**：未集成对应云服务的部署会返回明确错误（"当前部署未启用腾讯云 IM / Jay AI"），不影响基础聊天功能。
- **上传上限**：单文件 10MB（InfinityFree 限制），已同步到 `UPLOAD_MAX_BYTES`。大视频请改用图床/对象存储外链。
- **无 cron / 无常驻进程**：所有清理、状态更新均按请求触发，不依赖定时任务。
