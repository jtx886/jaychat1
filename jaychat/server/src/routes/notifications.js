import express from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { publicUser, getUser } from '../store.js';

const router = express.Router();
router.use(requireAuth);

// 通知列表 + 未读数
router.get('/', (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 200`)
    .all(req.uid);
  const list = rows.map((n) => ({
    id: n.id,
    type: n.type,
    text: n.text,
    read: !!n.read,
    ref_type: n.ref_type,
    ref_id: n.ref_id,
    created_at: n.created_at,
    actor: n.actor_id ? publicUser(getUser(n.actor_id)) : null,
  }));
  const unread = db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id=? AND read=0').get(req.uid).c;
  res.json({ notifications: list, unread });
});

router.get('/unread', (req, res) => {
  const unread = db.prepare('SELECT COUNT(*) c FROM notifications WHERE user_id=? AND read=0').get(req.uid).c;
  res.json({ unread });
});

// 全部标记为已读（红点消失）
router.post('/read', (req, res) => {
  db.prepare('UPDATE notifications SET read=1 WHERE user_id=?').run(req.uid);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM notifications WHERE id=? AND user_id=?').run(Number(req.params.id), req.uid);
  res.json({ ok: true });
});

export default router;
