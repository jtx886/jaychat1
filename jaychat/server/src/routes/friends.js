import express from 'express';
import { db, now } from '../db.js';
import { requireAuth } from '../auth.js';
import {
  getUser, publicUser, areFriends, addFriend, createNotification, sendToUser, isBlocked,
} from '../store.js';
import { friendAddIm, friendDeleteIm, friendRemarkIm } from '../im-sync.js';

const router = express.Router();
router.use(requireAuth);

// 好友列表
router.get('/', (req, res) => {
  const rows = db
    .prepare(
      `SELECT u.*, f.remark FROM friendships f JOIN users u ON u.id = f.friend_id WHERE f.user_id = ? ORDER BY f.created_at ASC`,
    )
    .all(req.uid);
  res.json({
    friends: rows.map((u) => ({ ...publicUser(u), remark: u.remark || '' })),
  });
});

// 发送好友申请
router.post('/request', (req, res) => {
  const to = Number(req.body?.toUserId);
  const message = String(req.body?.message || '').slice(0, 60);
  if (!to || to === req.uid) return res.status(400).json({ error: '参数错误' });
  if (!getUser(to)) return res.status(404).json({ error: '用户不存在' });
  if (isBlocked(to, req.uid)) return res.status(403).json({ error: '对方已拒绝接收好友申请' });
  if (areFriends(req.uid, to)) return res.status(400).json({ error: '你们已经是好友了' });
  const dup = db
    .prepare(`SELECT id FROM friend_requests WHERE status='pending' AND from_id=? AND to_id=?`)
    .get(req.uid, to);
  if (dup) return res.status(400).json({ error: '已发送申请，等待对方验证' });
  db.prepare(`INSERT INTO friend_requests (from_id, to_id, message, status, created_at) VALUES (?,?,?,'pending',?)`).run(
    req.uid, to, message, now(),
  );
  const me = publicUser(getUser(req.uid));
  createNotification({ user_id: to, type: 'friend_request', actor_id: req.uid, text: `${me.username} 请求添加你为好友`, ref_type: 'friend_request' });
  sendToUser(to, { type: 'friend:request', data: { from: me, message } });
  res.json({ ok: true });
});

// 收到的好友申请
router.get('/requests', (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM friend_requests WHERE to_id = ? AND status='pending' ORDER BY id DESC`)
    .all(req.uid);
  res.json({
    requests: rows.map((r) => ({ id: r.id, message: r.message, created_at: r.created_at, from: publicUser(getUser(r.from_id)) })),
  });
});

// 我发出的申请（用于搜索结果显示状态）
router.get('/requests/sent', (req, res) => {
  const rows = db.prepare(`SELECT to_id FROM friend_requests WHERE from_id=? AND status='pending'`).all(req.uid);
  res.json({ ids: rows.map((r) => r.to_id) });
});

// 通过
router.post('/requests/:id/accept', (req, res) => {
  const r = db.prepare(`SELECT * FROM friend_requests WHERE id=? AND to_id=?`).get(Number(req.params.id), req.uid);
  if (!r || r.status !== 'pending') return res.status(400).json({ error: '申请不存在或已处理' });
  db.prepare(`UPDATE friend_requests SET status='accepted' WHERE id=?`).run(r.id);
  addFriend(r.from_id, r.to_id);
  friendAddIm(r.from_id, r.to_id).catch(() => {});
  const me = publicUser(getUser(req.uid));
  createNotification({ user_id: r.from_id, type: 'friend_accept', actor_id: req.uid, text: `${me.username} 通过了你的好友申请`, ref_type: 'friend' });
  sendToUser(r.from_id, { type: 'friend:accept', data: { user: me } });
  sendToUser(req.uid, { type: 'friend:new', data: { user: publicUser(getUser(r.from_id)) } });
  res.json({ ok: true });
});

// 拒绝
router.post('/requests/:id/reject', (req, res) => {
  const r = db.prepare(`SELECT * FROM friend_requests WHERE id=? AND to_id=?`).get(Number(req.params.id), req.uid);
  if (!r) return res.status(400).json({ error: '申请不存在' });
  db.prepare(`UPDATE friend_requests SET status='rejected' WHERE id=?`).run(r.id);
  res.json({ ok: true });
});

// 删除好友
router.delete('/:userId', (req, res) => {
  const f = Number(req.params.userId);
  db.prepare('DELETE FROM friendships WHERE user_id=? AND friend_id=?').run(req.uid, f);
  db.prepare('DELETE FROM friendships WHERE user_id=? AND friend_id=?').run(f, req.uid);
  friendDeleteIm(req.uid, f).catch(() => {});
  sendToUser(f, { type: 'friend:remove', data: { userId: req.uid } });
  res.json({ ok: true });
});

// 拉黑（同时解除好友关系）
router.post('/block', (req, res) => {
  const f = Number(req.body?.userId);
  if (!f || f === req.uid) return res.status(400).json({ error: '参数错误' });
  if (!getUser(f)) return res.status(404).json({ error: '用户不存在' });
  db.prepare('INSERT OR IGNORE INTO blocks (user_id, blocked_id, created_at) VALUES (?,?,?)').run(req.uid, f, now());
  db.prepare('DELETE FROM friendships WHERE user_id=? AND friend_id=?').run(req.uid, f);
  db.prepare('DELETE FROM friendships WHERE user_id=? AND friend_id=?').run(f, req.uid);
  db.prepare(`UPDATE friend_requests SET status='rejected' WHERE (from_id=? AND to_id=?) OR (from_id=? AND to_id=?)`).run(req.uid, f, f, req.uid);
  friendDeleteIm(req.uid, f).catch(() => {});
  sendToUser(f, { type: 'friend:remove', data: { userId: req.uid } });
  res.json({ ok: true });
});

// 黑名单列表
router.get('/blocks', (req, res) => {
  const rows = db
    .prepare(`SELECT u.*, b.created_at AS blocked_at FROM blocks b JOIN users u ON u.id = b.blocked_id WHERE b.user_id = ? ORDER BY b.created_at DESC`)
    .all(req.uid);
  res.json({ blocks: rows.map((u) => ({ ...publicUser(u), blocked_at: u.blocked_at })) });
});

// 解除拉黑
router.delete('/block/:userId', (req, res) => {
  const f = Number(req.params.userId);
  db.prepare('DELETE FROM blocks WHERE user_id=? AND blocked_id=?').run(req.uid, f);
  res.json({ ok: true });
});

// 设置好友备注
router.patch('/:userId', (req, res) => {
  const f = Number(req.params.userId);
  if (!areFriends(req.uid, f)) return res.status(400).json({ error: '对方不是你的好友' });
  const remark = String(req.body?.remark ?? '').slice(0, 20);
  db.prepare('UPDATE friendships SET remark=? WHERE user_id=? AND friend_id=?').run(remark, req.uid, f);
  friendRemarkIm(req.uid, f, remark).catch(() => {});
  res.json({ ok: true, remark });
});

export default router;
