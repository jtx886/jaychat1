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

# 必须挂载持久存储，否则容器重建（重新部署 / 缩容到 0 后唤醒 / 重启）会清空数据：
#   /app/data           → SQLite 数据库 jaychat.db（用户 / 好友 / 群 / 消息 / 动态）
#   /app/public/uploads → 上传的图片与视频
# CloudBase 云托管请在控制台「存储挂载 / 文件存储(CFS)」把持久卷挂到以上两个路径
VOLUME ["/app/data", "/app/public/uploads"]

CMD ["node", "src/index.js"]
