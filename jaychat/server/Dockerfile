# Jay Chat 服务端镜像（Node 24，内置 node:sqlite）
FROM node:24-alpine

WORKDIR /app

# 仅安装生产依赖
COPY server/package.json server/package-lock.json ./
RUN npm ci --omit=dev

# 源码与静态素材
COPY server/src ./src
COPY server/public ./public

# 网页版前端产物（服务端会以同一域名托管，浏览器/内置浏览器可直接访问）
COPY web/dist /web/dist

ENV NODE_ENV=production \
    PORT=3000

EXPOSE 3000

# 数据持久化：配置 COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET / COS_REGION 后
# 媒体与数据库会自动存到腾讯云 COS；也可挂载卷到下面两个路径
VOLUME ["/app/data", "/app/public/uploads"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/boot.js"]
