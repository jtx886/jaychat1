#!/usr/bin/env bash
# Jay Chat 服务端一键部署脚本（Ubuntu / Debian）
# 用法：在仓库的 jaychat 目录下执行  sudo bash deploy/install.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

echo "==> Jay Chat 部署目录：$ROOT"

if [[ "$(id -u)" != "0" ]]; then
  echo "请使用 root 或 sudo 运行：sudo bash deploy/install.sh" >&2
  exit 1
fi

# ---------- 1. 安装 Docker ----------
if ! command -v docker >/dev/null 2>&1; then
  echo "==> 未检测到 Docker，开始安装…"
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker
else
  echo "==> 已安装 Docker：$(docker --version)"
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "==> 安装 docker compose 插件…"
  apt-get update -y && apt-get install -y docker-compose-plugin
fi

# ---------- 2. 准备 .env ----------
if [[ ! -f .env ]]; then
  echo "==> 生成 .env（并随机化 JWT_SECRET）"
  cp .env.example .env
  SECRET="$(head -c 48 /dev/urandom | base64 | tr -d '\n/+=' | cut -c1-48)"
  # 兼容 GNU/BSD sed
  sed -i.bak "s|^JWT_SECRET=.*|JWT_SECRET=${SECRET}|" .env && rm -f .env.bak
  echo "    JWT_SECRET 已随机生成；如需修改 SMTP/IM/AI 密钥请编辑 .env"
else
  echo "==> 检测到已有 .env，保持不变"
fi

# 数据与上传目录（绑定挂载需要存在）
mkdir -p deploy/data deploy/uploads

# ---------- 3. 端口放行 ----------
echo "==> 放行端口 3000"
if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
  ufw allow 3000/tcp || true
fi
# Oracle Cloud 等镜像默认 iptables 会拦截，追加放行
if command -v iptables >/dev/null 2>&1; then
  iptables -C INPUT -p tcp --dport 3000 -j ACCEPT 2>/dev/null \
    || iptables -I INPUT -p tcp --dport 3000 -j ACCEPT || true
  command -v netfilter-persistent >/dev/null 2>&1 && netfilter-persistent save || true
fi

# ---------- 4. 构建并启动 ----------
echo "==> 构建镜像并启动服务…"
docker compose up -d --build

IP="$(curl -fsS -m 5 https://api.ipify.org || true)"
echo
echo "==================== 部署完成 ===================="
echo " 健康检查：curl http://${IP:-<服务器IP>}:3000/api/health"
echo " 浏览器访问：http://${IP:-<服务器IP>}:3000"
echo " APP 内设置：我的 → 服务器地址 → http://${IP:-<服务器IP>}:3000 → 测试连接"
echo "--------------------------------------------------"
echo " 查看日志：docker compose logs -f"
echo " 更新版本：git pull && docker compose up -d --build"
echo "=================================================="
echo
echo "提示：若使用 Oracle/AWS/阿里云等，还需在其控制台「安全组/安全列表」放行 TCP 3000。"
