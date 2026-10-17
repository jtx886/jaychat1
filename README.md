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
  release/  已签名的正式 APK
```

## 本地运行

后端：

```bash
cd jaychat/server
npm install
node src/index.js        # 默认 http://0.0.0.0:3000
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

## 技术栈

- 实时聊天：腾讯云 IM（`@tencentcloud/chat`）+ 服务端 REST 同步（`tls-sig-api-v2`）
- 后端：Express + node:sqlite，邮件验证码使用 163 SMTP
- 前端：Vite + React 18，毛玻璃 UI
- 安卓：Capacitor 6，签名密钥 `web/android/app/jaychat-release.keystore`

## 下载

正式安装包见 [`jaychat/release/JayChat-v1.0-release.apk`](jaychat/release/JayChat-v1.0-release.apk)。
