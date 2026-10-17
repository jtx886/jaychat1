import crypto from 'node:crypto';
import { JWT_SECRET, TOKEN_TTL } from './config.js';

export function hashPassword(pwd) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(pwd), salt, 32).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(pwd, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const calc = crypto.scryptSync(String(pwd), salt, 32).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(calc, 'hex'));
  } catch {
    return false;
  }
}

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url');

export function signToken(uid) {
  const payload = b64({ uid, exp: Date.now() + TOKEN_TTL });
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyToken(token) {
  if (!token || !token.includes('.')) return null;
  const [payload, sig] = token.split('.');
  const expect = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('base64url');
  if (sig !== expect) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (!data.exp || data.exp < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : req.query.token;
  const data = verifyToken(token);
  if (!data) return res.status(401).json({ error: '未登录或登录已过期' });
  req.uid = data.uid;
  next();
}

export const EMAIL_RE = /^[A-Za-z0-9._%+-]+@(qq\.com|163\.com)$/;

export function validateUsername(name) {
  if (typeof name !== 'string') return '昵称不能为空';
  const s = name.trim();
  if (s.length < 1 || s.length > 6) return '昵称只能为 1-6 个字符';
  if (/\s/.test(s)) return '昵称不能包含空格';
  return null;
}

export function validatePassword(pwd) {
  if (typeof pwd !== 'string' || pwd.length < 6) return '密码至少 6 位';
  if (pwd.length > 32) return '密码最多 32 位';
  return null;
}
