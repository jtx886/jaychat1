# Jay Chat · InfinityFree 免费主机部署版（PHP + MySQL）

把 Jay Chat 从 Node.js 后端移植为 **纯 PHP + MySQL** 版本，可部署在 InfinityFree 等只支持
PHP 的免费虚拟主机上。前端与 Node 版**完全共用同一份构建产物**，接口契约逐字段一致。

> 免费主机限制：只支持 PHP 8.x，**不支持** Node.js / WebSocket / 常驻进程 / cron / SSH，
> 单文件上传上限 10MB。因此实时推送降级为 **HTTP 轮询**，前端会自动探测并切换。

---

## 一、一键部署（3 步）

1. **上传文件**：把 **`htdocs/` 里的全部内容**上传到站点的 `htdocs/` 目录（保持目录结构）。
2. **建数据库**：InfinityFree 控制面板 → **MySQL Databases** → 创建数据库，
   记下 Host / Database / Username / Password 四项。
3. **打开安装**：浏览器访问 `https://你的域名/install.php`，填入上面四项，点「开始安装」。

安装向导会自动：连接测试 → 建表 → 初始化官方账号与官方群 → 写入 `lib/config.local.php`。
完成后点「进入 Jay Chat」即可使用（官方账号 `杰同学` / 密码 `101113`）。

> 未安装时，前端调用接口会收到明确提示并自动跳转到 `install.php`，不会再出现空白 500。

---

## 二、目录结构

```
infinityfree/
├── README.md
├── config.sample.php          # 手动配置示例（也可完全用 install.php 向导，无需此文件）
├── database/
│   └── schema.sql             # MySQL 建表脚本（向导会自动建表，此文件仅备用）
└── htdocs/                    # ← 这部分整体上传到主机的 htdocs 目录
    ├── install.php            # 一键安装向导
    ├── index.php              # 入口（前端 + /api 分发）
    ├── .htaccess              # 重写规则（/api 分发、静态直出、SPA 兜底）
    ├── index.html             # 前端页面
    ├── assets/                # 前端 JS/CSS（构建产物）
    ├── logo.svg / logo-192.png
    ├── api/                   # 业务模块（auth/users/friends/groups/messages/…）
    ├── lib/                   # 框架：配置、PDO、鉴权、SQL 构建、事件总线
    └── uploads/               # 用户上传目录（已放 .htaccess 禁止执行脚本）
```

> GitHub Releases 里下载的 zip **只包含 `htdocs/` 的内容**（解压即上传，无多余文件）。

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
- 事件结构与 Node 版 WebSocket 推送**逐字段一致**（`message` / `presence` / `typing` / `moment:*` / `notification` …）。

---

## 五、与完整版的差异（受免费主机限制）

- **邮件验证码**：免费主机无 SMTP，`send-code` 不真正发信；开启 `ALLOW_DEV_CODE` 时把验证码随响应回传（字段 `devCode`）。
- **腾讯云 IM / AI**：未集成对应云服务的部署会返回明确错误，不影响基础聊天功能。
- **上传上限**：单文件 10MB（InfinityFree 限制），已同步到 `UPLOAD_MAX_BYTES`。
- **无 cron / 无常驻进程**：所有清理、状态更新均按请求触发。
