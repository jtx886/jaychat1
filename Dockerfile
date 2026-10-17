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
    PORT=3000

EXPOSE 3000

CMD ["node", "src/index.js"]
