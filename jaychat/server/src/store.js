import { db, now } from './db.js';
import { sendToUser, sendToUsers, broadcast } from './realtime.js';

export function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id,
    username: u.username,
    avatar: u.avatar || '',
    is_official: !!u.is_official,
    online: !!u.online,
    last_seen: u.last_seen || 0,
  };
}

export function selfUser(u) {
  return {
    ...publicUser(u),
    email: u.email,
    bio: u.bio || '',
    name_count: u.name_count || 0,
    name_week: u.name_week || '',
    created_at: u.created_at,
  };
}

export function getUser(id) {
  return db.prepare('SELECT * FROM users WHERE id = ?').get(id);
}

export function dmConvId(a, b) {
  const x = Number(a);
  const y = Number(b);
  return x < y ? `${x}_${y}` : `${y}_${x}`;
}

export function areFriends(a, b) {
  const r = db.prepare('SELECT 1 FROM friendships WHERE user_id = ? AND friend_id = ?').get(a, b);
  return !!r;
}

/** 我是否拉黑了对方 */
export function isBlocked(ownerId, targetId) {
  return !!db.prepare('SELECT 1 FROM blocks WHERE user_id = ? AND blocked_id = ?').get(ownerId, targetId);
}

/** 双向拉黑判断（任一方拉黑即视为不可通信） */
export function blockedEither(a, b) {
  return isBlocked(a, b) || isBlocked(b, a);
}

/** 我拉黑的用户 id 列表 */
export function blockedIds(uid) {
  return db.prepare('SELECT blocked_id FROM blocks WHERE user_id = ?').all(uid).map((r) => r.blocked_id);
}

export function friendIds(uid) {
  return db.prepare('SELECT friend_id FROM friendships WHERE user_id = ?').all(uid).map((r) => r.friend_id);
}

export function addFriend(a, b, remark = '') {
  db.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id, remark, created_at) VALUES (?,?,?,?)').run(a, b, remark, now());
  db.prepare('INSERT OR IGNORE INTO friendships (user_id, friend_id, remark, created_at) VALUES (?,?,?,?)').run(b, a, '', now());
}

export function myGroups(uid) {
  return db
    .prepare('SELECT g.*, m.role, m.dnd, m.mute_until FROM group_members m JOIN groups g ON g.id = m.group_id WHERE m.user_id = ?')
    .all(uid);
}

export function groupMembers(gid) {
  return db.prepare('SELECT user_id, role, mute_until, dnd, joined_at FROM group_members WHERE group_id = ?').all(gid);
}

export function groupMemberIds(gid) {
  return groupMembers(gid).map((m) => m.user_id);
}

export function memberRole(gid, uid) {
  const m = db.prepare('SELECT role FROM group_members WHERE group_id = ? AND user_id = ?').get(gid, uid);
  return m ? m.role : null;
}

export function convParticipants(convType, convId) {
  if (convType === 'dm') {
    return String(convId).split('_').map(Number).filter(Boolean);
  }
  return groupMemberIds(Number(convId));
}

/** 创建通知并实时推送给目标用户 */
export function createNotification({ user_id, type, actor_id = 0, text = '', ref_type = '', ref_id = 0 }) {
  const r = db
    .prepare(
      `INSERT INTO notifications (user_id, type, actor_id, text, ref_type, ref_id, read, created_at)
       VALUES (?,?,?,?,?,?,0,?)`,
    )
    .run(user_id, type, actor_id, text, ref_type, ref_id, now());
  const notif = db.prepare('SELECT * FROM notifications WHERE id = ?').get(r.lastInsertRowid);
  const actor = actor_id ? publicUser(getUser(actor_id)) : null;
  sendToUser(user_id, { type: 'notification', data: { ...notif, actor } });
  return notif;
}

/** 组装消息用于返回/推送 */
export function buildMessage(row, extra = {}) {
  const sender = publicUser(getUser(row.sender_id));
  const readCount = db.prepare('SELECT COUNT(*) c FROM message_reads WHERE message_id = ?').get(row.id).c;
  const burns = db.prepare('SELECT user_id FROM message_burns WHERE message_id = ?').all(row.id).map((b) => b.user_id);
  return {
    id: row.id,
    conv_type: row.conv_type,
    conv_id: row.conv_id,
    sender_id: row.sender_id,
    sender,
    msg_type: row.msg_type,
    content: row.content,
    media_url: row.media_url,
    media_thumb: row.media_thumb,
    one_time: !!row.one_time,
    burn_sec: row.burn_sec || 5,
    recalled: !!row.recalled,
    extra: row.extra ? safeJson(row.extra) : null,
    read_count: readCount,
    burned_by: burns,
    created_at: row.created_at,
    ...extra,
  };
}

export function safeJson(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export { now, sendToUser, sendToUsers, broadcast };
