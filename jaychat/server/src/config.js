import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
export const PUBLIC_DIR = path.join(ROOT, 'public');

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(PUBLIC_DIR, 'uploads'), { recursive: true });

export const PORT = Number(process.env.PORT || 3000);

// 鉴权签名密钥：部署时请务必通过环境变量覆盖
export const JWT_SECRET = process.env.JWT_SECRET || 'jaychat-dev-secret-change-me';
export const TOKEN_TTL = 1000 * 60 * 60 * 24 * 30; // 30 天

// 开发模式：SMTP 不可用时，验证码会随接口返回并在控制台打印（仅用于本地/沙箱测试）
export const DEV_MODE = String(process.env.DEV_MODE ?? 'true') !== 'false';

export const SMTP = {
  host: process.env.SMTP_HOST || 'smtp.163.com',
  port: Number(process.env.SMTP_PORT || 465),
  secure: true,
  user: process.env.SMTP_USER || 'jtxnb886@163.com',
  pass: process.env.SMTP_PASS || 'FLLRDtadYAfGXp9Y',
  from: process.env.SMTP_FROM || 'jtxnb886@163.com',
  fromName: process.env.SMTP_FROM_NAME || 'Jay Chat',
};

// 智谱 GLM-4-Flash（Jay AI）
export const AI = {
  url: process.env.AI_URL || 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
  key: process.env.AI_KEY || 'd63d18de6bcf4a92a13a78696e401e83.0MIXAf8ANp2tG9BD',
  model: process.env.AI_MODEL || 'glm-4-flash',
};

export const OFFICIAL_GROUP_NAME = 'Jay Chat官方群';
export const OFFICIAL_ACCOUNT = {
  username: '杰同学',
  email: 'xujszjjzjzjxhxhh@qq.com',
  password: '101113',
};
export const AI_NAME = 'Jay AI';

// 腾讯云即时通信 IM（服务端 REST + UserSig）
export const IM = {
  sdkAppId: Number(process.env.IM_SDKAPPID || 1600167563),
  secretKey: process.env.IM_SECRETKEY || '905e603b25e4407fc8996a45df3ecee66f098c38b3313031b2d82c8426ef16ba',
  admin: process.env.IM_ADMIN || 'administrator', // 调用服务端 REST 的标识账号
  aiAccount: process.env.IM_AI_ACCOUNT || 'jayai', // 群内 Jay AI 机器人账号
  expire: Number(process.env.IM_SIG_EXPIRE || 180 * 86400),
  get enabled() {
    return !!this.sdkAppId && !!this.secretKey;
  },
};

/** 业务用户 id → 腾讯云 IM UserID（仅含字母数字与下划线，1-32 位） */
export const imUserId = (userId) => `jc${userId}`;
