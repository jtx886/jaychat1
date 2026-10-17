import express from 'express';
import { db, now } from '../db.js';
import { requireAuth } from '../auth.js';
import { getUser, publicUser, areFriends, friendIds, createNotification, sendToUsers } from '../store.js';
import { shapeMoment, canView } from './users.js';

const router = express.Router();
router.use(requireAuth);

const VISIBILITIES = ['public', 'private', 'friends', 'custom', 'exclude'];

// 发布动态
router.post('/', (req, res) => {
  const { text = '', media = [], visibility = 'public', allowIds = [], denyIds = [] } = req.body || {};
  const vis = VISIBILITIES.includes(visibility) ? visibility : 'public';
  const items = (Array.isArray(media) ? media : []).slice(0, 9).map((m) => ({
    url: String(m.url || ''),
    type: m.type === 'video' ? 'video' : 'image',
    thumb: String(m.thumb || ''),
  })).filter((m) => m.url);
  if (!String(text).trim() && !items.length) return res.status(400).json({ error: '请输入内容或选择图片/视频' });

  const r = db
    .prepare(
      `INSERT INTO moments (author_id, text, media, visibility, allow_ids, deny_ids, deleted, created_at)
       VALUES (?,?,?,?,?,?,0,?)`,
    )
    .run(
      req.uid, String(text).slice(0, 1000), JSON.stringify(items), vis,
      JSON.stringify((allowIds || []).map(Number)), JSON.stringify((denyIds || []).map(Number)), now(),
    );
  const m = db.prepare('SELECT * FROM moments WHERE id=?').get(r.lastInsertRowid);
  const shaped = shapeMoment(m, req.uid);

  // 通知好友（可见性为 public/friends 时）
  const targets = vis === 'private' ? [] : vis === 'custom' ? (allowIds || []).map(Number) : friendIds(req.uid);
  sendToUsers([...new Set([req.uid, ...targets])], { type: 'moment:new', data: shaped });
  res.json({ moment: shaped });
});

// 动态流
router.get('/', (req, res) => {
  const scope = String(req.query.scope || 'all');
  const uid = req.uid;
  const rows = db.prepare(`SELECT * FROM moments WHERE deleted = 0 ORDER BY id DESC LIMIT 300`).all();
  const list = rows
    .filter((m) => {
      if (scope === 'friends') {
        return m.author_id === uid || areFriends(uid, m.author_id);
      }
      return m.author_id === uid || canView(m, uid, areFriends(uid, m.author_id));
    })
    .map((m) => shapeMoment(m, uid));
  res.json({ moments: list, scope });
});

// 我的动态
router.get('/mine', (req, res) => {
  const rows = db.prepare(`SELECT * FROM moments WHERE author_id=? AND deleted=0 ORDER BY id DESC`).all(req.uid);
  res.json({ moments: rows.map((m) => shapeMoment(m, req.uid)) });
});

// 动态详情
router.get('/:id', (req, res) => {
  const m = db.prepare('SELECT * FROM moments WHERE id=? AND deleted=0').get(Number(req.params.id));
  if (!m) return res.status(404).json({ error: '动态不存在或已删除' });
  if (m.author_id !== req.uid && !canView(m, req.uid, areFriends(req.uid, m.author_id))) {
    return res.status(403).json({ error: '无权查看该动态' });
  }
  res.json({ moment: shapeMoment(m, req.uid) });
});

// 修改动态可见范围
router.patch('/:id', (req, res) => {
  const id = Number(req.params.id);
  const m = db.prepare('SELECT * FROM moments WHERE id=? AND deleted=0').get(id);
  if (!m) return res.status(404).json({ error: '动态不存在或已删除' });
  if (m.author_id !== req.uid) return res.status(403).json({ error: '只能修改自己的动态' });
  const { visibility, allowIds = [], denyIds = [] } = req.body || {};
  if (!VISIBILITIES.includes(visibility)) return res.status(400).json({ error: '可见范围不合法' });
  const allow = visibility === 'custom' ? allowIds.map(Number) : [];
  const deny = visibility === 'exclude' ? denyIds.map(Number) : [];
  if ((visibility === 'custom' || visibility === 'exclude') && !allow.length && !deny.length) {
    return res.status(400).json({ error: '请选择好友' });
  }
  db.prepare('UPDATE moments SET visibility=?, allow_ids=?, deny_ids=? WHERE id=?')
    .run(visibility, JSON.stringify(allow), JSON.stringify(deny), id);
  const shaped = shapeMoment(db.prepare('SELECT * FROM moments WHERE id=?').get(id), req.uid);
  sendToUsers([...new Set([req.uid, ...friendIds(req.uid)])], { type: 'moment:update', data: shaped });
  res.json({ moment: shaped });
});

// 删除动态
router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const m = db.prepare('SELECT * FROM moments WHERE id=?').get(id);
  if (!m) return res.status(404).json({ error: '动态不存在' });
  if (m.author_id !== req.uid) return res.status(403).json({ error: '只能删除自己的动态' });
  db.prepare('UPDATE moments SET deleted=1 WHERE id=?').run(id);
  sendToUsers(friendIds(req.uid), { type: 'moment:delete', data: { id } });
  res.json({ ok: true });
});

// 点赞 / 取消点赞
router.post('/:id/like', (req, res) => {
  const id = Number(req.params.id);
  const m = db.prepare('SELECT * FROM moments WHERE id=? AND deleted=0').get(id);
  if (!m) return res.status(404).json({ error: '动态不存在或已删除' });
  const liked = db.prepare('SELECT 1 FROM moment_likes WHERE moment_id=? AND user_id=?').get(id, req.uid);
  if (liked) {
    db.prepare('DELETE FROM moment_likes WHERE moment_id=? AND user_id=?').run(id, req.uid);
  } else {
    db.prepare('INSERT INTO moment_likes (moment_id, user_id, created_at) VALUES (?,?,?)').run(id, req.uid, now());
    if (m.author_id !== req.uid) {
      createNotification({
        user_id: m.author_id, type: 'moment_like', actor_id: req.uid,
        text: `${publicUser(getUser(req.uid)).username} 赞了你的动态`, ref_type: 'moment', ref_id: id,
      });
    }
  }
  const shaped = shapeMoment(db.prepare('SELECT * FROM moments WHERE id=?').get(id), req.uid);
  sendToUsers([...new Set([m.author_id, ...friendIds(req.uid), req.uid])], { type: 'moment:update', data: shaped });
  res.json({ moment: shaped });
});

// 评论 / 回复
router.post('/:id/comments', (req, res) => {
  const id = Number(req.params.id);
  const m = db.prepare('SELECT * FROM moments WHERE id=? AND deleted=0').get(id);
  if (!m) return res.status(404).json({ error: '动态不存在或已删除' });
  const content = String(req.body?.content || '').trim().slice(0, 300);
  if (!content) return res.status(400).json({ error: '评论内容不能为空' });
  const replyTo = Number(req.body?.replyToUserId || 0);
  const r = db
    .prepare(`INSERT INTO moment_comments (moment_id, user_id, content, reply_to_user, deleted, created_at) VALUES (?,?,?,?,0,?)`)
    .run(id, req.uid, content, replyTo || 0, now());
  const me = publicUser(getUser(req.uid));

  if (replyTo && replyTo !== req.uid) {
    createNotification({
      user_id: replyTo, type: 'comment_reply', actor_id: req.uid,
      text: `${me.username} 回复了你的评论：${content}`, ref_type: 'moment', ref_id: id,
    });
  }
  if (m.author_id !== req.uid) {
    createNotification({
      user_id: m.author_id, type: 'moment_comment', actor_id: req.uid,
      text: `${me.username} 评论了你的动态：${content}`, ref_type: 'moment', ref_id: id,
    });
  }
  db.prepare('UPDATE moments SET id=id WHERE id=?').run(id);
  const shaped = shapeMoment(db.prepare('SELECT * FROM moments WHERE id=?').get(id), req.uid);
  sendToUsers([...new Set([m.author_id, ...friendIds(req.uid), req.uid])], { type: 'moment:update', data: shaped });
  res.json({ moment: shaped, comment_id: Number(r.lastInsertRowid) });
});

// 删除评论（评论作者或动态作者可删，删除后所有用户都看不到）
router.delete('/:id/comments/:commentId', (req, res) => {
  const id = Number(req.params.id);
  const cid = Number(req.params.commentId);
  const m = db.prepare('SELECT * FROM moments WHERE id=?').get(id);
  const c = db.prepare('SELECT * FROM moment_comments WHERE id=? AND moment_id=?').get(cid, id);
  if (!m || !c) return res.status(404).json({ error: '评论不存在' });
  if (c.user_id !== req.uid && m.author_id !== req.uid) return res.status(403).json({ error: '无权删除该评论' });
  db.prepare('UPDATE moment_comments SET deleted=1 WHERE id=?').run(cid);
  const shaped = shapeMoment(m, req.uid);
  sendToUsers([...new Set([m.author_id, ...friendIds(req.uid), req.uid])], { type: 'moment:update', data: shaped });
  res.json({ ok: true, moment: shaped });
});

export default router;
