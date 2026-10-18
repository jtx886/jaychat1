# Jay Chat 服务端镜像（构建上下文 = 仓库根目录）
# 适用于 CloudBase 云托管 / Render / Railway 等以仓库根目录为构建上下文的平台
FROM node:24-alpine

WORKDIR /app

# 仅安装生产依赖
COPY jaychat/server/package.json jaychat/server/package-lock.json ./
RUN npm ci --omit=dev

# 源码与静态素材
COPY jaychat/server/src ./src
COPY jaychat/server/public ./public

# 网页版前端产物（服务端同域名托管）
COPY jaychat/web/dist /web/dist

ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/app/data

EXPOSE 3000

# 数据持久化（容器本地磁盘是临时的，重新部署 / 缩容到 0 唤醒 / 重启都会清空）：
# 方案 A（推荐，免付费）：配置腾讯云对象存储 COS 环境变量
#   COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET / COS_REGION
#   → 上传媒体直接存 COS；SQLite 数据库定时快照到 COS，容器启动时自动恢复
# 方案 B：把持久卷挂到下面两个路径（CloudBase 需开通「私有网络 + 存储挂载 CFS」，属付费能力）
#   /app/data           → SQLite 数据库 jaychat.db
#   /app/public/uploads → 上传的图片与视频（未配置 COS 时的本地兜底）
VOLUME ["/app/data", "/app/public/uploads"]

CMD ["node", "src/boot.js"]
