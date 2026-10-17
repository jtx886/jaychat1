import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { getUser, publicUser, areFriends, safeJson } from '../store.js';

const router = express.Router();
router.use(requireAuth);

// 搜索用户（按昵称）
router.get('/search', (req, res) => {
  const q = String(req.query.q || '').trim();
  if (!q) return res.json({ users: [] });
  const rows = db
    .prepare(`SELECT * FROM users WHERE username LIKE ? AND id != ? ORDER BY is_official DESC, id ASC LIMIT 20`)
    .all(`%${q}%`, req.uid);
  const users = rows.map((u) => {
    const p = publicUser(u);
    p.is_friend = areFriends(req.uid, u.id);
    const pending = db
      .prepare(`SELECT id, from_id, to_id FROM friend_requests WHERE status='pending' AND ((from_id=? AND to_id=?) OR (from_id=? AND to_id=?)) LIMIT 1`)
      .get(req.uid, u.id, u.id, req.uid);
    p.request = pending ? { id: pending.id, direction: pending.from_id === req.uid ? 'out' : 'in' } : null;
    return p;
  });
  res.json({ users });
});

// 用户资料
router.get('/:id', (req, res) => {
  const u = getUser(Number(req.params.id));
  if (!u) return res.status(404).json({ error: '用户不存在' });
  const remark = db.prepare('SELECT remark FROM friendships WHERE user_id=? AND friend_id=?').get(req.uid, u.id)?.remark || '';
  res.json({ user: { ...publicUser(u), remark, is_friend: areFriends(req.uid, u.id) } });
});

// 好友（或本人）可看到的动态
router.get('/:id/moments', (req, res) => {
  const target = Number(req.params.id);
  const self = target === req.uid;
  const isFriend = areFriends(req.uid, target);
  const rows = db
    .prepare(`SELECT * FROM moments WHERE author_id = ? AND deleted = 0 ORDER BY id DESC LIMIT 200`)
    .all(target);
  const list = rows.filter((m) => self || canView(m, req.uid, isFriend)).map((m) => shapeMoment(m, req.uid));
  res.json({ moments: list, is_friend: isFriend, is_self: self });
});

export function canView(m, viewerId, isFriend) {
  if (m.deleted || m.visibility === 'private') return false;
  if (m.author_id === viewerId) return true;
  const allow = safeJson(m.allow_ids) || [];
  const deny = safeJson(m.deny_ids) || [];
  if (m.visibility === 'friends') return !!isFriend;
  if (m.visibility === 'custom') return allow.includes(viewerId);
  if (m.visibility === 'exclude') return isFriend && !deny.includes(viewerId);
  return true; // public
}

export function shapeMoment(m, viewerId) {
  const author = publicUser(getUser(m.author_id));
  const media = safeJson(m.media) || [];
  const likes = db.prepare('SELECT user_id, created_at FROM moment_likes WHERE moment_id = ?').all(m.id).map((l) => ({
    user: publicUser(getUser(l.user_id)),
    created_at: l.created_at,
  }));
  const comments = db
    .prepare('SELECT * FROM moment_comments WHERE moment_id = ? AND deleted = 0 ORDER BY id ASC')
    .all(m.id)
    .map((c) => ({
      id: c.id,
      user: publicUser(getUser(c.user_id)),
      content: c.content,
      reply_to_user: c.reply_to_user ? publicUser(getUser(c.reply_to_user)) : null,
      created_at: c.created_at,
      is_mine: c.user_id === viewerId,
    }));
  return {
    id: m.id,
    author,
    text: m.text,
    media,
    visibility: m.visibility,
    created_at: m.created_at,
    likes,
    liked: likes.some((l) => l.user?.id === viewerId),
    comments,
    is_mine: m.author_id === viewerId,
    is_friend: areFriends(viewerId, m.author_id),
  };
}

export { router as usersRouter, canView as _canView };
export default router;
