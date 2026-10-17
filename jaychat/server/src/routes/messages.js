import express from 'express';
import multer from 'multer';
import path from 'node:path';
import crypto from 'node:crypto';
import { db, now } from '../db.js';
import { requireAuth } from '../auth.js';
import { PUBLIC_DIR, OFFICIAL_GROUP_NAME } from '../config.js';
import {
  getUser, publicUser, areFriends, dmConvId, memberRole, groupMembers, buildMessage,
  convParticipants, sendToUser, sendToUsers, safeJson,
} from '../store.js';
import { isOnline } from '../realtime.js';
import { askAI, AI_SYSTEM_PROMPT } from '../ai.js';
import { relayChatEvent } from '../im-sync.js';

const router = express.Router();

/* ------------------------------- 媒体上传 ------------------------------- */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, path.join(PUBLIC_DIR, 'uploads')),
  filename: (_req, file, cb) => {
    const ext = (path.extname(file.originalname) || '').slice(0, 10).toLowerCase() || '.bin';
    cb(null, `${Date.now()}_${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});
const upload = multer({ storage, limits: { fileSize: 60 * 1024 * 1024 } });

router.post('/upload', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '未收到文件' });
  const kind = String(req.body?.kind || (req.file.mimetype.startsWith('video') ? 'video' : 'image'));
  res.json({ url: `/uploads/${req.file.filename}`, thumb: '', kind, size: req.file.size, mime: req.file.mimetype });
});

/* ------------------------------- 会话列表 ------------------------------- */
function lastMessage(convType, convId) {
  return db
    .prepare(`SELECT * FROM messages WHERE conv_type=? AND conv_id=? AND recalled=0 ORDER BY id DESC LIMIT 1`)
    .get(convType, convId);
}

function unreadCount(convType, convId, uid) {
  const rows = db
    .prepare(
      `SELECT id, one_time FROM messages WHERE conv_type=? AND conv_id=? AND sender_id != ? AND recalled = 0
       AND id NOT IN (SELECT message_id FROM message_reads WHERE user_id = ?)`,
    )
    .all(convType, convId, uid, uid);
  return rows.filter((r) => !(r.one_time && isBurned(r.id, uid))).length;
}

function isBurned(messageId, uid) {
  return !!db.prepare('SELECT 1 FROM message_burns WHERE message_id=? AND user_id=?').get(messageId, uid);
}

router.use(requireAuth);

router.get('/conversations', (req, res) => {
  const uid = req.uid;
  const list = [];

  // 群聊
  const groups = db
    .prepare(`SELECT g.*, m.dnd FROM group_members m JOIN groups g ON g.id=m.group_id WHERE m.user_id=?`)
    .all(uid);
  groups.forEach((g) => {
    const lm = lastMessage('group', String(g.id));
    const members = groupMembers(g.id);
    list.push({
      key: `group_${g.id}`,
      conv_type: 'group',
      conv_id: String(g.id),
      name: g.name,
      avatar: g.avatar || '',
      is_official: !!g.is_official,
      dnd: !!g.dnd,
      member_count: members.length,
      online_count: members.filter((m) => isOnline(m.user_id)).length,
      unread: unreadCount('group', String(g.id), uid),
      last: lm ? previewOf(lm) : null,
      last_time: lm?.created_at || g.created_at,
      sort_time: lm?.created_at || g.created_at,
    });
  });

  // 私聊（所有好友 + 已有私聊记录的非好友）
  const friends = db
    .prepare(`SELECT u.*, f.remark FROM friendships f JOIN users u ON u.id=f.friend_id WHERE f.user_id=?`)
    .all(uid);
  const seen = new Set();
  friends.forEach((f) => {
    const cid = dmConvId(uid, f.id);
    seen.add(cid);
    const lm = lastMessage('dm', cid);
    list.push({
      key: `dm_${cid}`,
      conv_type: 'dm',
      conv_id: cid,
      name: f.remark || f.username,
      avatar: f.avatar || '',
      is_official: !!f.is_official,
      peer: publicUser(f),
      online: isOnline(f.id),
      dnd: !!db.prepare('SELECT dnd FROM dm_dnd WHERE user_id=? AND peer_id=?').get(uid, f.id)?.dnd,
      unread: unreadCount('dm', cid, uid),
      last: lm ? previewOf(lm) : null,
      last_time: lm?.created_at || 0,
      sort_time: lm?.created_at || 0,
    });
  });

  // 历史私聊但已非好友
  const dmRows = db
    .prepare(`SELECT DISTINCT conv_id FROM messages WHERE conv_type='dm' AND (conv_id LIKE ? OR conv_id LIKE ?)`)
    .all(`%_${uid}`, `${uid}_%`);
  dmRows.forEach((r) => {
    if (seen.has(r.conv_id)) return;
    const peerId = Number(String(r.conv_id).split('_').find((x) => Number(x) !== uid));
    const peer = getUser(peerId);
    if (!peer) return;
    const lm = lastMessage('dm', r.conv_id);
    list.push({
      key: `dm_${r.conv_id}`,
      conv_type: 'dm',
      conv_id: r.conv_id,
      name: peer.username,
      avatar: peer.avatar || '',
      peer: publicUser(peer),
      online: isOnline(peerId),
      dnd: false,
      unread: unreadCount('dm', r.conv_id, uid),
      last: lm ? previewOf(lm) : null,
      last_time: lm?.created_at || 0,
      sort_time: lm?.created_at || 0,
    });
  });

  list.sort((a, b) => b.sort_time - a.sort_time);
  const totalUnread = list.reduce((s, c) => s + (c.unread || 0), 0);
  res.json({ conversations: list, total_unread: totalUnread, official_group_id: db.prepare('SELECT id FROM groups WHERE is_official=1').get()?.id || 0 });
});

function previewOf(m) {
  let text = m.content || '';
  if (m.msg_type === 'image') text = '[图片]';
  if (m.msg_type === 'video') text = '[视频]';
  if (m.msg_type === 'sticker') text = '[动画表情]';
  if (m.one_time) text = '[一次性消息]';
  const sender = m.sender_id === 0 ? 'Jay AI' : publicUser(getUser(m.sender_id))?.username || '';
  return { text, sender, msg_type: m.msg_type, one_time: !!m.one_time, created_at: m.created_at };
}

/* ------------------------------- 消息历史 ------------------------------- */
router.get('/messages', (req, res) => {
  const uid = req.uid;
  const convType = String(req.query.convType || 'dm');
  const convId = String(req.query.convId || '');
  if (!convId) return res.status(400).json({ error: '缺少会话 ID' });
  if (!checkAccess(uid, convType, convId)) return res.status(403).json({ error: '无权访问该会话' });

  const before = Number(req.query.before || 0);
  const limit = Math.min(Number(req.query.limit || 60), 200);
  const rows = db
    .prepare(
      `SELECT * FROM messages WHERE conv_type=? AND conv_id=? ${before ? 'AND id < ?' : ''} ORDER BY id DESC LIMIT ?`,
    )
    .all(...(before ? [convType, convId, before, limit] : [convType, convId, limit]));

  const list = rows
    .reverse()
    .filter((m) => !(m.one_time && m.sender_id !== uid && isBurned(m.id, uid)))
    .map((m) => buildMessage(m));

  if (String(req.query.markRead || 'true') !== 'false') {
    markReadBulk(uid, rows.filter((m) => m.sender_id !== uid).map((m) => m.id), convType, convId);
  }
  res.json({ messages: list, has_more: rows.length >= limit });
});

function checkAccess(uid, convType, convId) {
  if (convType === 'group') return !!memberRole(Number(convId), uid);
  const parts = convId.split('_').map(Number);
  if (!parts.includes(uid)) return false;
  const peer = parts.find((x) => x !== uid);
  const peerU = getUser(peer);
  return areFriends(uid, peer) || peerU?.is_official;
}

function markReadBulk(uid, ids, convType, convId) {
  if (!ids.length) return;
  const stmt = db.prepare('INSERT OR IGNORE INTO message_reads (message_id, user_id, read_at) VALUES (?,?,?)');
  ids.forEach((id) => stmt.run(id, uid, now()));
  const counts = {};
  ids.forEach((id) => {
    counts[id] = db.prepare('SELECT COUNT(*) c FROM message_reads WHERE message_id=?').get(id).c;
  });
  const payload = { convType, convId, readerId: uid, messageIds: ids, counts, readAt: now() };
  sendToUsers(convParticipants(convType, convId), { type: 'message:read', data: payload });
  relayChatEvent(convType, String(convId), 'message:read', payload, uid).catch(() => {});
}

/* ------------------------------- 发送消息 ------------------------------- */
router.post('/messages', (req, res) => {
  const uid = req.uid;
  const { convType, convId, msg_type = 'text', content = '', media_url = '', media_thumb = '', one_time = false, clientId } = req.body || {};
  if (!checkAccess(uid, convType, convId)) return res.status(403).json({ error: '无权在该会话发送消息' });

  if (convType === 'group') {
    const gid = Number(convId);
    const me = db.prepare('SELECT mute_until FROM group_members WHERE group_id=? AND user_id=?').get(gid, uid);
    if (me?.mute_until && me.mute_until > now()) {
      return res.status(403).json({ error: `你已被禁言，剩余 ${Math.ceil((me.mute_until - now()) / 1000)} 秒` });
    }
  }
  if (msg_type === 'text' && !String(content).trim()) return res.status(400).json({ error: '消息不能为空' });
  if (msg_type === 'sticker' && !String(content).trim()) return res.status(400).json({ error: '表情不能为空' });
  if (msg_type !== 'text' && msg_type !== 'sticker' && !media_url) return res.status(400).json({ error: '缺少媒体文件' });

  const r = db
    .prepare(
      `INSERT INTO messages (conv_type, conv_id, sender_id, msg_type, content, media_url, media_thumb, one_time, recalled, extra, created_at)
       VALUES (?,?,?,?,?,?,?,?,0,'',?)`,
    )
    .run(convType, String(convId), uid, msg_type, String(content).slice(0, 2000), media_url, media_thumb, one_time ? 1 : 0, now());
  const row = db.prepare('SELECT * FROM messages WHERE id = ?').get(r.lastInsertRowid);
  db.prepare('INSERT OR IGNORE INTO message_reads (message_id, user_id, read_at) VALUES (?,?,?)').run(row.id, uid, now());

  const msg = buildMessage(row, clientId ? { client_id: clientId } : {});
  sendToUsers(convParticipants(convType, convId), { type: 'message', data: msg });
  res.json({ message: msg });

  // 通过腾讯云 IM 转发（跨网络 / 跨区域实时通道，离线消息由腾讯云暂存补投）
  relayChatEvent(convType, String(convId), 'message', msg, uid).catch(() => {});

  // 官方群 @Jay AI 触发
  if (convType === 'group') {
    const g = db.prepare('SELECT * FROM groups WHERE id=?').get(Number(convId));
    if (g?.is_official && /jay\s*ai/i.test(content)) {
      handleAIAsync(Number(convId), uid, String(content));
    }
  }
});

/* ------------------------- Jay AI（官方群专属） ------------------------- */
async function handleAIAsync(gid, askerId, content) {
  const asker = publicUser(getUser(askerId));
  const members = groupMembers(gid).map((m) => m.user_id);
  // 先发一条「正在思考」，提升实时感
  const thinking = insertAiMessage(gid, `@${asker.username} Jay AI 正在思考中…`, { ai: true, pending: true }, askerId);
  sendToUsers(members, { type: 'message', data: thinking });
  relayChatEvent('group', String(gid), 'message', thinking, 0).catch(() => {});

  const prompt = content.replace(/@?\s*jay\s*ai\s*[:：,，]?/gi, '').trim();
  const history = db
    .prepare(`SELECT * FROM messages WHERE conv_type='group' AND conv_id=? AND recalled=0 ORDER BY id DESC LIMIT 12`)
    .all(String(gid))
    .reverse()
    .map((m) => ({
      role: m.sender_id === 0 ? 'assistant' : 'user',
      content: m.sender_id === 0 ? m.content.replace(/^@\S+\s*/, '') : `${publicUser(getUser(m.sender_id))?.username || '用户'}: ${m.content}`,
    }))
    .filter((m) => m.content);

  const sys = `${AI_SYSTEM_PROMPT}\n当前提问者是「${asker.username}」。请在回答开头单独用一行写「@${asker.username}」，然后另起一行回答。`;
  const r = await askAI([{ role: 'system', content: sys }, ...history, { role: 'user', content: prompt || '你好' }]);

  // 用最终结果替换「正在思考」
  let text = r.ok ? r.text : `抱歉，AI 暂时无法回答（${r.error || '未知错误'}），请稍后再试。`;
  // 保证回复以 @提问者 开头（GLM 有时会省略，这里强制兜底）
  if (!text.startsWith(`@${asker.username}`)) text = `@${asker.username}\n${text}`;
  db.prepare('UPDATE messages SET content=?, extra=? WHERE id=?').run(text, JSON.stringify({ ai: true, mention: asker.username, ok: r.ok }), thinking.id);
  const finalRow = db.prepare('SELECT * FROM messages WHERE id=?').get(thinking.id);
  const finalMsg = buildMessage(finalRow);
  sendToUsers(members, { type: 'message:update', data: finalMsg });
  relayChatEvent('group', String(gid), 'message:update', finalMsg, 0).catch(() => {});
}

function insertAiMessage(gid, content, extra, replyTo) {
  const r = db
    .prepare(
      `INSERT INTO messages (conv_type, conv_id, sender_id, msg_type, content, media_url, media_thumb, one_time, recalled, extra, created_at)
       VALUES ('group', ?, 0, 'text', ?, '', '', 0, 0, ?, ?)`,
    )
    .run(String(gid), content, JSON.stringify({ ...extra, reply_to: replyTo }), now());
  // AI 消息视为全员已读（机器人不需要回执）
  const row = db.prepare('SELECT * FROM messages WHERE id=?').get(r.lastInsertRowid);
  return buildMessage(row);
}

/* ------------------------------- 已读回执 ------------------------------- */
router.post('/messages/:id/read', (req, res) => {
  const id = Number(req.params.id);
  const m = db.prepare('SELECT * FROM messages WHERE id=?').get(id);
  if (!m) return res.status(404).json({ error: '消息不存在' });
  if (!checkAccess(req.uid, m.conv_type, m.conv_id)) return res.status(403).json({ error: '无权操作' });
  markReadBulk(req.uid, [id], m.conv_type, m.conv_id);
  res.json({ ok: true, read_count: db.prepare('SELECT COUNT(*) c FROM message_reads WHERE message_id=?').get(id).c });
});

/* -------------------------------- 撤回 -------------------------------- */
const RECALL_WINDOW = 3 * 60 * 1000; // 3 分钟

router.post('/messages/:id/recall', (req, res) => {
  const id = Number(req.params.id);
  const m = db.prepare('SELECT * FROM messages WHERE id=?').get(id);
  if (!m) return res.status(404).json({ error: '消息不存在' });
  if (m.sender_id !== req.uid) return res.status(403).json({ error: '只能撤回自己发送的消息' });
  if (now() - m.created_at > RECALL_WINDOW) return res.status(400).json({ error: '超过 3 分钟的消息不能撤回' });
  db.prepare('UPDATE messages SET recalled=1, content=?, media_url=?, media_thumb=? WHERE id=?').run('', '', '', id);
  const out = { type: 'message:recall', data: { id, convType: m.conv_type, convId: m.conv_id, senderId: m.sender_id } };
  sendToUsers(convParticipants(m.conv_type, m.conv_id), out);
  relayChatEvent(m.conv_type, String(m.conv_id), 'message:recall', out.data, req.uid).catch(() => {});
  res.json({ ok: true });
});

/* ---------------------------- 一次性查看销毁 ---------------------------- */
router.post('/messages/:id/burn', (req, res) => {
  const id = Number(req.params.id);
  const m = db.prepare('SELECT * FROM messages WHERE id=?').get(id);
  if (!m) return res.status(404).json({ error: '消息不存在' });
  if (!m.one_time) return res.status(400).json({ error: '该消息不是一次性消息' });
  if (m.sender_id === req.uid) return res.status(400).json({ error: '发送者不会销毁' }); // 发送方保留
  if (!checkAccess(req.uid, m.conv_type, m.conv_id)) return res.status(403).json({ error: '无权操作' });
  db.prepare('INSERT OR IGNORE INTO message_burns (message_id, user_id, burned_at) VALUES (?,?,?)').run(id, req.uid, now());
  const burnData = { id, userId: req.uid, convType: m.conv_type, convId: m.conv_id };
  sendToUsers(convParticipants(m.conv_type, m.conv_id), { type: 'message:burn', data: burnData });
  relayChatEvent(m.conv_type, String(m.conv_id), 'message:burn', burnData, req.uid).catch(() => {});
  res.json({ ok: true });
});

/* ---------------------------- 私聊免打扰 / 获取 ---------------------------- */
router.patch('/dm-dnd', (req, res) => {
  const peer = Number(req.body?.peerId);
  if (!peer) return res.status(400).json({ error: '参数错误' });
  const dnd = req.body?.dnd ? 1 : 0;
  db.prepare(
    `INSERT INTO dm_dnd (user_id, peer_id, dnd) VALUES (?,?,?)
     ON CONFLICT(user_id, peer_id) DO UPDATE SET dnd = excluded.dnd`,
  ).run(req.uid, peer, dnd);
  res.json({ ok: true, dnd: !!dnd });
});

export { RECALL_WINDOW };
export default router;
