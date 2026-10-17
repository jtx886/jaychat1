import express from 'express';
import cors from 'cors';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { PORT, PUBLIC_DIR, ROOT, DEV_MODE } from './config.js';
import { db, seedOfficial } from './db.js';
import { initRealtime } from './realtime.js';
import authRoutes from './routes/auth.js';
import usersRouter from './routes/users.js';
import friendsRouter from './routes/friends.js';
import groupsRouter from './routes/groups.js';
import messagesRouter from './routes/messages.js';
import momentsRouter from './routes/moments.js';
import notificationsRouter from './routes/notifications.js';
import imRouter from './routes/im.js';
import { initIM } from './im.js';
import { ensureGroupIm, ensureAiInOfficialGroup } from './im-sync.js';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// 静态资源：上传的媒体 + 官方素材
app.use('/uploads', express.static(path.join(PUBLIC_DIR, 'uploads'), { maxAge: '7d' }));
app.use('/assets', express.static(path.join(PUBLIC_DIR, 'assets'), { maxAge: '1d' }));

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, name: 'Jay Chat', time: Date.now(), dev_mode: DEV_MODE }),
);

// 在线状态批量查询（联系人/首页实时刷新兜底）
app.get('/api/presence', (req, res) => {
  const ids = String(req.query.ids || '')
    .split(',')
    .map(Number)
    .filter(Boolean);
  const rows = ids.length
    ? db.prepare(`SELECT id, online, last_seen FROM users WHERE id IN (${ids.map(() => '?').join(',')})`).all(...ids)
    : [];
  res.json({ presence: rows.map((r) => ({ userId: r.id, online: !!r.online, last_seen: r.last_seen })) });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRouter);
app.use('/api/friends', friendsRouter);
app.use('/api/groups', groupsRouter);
app.use('/api', messagesRouter); // /api/conversations /api/messages /api/upload
app.use('/api/moments', momentsRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api', imRouter); // /api/im/usersig、/api/ai/ask

// 前端构建产物（生产环境同一域名提供，App 内也可指向它）
const WEB_DIST = path.resolve(ROOT, '..', 'web', 'dist');
if (fs.existsSync(WEB_DIST)) {
  // 静态资源长缓存，但入口 html 必须每次校验，避免升级后仍加载旧包
  app.use(
    express.static(WEB_DIST, {
      maxAge: '1h',
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
      },
    }),
  );
  app.get(/^(?!\/api|\/uploads|\/assets|\/ws).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(WEB_DIST, 'index.html'));
  });
}

app.use((err, _req, res, _next) => {
  console.error('[error]', err?.message);
  res.status(500).json({ error: err?.message || '服务器内部错误' });
});

const server = http.createServer(app);
initRealtime(server);
const { group: officialGroup } = seedOfficial();

// 启动后异步初始化腾讯云 IM：管理员/AI 账号、官方群同步
(async () => {
  const okInit = await initIM();
  if (!okInit) return;
  await ensureGroupIm(officialGroup.id);
  await ensureAiInOfficialGroup();
})().catch((e) => console.warn('[boot] IM 初始化失败', e.message));

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  Jay Chat server 运行中 →  http://0.0.0.0:${PORT}  (ws://<host>:${PORT}/ws)\n`);
});
