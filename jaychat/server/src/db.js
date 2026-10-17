import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { DATA_DIR, OFFICIAL_ACCOUNT, OFFICIAL_GROUP_NAME } from './config.js';
import { hashPassword } from './auth.js';

export const db = new DatabaseSync(path.join(DATA_DIR, 'jaychat.db'));

db.exec(`
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  pwd TEXT NOT NULL,
  avatar TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  is_official INTEGER DEFAULT 0,
  online INTEGER DEFAULT 0,
  last_seen INTEGER DEFAULT 0,
  name_week TEXT DEFAULT '',
  name_count INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS verify_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  purpose TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS friendships (
  user_id INTEGER NOT NULL,
  friend_id INTEGER NOT NULL,
  remark TEXT DEFAULT '',
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, friend_id)
);

CREATE TABLE IF NOT EXISTS friend_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_id INTEGER NOT NULL,
  to_id INTEGER NOT NULL,
  message TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  avatar TEXT DEFAULT '',
  owner_id INTEGER NOT NULL,
  announcement TEXT DEFAULT '',
  is_official INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT DEFAULT 'member',
  mute_until INTEGER DEFAULT 0,
  dnd INTEGER DEFAULT 0,
  joined_at INTEGER NOT NULL,
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  conv_type TEXT NOT NULL,
  conv_id TEXT NOT NULL,
  sender_id INTEGER NOT NULL,
  msg_type TEXT DEFAULT 'text',
  content TEXT DEFAULT '',
  media_url TEXT DEFAULT '',
  media_thumb TEXT DEFAULT '',
  one_time INTEGER DEFAULT 0,
  recalled INTEGER DEFAULT 0,
  extra TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_msg_conv ON messages(conv_type, conv_id, id);

CREATE TABLE IF NOT EXISTS message_reads (
  message_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  read_at INTEGER NOT NULL,
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS message_burns (
  message_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  burned_at INTEGER NOT NULL,
  PRIMARY KEY (message_id, user_id)
);

CREATE TABLE IF NOT EXISTS moments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id INTEGER NOT NULL,
  text TEXT DEFAULT '',
  media TEXT DEFAULT '[]',
  visibility TEXT DEFAULT 'public',
  allow_ids TEXT DEFAULT '[]',
  deny_ids TEXT DEFAULT '[]',
  deleted INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS moment_likes (
  moment_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (moment_id, user_id)
);

CREATE TABLE IF NOT EXISTS moment_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  moment_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  content TEXT DEFAULT '',
  reply_to_user INTEGER DEFAULT 0,
  deleted INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS dm_dnd (
  user_id INTEGER NOT NULL,
  peer_id INTEGER NOT NULL,
  dnd INTEGER DEFAULT 0,
  PRIMARY KEY (user_id, peer_id)
);

CREATE TABLE IF NOT EXISTS conversation_pins (
  user_id INTEGER NOT NULL,
  conv_type TEXT NOT NULL,
  conv_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, conv_type, conv_id)
);

CREATE TABLE IF NOT EXISTS blocks (
  user_id INTEGER NOT NULL,
  blocked_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, blocked_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  actor_id INTEGER DEFAULT 0,
  text TEXT DEFAULT '',
  ref_type TEXT DEFAULT '',
  ref_id INTEGER DEFAULT 0,
  read INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, read);
`);

/** 轻量迁移：为已有库补齐新列 */
function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c) => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
// 腾讯云 IM 群 ID（自建群 ↔ 云群映射）
ensureColumn('groups', 'im_groupid', "im_groupid TEXT DEFAULT ''");

const now = () => Date.now();

/** 种子数据：官方账号「杰同学」+「Jay Chat官方群」 */
export function seedOfficial() {
  let official = db.prepare('SELECT * FROM users WHERE email = ?').get(OFFICIAL_ACCOUNT.email);
  if (!official) {
    db.prepare(
      `INSERT INTO users (username, email, pwd, avatar, is_official, created_at)
       VALUES (?, ?, ?, ?, 1, ?)`,
    ).run(OFFICIAL_ACCOUNT.username, OFFICIAL_ACCOUNT.email, hashPassword(OFFICIAL_ACCOUNT.password), '/assets/official-avatar.svg', now());
    official = db.prepare('SELECT * FROM users WHERE email = ?').get(OFFICIAL_ACCOUNT.email);
    console.log('[seed] 创建官方账号', official.username, official.id);
  } else {
    // 保证官方账号资料与密码可控
    db.prepare('UPDATE users SET is_official = 1, username = ? WHERE id = ?').run(OFFICIAL_ACCOUNT.username, official.id);
    official = db.prepare('SELECT * FROM users WHERE id = ?').get(official.id);
  }

  let grp = db.prepare('SELECT * FROM groups WHERE is_official = 1').get();
  if (!grp) {
    const r = db.prepare(
      `INSERT INTO groups (name, avatar, owner_id, announcement, is_official, created_at)
       VALUES (?, ?, ?, ?, 1, ?)`,
    ).run(OFFICIAL_GROUP_NAME, '/assets/official-group.svg', official.id, '欢迎加入 Jay Chat 官方群，文明聊天，有问题可以 @Jay AI 提问。', now());
    grp = db.prepare('SELECT * FROM groups WHERE id = ?').get(r.lastInsertRowid);
    console.log('[seed] 创建官方群', grp.name, grp.id);
  } else {
    db.prepare('UPDATE groups SET owner_id = ?, name = ? WHERE id = ?').run(official.id, OFFICIAL_GROUP_NAME, grp.id);
    grp = db.prepare('SELECT * FROM groups WHERE id = ?').get(grp.id);
  }

  db.prepare(
    `INSERT OR IGNORE INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, 'owner', ?)`,
  ).run(grp.id, official.id, now());

  return { official, group: grp };
}

/** 新用户自动加入官方群 */
export function joinOfficialGroup(userId) {
  const grp = db.prepare('SELECT id FROM groups WHERE is_official = 1').get();
  if (!grp) return;
  db.prepare(
    `INSERT OR IGNORE INTO group_members (group_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)`,
  ).run(grp.id, userId, now());
}

export const OFFICIAL_GROUP_ID = () => db.prepare('SELECT id FROM groups WHERE is_official = 1').get()?.id;

export { now };
