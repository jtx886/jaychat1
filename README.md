# Jay Chat

一款毛玻璃风格、支持跨网络跨区域实时聊天的 IM 应用，聊天内核基于 **腾讯云 IM**，前端为 Vite + React 18，安卓端由 Capacitor 打包。

## 功能

- 注册 / 登录（昵称 1–6 字符，邮箱仅支持 `@qq.com` / `@163.com`，邮箱验证码）
- 自动登录、忘记密码（邮箱验证码重置）
- 底部导航：首页 / 联系人 / 我的
- 首页：会话列表（官方群 + 好友），右上角 `+` 添加好友 / 创建群聊，左上角铃铛通知（红点未读）
- 官方群「Jay Chat 官方群」：新用户自动加入、不可退群，群主为官方账号「杰同学」
- 群聊：@Jay AI（GLM-4-Flash）机器人、在线人数、在线成员列表、群信息编辑（群名 / 群头像）、邀请好友、踢人 / 设管理员 / 禁言 / 转让群主 / 退群、消息免打扰
- 私聊：删除好友、好友资料备注、查看好友动态、消息免打扰、已读回执
- 消息：文本 / 图片 / 视频 / 一次性（阅后即焚）/ Emoji + 动画表情、长按撤回（3 分钟内）/ 复制 / 删除
- 动态：社区动态、好友动态、发布图文 / 视频（公开 / 私密 / 指定可见 / 不给谁看）、点赞与评论、回复 / 删除评论并通知
- 通知：好友申请通过、点赞、评论、被回复

## 目录结构

```
jaychat/
  server/   Node.js (Express) 后端：账号、好友、群组、动态、通知、Jay AI、腾讯云 IM 服务端同步
  web/      前端 (Vite + React) + Capacitor 安卓工程
  deploy/   一键部署脚本（Docker）
  release/  已签名的正式 APK
  docker-compose.yml
```

---

## 一、部署后端（免费云主机，一次配好永久可用）

> 聊天本身由腾讯云 IM 直连（跨网络实时）；后端负责注册登录、动态、通知、UserSig 与 Jay AI。
> 下面以 **Ubuntu / Debian 云主机**（如 Oracle Cloud「始终免费」、其他厂商免费试用机）为例。

```bash
# 1. 在云主机上拿到代码
git clone https://github.com/jtx886/jaychat1.git
cd jaychat1/jaychat

# 2. 一键部署（自动装 Docker、生成 .env、构建启动）
sudo bash deploy/install.sh
```

脚本结束后会打印访问地址。随后：

```bash
docker compose logs -f          # 看日志
git pull && docker compose up -d --build   # 更新版本
```

**放行端口**：脚本会自动处理 ufw / iptables；若用 Oracle / 阿里云 / AWS，还需在控制台「安全组 / 安全列表」放行 **TCP 3000**。

**环境变量**：首次运行会由 `.env.example` 生成 `.env` 并随机化 `JWT_SECRET`。SMTP / 腾讯云 IM / AI 密钥已在其中，可按需修改后 `docker compose up -d`。

**可选 HTTPS**：有自己域名时，编辑 `.env` 填 `DOMAIN=你的域名`，并取消 `docker-compose.yml` 中 `caddy` 段的注释，即自动申请证书，访问 `https://你的域名`。

## 二、让 App 连上后端

安装 APK 后：**我的 → 服务器地址 → 填 `http://<服务器IP>:3000` →（可选）内置浏览器访问该地址看「Jay Chat 运行中」）→ 测试连接成功**即可。后端同一端口也托管了网页版，手机浏览器可直接访问使用。

> 想免去手动填写，可在构建时注入默认地址：`VITE_API_BASE=http://<服务器IP>:3000 npm run build`。

## 三、本地开发

后端：

```bash
cd jaychat/server
npm install
node src/index.js        # http://0.0.0.0:3000
```

前端：

```bash
cd jaychat/web
npm install
npm run dev              # 开发
npm run build            # 构建到 dist/
```

打包安卓 APK（需 JDK 17 + Android SDK 35）：

```bash
cd jaychat/web
npm run build
npx cap sync android
cd android
gradle assembleRelease   # 产物：app/build/outputs/apk/release/app-release.apk
```

## 四、技术栈

- 实时聊天：腾讯云 IM（`@tencentcloud/chat`）+ 服务端 REST 同步（`tls-sig-api-v2`）
- 后端：Express + node:sqlite，邮件验证码使用 163 SMTP
- 前端：Vite + React 18，毛玻璃 UI
- 部署：Docker + docker compose，数据持久化在 `deploy/data`、`deploy/uploads`
- 安卓：Capacitor 6，签名密钥 `web/android/app/jaychat-release.keystore`

## 下载

正式安装包见 [`jaychat/release/JayChat-v1.0-release.apk`](jaychat/release/JayChat-v1.0-release.apk)。
