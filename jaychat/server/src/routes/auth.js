import express from 'express';
import { db, now, joinOfficialGroup, OFFICIAL_GROUP_ID } from '../db.js';
import { hashPassword, verifyPassword, signToken, requireAuth, EMAIL_RE, validateUsername, validatePassword } from '../auth.js';
import { sendCodeMail } from '../mailer.js';
import { publicUser, selfUser, getUser } from '../store.js';
import { ensureUserIm, addMembersIm, syncUserProfileIm } from '../im-sync.js';

const router = express.Router();

const codeSentAt = new Map(); // email -> ts，简单限流

function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function checkCode(email, purpose, code) {
  const row = db
    .prepare(
      `SELECT * FROM verify_codes WHERE email = ? AND purpose = ? AND used = 0 AND expires_at > ? ORDER BY id DESC LIMIT 1`,
    )
    .get(email, purpose, now());
  if (!row) return '验证码不存在或已过期';
  if (row.code !== String(code).trim()) return '验证码错误';
  db.prepare('UPDATE verify_codes SET used = 1 WHERE id = ?').run(row.id);
  return null;
}

// 发送验证码（注册 / 找回密码）
router.post('/send-code', async (req, res) => {
  const { email, purpose = 'register' } = req.body || {};
  if (!EMAIL_RE.test(String(email || ''))) {
    return res.status(400).json({ error: '邮箱只支持 @qq.com 或 @163.com' });
  }
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (purpose === 'register' && exists) return res.status(400).json({ error: '该邮箱已注册，请直接登录' });
  if (purpose === 'reset' && !exists) return res.status(400).json({ error: '该邮箱尚未注册' });

  const last = codeSentAt.get(email) || 0;
  if (now() - last < 60_000) {
    return res.status(429).json({ error: `请 ${Math.ceil((60_000 - (now() - last)) / 1000)} 秒后再试` });
  }
  codeSentAt.set(email, now());

  const code = genCode();
  db.prepare(
    `INSERT INTO verify_codes (email, code, purpose, expires_at, used, created_at) VALUES (?,?,?,?,0,?)`,
  ).run(email, code, purpose, now() + 5 * 60_000, now());

  const r = await sendCodeMail(email, code, purpose);
  res.json({ ok: true, sent: r.sent, devCode: r.devCode || null, hint: r.sent ? '验证码已发送至邮箱' : '邮件发送失败，请稍后重试' });
});

// 注册
router.post('/register', async (req, res) => {
  const { username, email, password, code } = req.body || {};
  const nameErr = validateUsername(username);
  if (nameErr) return res.status(400).json({ error: nameErr });
  if (!EMAIL_RE.test(String(email || ''))) return res.status(400).json({ error: '邮箱只支持 @qq.com 或 @163.com' });
  const pwdErr = validatePassword(password);
  if (pwdErr) return res.status(400).json({ error: pwdErr });
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim())) {
    return res.status(400).json({ error: '该昵称已被使用' });
  }
  if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) {
    return res.status(400).json({ error: '该邮箱已注册' });
  }
  const codeErr = checkCode(email, 'register', code);
  if (codeErr) return res.status(400).json({ error: codeErr });

  const r = db
    .prepare(`INSERT INTO users (username, email, pwd, avatar, created_at) VALUES (?,?,?,?,?)`)
    .run(username.trim(), email, hashPassword(password), '', now());
  const uid = Number(r.lastInsertRowid);
  joinOfficialGroup(uid); // 新用户自动进入 Jay Chat 官方群

  // 同步到腾讯云 IM：注册账号 + 加入官方群
  try {
    await ensureUserIm(uid);
    await addMembersIm(OFFICIAL_GROUP_ID(), [uid]);
  } catch (e) {
    console.warn('[register] IM 同步失败', e.message);
  }

  const u = getUser(uid);
  res.json({ token: signToken(uid), user: selfUser(u) });
});

// 登录：用户名或邮箱 + 密码
router.post('/login', (req, res) => {
  const { account, password } = req.body || {};
  const acc = String(account || '').trim();
  if (!acc || !password) return res.status(400).json({ error: '请输入账号和密码' });
  const u = acc.includes('@')
    ? db.prepare('SELECT * FROM users WHERE email = ?').get(acc)
    : db.prepare('SELECT * FROM users WHERE username = ?').get(acc);
  if (!u) return res.status(400).json({ error: '账号不存在' });
  if (!verifyPassword(password, u.pwd)) return res.status(400).json({ error: '密码错误' });
  res.json({ token: signToken(u.id), user: selfUser(u) });
});

// 忘记密码：邮箱 + 验证码 + 新密码
router.post('/reset-password', (req, res) => {
  const { email, code, password } = req.body || {};
  if (!EMAIL_RE.test(String(email || ''))) return res.status(400).json({ error: '邮箱格式不正确' });
  const pwdErr = validatePassword(password);
  if (pwdErr) return res.status(400).json({ error: pwdErr });
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!u) return res.status(400).json({ error: '该邮箱尚未注册' });
  const codeErr = checkCode(email, 'reset', code);
  if (codeErr) return res.status(400).json({ error: codeErr });
  db.prepare('UPDATE users SET pwd = ? WHERE id = ?').run(hashPassword(password), u.id);
  res.json({ ok: true });
});

// 当前用户
router.get('/me', requireAuth, (req, res) => {
  const u = getUser(req.uid);
  if (!u) return res.status(404).json({ error: '用户不存在' });
  res.json({ user: selfUser(u) });
});

// 修改昵称 / 头像 / 签名（昵称一周最多改 2 次）
router.patch('/me', requireAuth, (req, res) => {
  const u = getUser(req.uid);
  const { username, avatar, bio } = req.body || {};
  if (username !== undefined && username !== u.username) {
    const err = validateUsername(username);
    if (err) return res.status(400).json({ error: err });
    const wk = weekKey();
    const count = u.name_week === wk ? u.name_count : 0;
    if (count >= 2) return res.status(400).json({ error: '昵称一周只能修改 2 次' });
    if (db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(username.trim(), u.id)) {
      return res.status(400).json({ error: '该昵称已被使用' });
    }
    db.prepare('UPDATE users SET username = ?, name_week = ?, name_count = ? WHERE id = ?').run(
      username.trim(), wk, count + 1, u.id,
    );
  }
  if (avatar !== undefined) db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(String(avatar), u.id);
  if (bio !== undefined) db.prepare('UPDATE users SET bio = ? WHERE id = ?').run(String(bio), u.id);
  if (username !== undefined || avatar !== undefined) syncUserProfileIm(u.id).catch(() => {});
  const nu = getUser(u.id);
  res.json({ user: selfUser(nu), remaining: nu.name_week === weekKey() ? Math.max(0, 2 - nu.name_count) : 2 });
});

router.post('/logout', requireAuth, (req, res) => {
  db.prepare('UPDATE users SET online = 0, last_seen = ? WHERE id = ?').run(now(), req.uid);
  res.json({ ok: true });
});

export default router;
