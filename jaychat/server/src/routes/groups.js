import express from 'express';
import { db, now } from '../db.js';
import { requireAuth } from '../auth.js';
import {
  getUser, publicUser, myGroups, groupMembers, memberRole, sendToUser, sendToUsers, createNotification,
} from '../store.js';
import { isOnline } from '../realtime.js';
import * as TIM from '../im.js';
import {
  uim, ensureGroupIm, groupCloudId, addMembersIm, removeMembersIm,
} from '../im-sync.js';

const router = express.Router();
router.use(requireAuth);

function groupBrief(g, uid) {
  const members = groupMembers(g.id);
  return {
    id: g.id,
    name: g.name,
    avatar: g.avatar || '',
    owner_id: g.owner_id,
    announcement: g.announcement || '',
    is_official: !!g.is_official,
    im_groupid: g.im_groupid || '',
    member_count: members.length,
    online_count: members.filter((m) => isOnline(m.user_id)).length,
    my_role: memberRole(g.id, uid) || 'member',
    dnd: !!members.find((m) => m.user_id === uid)?.dnd,
  };
}

// 创建群聊
router.post('/', async (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 20);
  if (!name) return res.status(400).json({ error: '请输入群名称' });
  const memberIds = (req.body?.memberIds || []).map(Number).filter((x) => x && x !== req.uid);
  const r = db
    .prepare(`INSERT INTO groups (name, avatar, owner_id, announcement, is_official, created_at) VALUES (?,?,?,?,0,?)`)
    .run(name, '', req.uid, '', now());
  const gid = Number(r.lastInsertRowid);
  db.prepare(`INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (?,?,'owner',?)`).run(gid, req.uid, now());
  memberIds.forEach((m) => {
    if (!getUser(m)) return;
    db.prepare(`INSERT OR IGNORE INTO group_members (group_id, user_id, role, joined_at) VALUES (?,?,'member',?)`).run(gid, m, now());
  });
  // 同步创建腾讯云 IM 群
  try {
    await ensureGroupIm(gid);
  } catch (e) {
    console.warn('[group] IM 建群失败', e.message);
  }
  const g = db.prepare('SELECT * FROM groups WHERE id = ?').get(gid);
  const payload = { type: 'group:new', data: { group: groupBrief(g, req.uid) } };
  sendToUsers([req.uid, ...memberIds], payload);
  res.json({ group: groupBrief(g, req.uid) });
});

// 我的群聊
router.get('/', (req, res) => {
  res.json({ groups: myGroups(req.uid).map((g) => groupBrief(g, req.uid)) });
});

// 群详情
router.get('/:id', (req, res) => {
  const gid = Number(req.params.id);
  const g = db.prepare('SELECT * FROM groups WHERE id = ?').get(gid);
  if (!g) return res.status(404).json({ error: '群聊不存在' });
  const role = memberRole(gid, req.uid);
  if (!role) return res.status(403).json({ error: '你不在该群聊中' });
  const members = groupMembers(gid)
    .map((m) => ({
      ...publicUser(getUser(m.user_id)),
      role: m.role,
      mute_until: m.mute_until || 0,
      dnd: !!m.dnd,
      joined_at: m.joined_at,
    }))
    .sort((a, b) => roleWeight(b.role) - roleWeight(a.role) || a.id - b.id);
  const me = members.find((m) => m.id === req.uid);
  res.json({
    group: { ...groupBrief(g, req.uid), owner: publicUser(getUser(g.owner_id)) },
    members,
    online_count: members.filter((m) => m.online).length,
    my_role: role,
    my_mute_until: me?.mute_until || 0,
    can: {
      edit: role === 'owner' || role === 'admin',
      kick: role === 'owner',
      set_admin: role === 'owner',
      mute: role === 'owner' || role === 'admin',
      transfer: role === 'owner',
      invite: true,
      quit: !g.is_official && role !== 'owner',
    },
  });
});

function roleWeight(r) {
  return r === 'owner' ? 2 : r === 'admin' ? 1 : 0;
}

// 编辑群名称 / 头像 / 公告
router.patch('/:id', (req, res) => {
  const gid = Number(req.params.id);
  const role = memberRole(gid, req.uid);
  if (role !== 'owner' && role !== 'admin') return res.status(403).json({ error: '只有群主或管理员可以修改' });
  const { name, avatar, announcement } = req.body || {};
  if (name !== undefined) {
    const n = String(name).trim().slice(0, 20);
    if (!n) return res.status(400).json({ error: '群名称不能为空' });
    db.prepare('UPDATE groups SET name = ? WHERE id = ?').run(n, gid);
  }
  if (avatar !== undefined) db.prepare('UPDATE groups SET avatar = ? WHERE id = ?').run(String(avatar), gid);
  if (announcement !== undefined) db.prepare('UPDATE groups SET announcement = ? WHERE id = ?').run(String(announcement).slice(0, 200), gid);
  groupCloudId(gid)
    .then((cid) => cid && TIM.modifyGroupBaseInfo(cid, {
      name: req.body?.name !== undefined ? String(req.body.name).slice(0, 20) : undefined,
      notification: req.body?.announcement !== undefined ? String(req.body.announcement).slice(0, 200) : undefined,
    }))
    .catch(() => {});
  const g = db.prepare('SELECT * FROM groups WHERE id = ?').get(gid);
  broadcastGroup(gid, { type: 'group:update', data: { groupId: gid, group: groupBrief(g, req.uid) } });
  res.json({ group: groupBrief(g, req.uid) });
});

// 邀请好友入群
router.post('/:id/invite', (req, res) => {
  const gid = Number(req.params.id);
  if (!memberRole(gid, req.uid)) return res.status(403).json({ error: '你不在该群聊中' });
  const ids = (req.body?.userIds || []).map(Number).filter(Boolean);
  const added = [];
  ids.forEach((uid) => {
    if (!getUser(uid)) return;
    const had = memberRole(gid, uid);
    if (had) return;
    db.prepare(`INSERT INTO group_members (group_id, user_id, role, joined_at) VALUES (?,?,'member',?)`).run(gid, uid, now());
    added.push(uid);
    const g = db.prepare('SELECT name FROM groups WHERE id = ?').get(gid);
    createNotification({ user_id: uid, type: 'group_invite', actor_id: req.uid, text: `${publicUser(getUser(req.uid)).username} 邀请你加入群聊「${g.name}」`, ref_type: 'group', ref_id: gid });
  });
  if (added.length) {
    addMembersIm(gid, added).catch((e) => console.warn('[group] IM 加人失败', e.message));
    const g = db.prepare('SELECT * FROM groups WHERE id = ?').get(gid);
    sendToUsers([...groupMembers(gid).map((m) => m.user_id)], {
      type: 'group:members', data: { groupId: gid, group: groupBrief(g, req.uid) },
    });
  }
  res.json({ ok: true, added });
});

// 踢人（群主）
router.post('/:id/kick', (req, res) => {
  const gid = Number(req.params.id);
  const g = db.prepare('SELECT * FROM groups WHERE id = ?').get(gid);
  if (!g) return res.status(404).json({ error: '群聊不存在' });
  if (g.owner_id !== req.uid) return res.status(403).json({ error: '只有群主可以移出成员' });
  const uid = Number(req.body?.userId);
  if (!uid || uid === g.owner_id) return res.status(400).json({ error: '参数错误' });
  db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(gid, uid);
  removeMembersIm(gid, [uid]).catch((e) => console.warn('[group] IM 踢人失败', e.message));
  sendToUser(uid, { type: 'group:removed', data: { groupId: gid, name: g.name } });
  broadcastGroup(gid, { type: 'group:members', data: { groupId: gid, group: groupBrief(g, req.uid) } });
  res.json({ ok: true });
});

// 设置 / 取消管理员（群主）
router.post('/:id/set-admin', (req, res) => {
  const gid = Number(req.params.id);
  const g = db.prepare('SELECT * FROM groups WHERE id = ?').get(gid);
  if (!g) return res.status(404).json({ error: '群聊不存在' });
  if (g.owner_id !== req.uid) return res.status(403).json({ error: '只有群主可以设置管理员' });
  const uid = Number(req.body?.userId);
  const admin = !!req.body?.admin;
  if (!uid || uid === g.owner_id || !memberRole(gid, uid)) return res.status(400).json({ error: '参数错误' });
  db.prepare('UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?').run(admin ? 'admin' : 'member', gid, uid);
  groupCloudId(gid)
    .then((cid) => cid && TIM.setMemberRole(cid, uim(uid), admin ? 'admin' : 'member'))
    .catch(() => {});
  broadcastGroup(gid, { type: 'group:members', data: { groupId: gid, group: groupBrief(g, req.uid) } });
  res.json({ ok: true });
});

// 禁言 / 解除禁言（群主、管理员），可自定义时长（秒），0 表示解除
router.post('/:id/mute', (req, res) => {
  const gid = Number(req.params.id);
  const g = db.prepare('SELECT * FROM groups WHERE id = ?').get(gid);
  if (!g) return res.status(404).json({ error: '群聊不存在' });
  const role = memberRole(gid, req.uid);
  if (role !== 'owner' && role !== 'admin') return res.status(403).json({ error: '没有权限' });
  const uid = Number(req.body?.userId);
  const duration = Math.max(0, Number(req.body?.durationSec || 0));
  const target = memberRole(gid, uid);
  if (!uid || !target) return res.status(400).json({ error: '参数错误' });
  if (target === 'owner') return res.status(400).json({ error: '不能禁言群主' });
  if (role === 'admin' && target === 'admin') return res.status(400).json({ error: '管理员不能禁言其他管理员' });
  const until = duration > 0 ? now() + duration * 1000 : 0;
  db.prepare('UPDATE group_members SET mute_until = ? WHERE group_id = ? AND user_id = ?').run(until, gid, uid);
  groupCloudId(gid)
    .then((cid) => cid && TIM.muteMember(cid, uim(uid), until ? Math.floor(until / 1000) : 0))
    .catch(() => {});
  sendToUser(uid, { type: 'group:muted', data: { groupId: gid, mute_until: until } });
  broadcastGroup(gid, { type: 'group:members', data: { groupId: gid, group: groupBrief(g, req.uid) } });
  res.json({ ok: true, mute_until: until });
});

// 转让群主
router.post('/:id/transfer', (req, res) => {
  const gid = Number(req.params.id);
  const g = db.prepare('SELECT * FROM groups WHERE id = ?').get(gid);
  if (!g) return res.status(404).json({ error: '群聊不存在' });
  if (g.owner_id !== req.uid) return res.status(403).json({ error: '只有群主可以转让' });
  const uid = Number(req.body?.userId);
  if (!uid || !memberRole(gid, uid)) return res.status(400).json({ error: '参数错误' });
  db.prepare('UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?').run('member', gid, g.owner_id);
  db.prepare('UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?').run('owner', gid, uid);
  db.prepare('UPDATE groups SET owner_id = ? WHERE id = ?').run(uid, gid);
  groupCloudId(gid)
    .then((cid) => cid && TIM.changeGroupOwner(cid, uim(uid)))
    .catch(() => {});
  const g2 = db.prepare('SELECT * FROM groups WHERE id = ?').get(gid);
  broadcastGroup(gid, { type: 'group:members', data: { groupId: gid, group: groupBrief(g2, req.uid) } });
  res.json({ ok: true });
});

// 退出群聊（官方群禁止退出，群主需先转让）
router.post('/:id/quit', async (req, res) => {
  const gid = Number(req.params.id);
  const g = db.prepare('SELECT * FROM groups WHERE id = ?').get(gid);
  if (!g) return res.status(404).json({ error: '群聊不存在' });
  if (!memberRole(gid, req.uid)) return res.status(400).json({ error: '你不在该群聊中' });
  if (g.is_official) return res.status(400).json({ error: '官方群不能退出' });
  if (g.owner_id === req.uid) return res.status(400).json({ error: '群主请先转让群主后再退出' });
  db.prepare('DELETE FROM group_members WHERE group_id = ? AND user_id = ?').run(gid, req.uid);
  const cid = g.im_groupid || (await ensureGroupIm(gid));
  if (cid) TIM.quitGroup(cid, [uim(req.uid)]).catch(() => {});
  broadcastGroup(gid, { type: 'group:members', data: { groupId: gid, group: groupBrief(g, req.uid) } });
  res.json({ ok: true });
});

// 消息免打扰
router.patch('/:id/dnd', (req, res) => {
  const gid = Number(req.params.id);
  if (!memberRole(gid, req.uid)) return res.status(403).json({ error: '你不在该群聊中' });
  const dnd = req.body?.dnd ? 1 : 0;
  db.prepare('UPDATE group_members SET dnd = ? WHERE group_id = ? AND user_id = ?').run(dnd, gid, req.uid);
  res.json({ ok: true, dnd: !!dnd });
});

// 群在线成员
router.get('/:id/online', (req, res) => {
  const gid = Number(req.params.id);
  if (!memberRole(gid, req.uid)) return res.status(403).json({ error: '你不在该群聊中' });
  const members = groupMembers(gid);
  res.json({
    online: members.filter((m) => isOnline(m.user_id)).map((m) => publicUser(getUser(m.user_id))),
    count: members.filter((m) => isOnline(m.user_id)).length,
    total: members.length,
  });
});

function broadcastGroup(gid, payload) {
  sendToUsers(groupMembers(gid).map((m) => m.user_id), payload);
}

export default router;
