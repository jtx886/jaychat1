import { db, now } from './db.js';
import { imUserId, IM, OFFICIAL_GROUP_NAME } from './config.js';
import * as TIM from './im.js';
import { getUser, groupMembers, publicUser } from './store.js';

/** 业务 uid → 腾讯云 IM UserID */
export const uim = (userId) => imUserId(Number(userId));

/** 确保用户已在腾讯云 IM 注册账号并同步昵称/头像 */
export async function ensureUserIm(userId) {
  const u = getUser(userId);
  if (!u) return null;
  await TIM.importAccount(uim(u.id), u.username, absUrl(u.avatar));
  await TIM.setProfile(uim(u.id), { nick: u.username, faceUrl: absUrl(u.avatar) });
  return uim(u.id);
}

/** 用户改名/换头像后同步到腾讯云 IM */
export async function syncUserProfileIm(userId) {
  const u = getUser(userId);
  if (!u) return;
  await TIM.setProfile(uim(u.id), { nick: u.username, faceUrl: absUrl(u.avatar) });
}

/** 头像若已是公网地址才回传腾讯云（本地 /uploads、emoji dataURL 无法被腾讯拉取） */
function absUrl(u) {
  if (!u) return '';
  return /^https?:\/\//i.test(u) ? u : '';
}

/**
 * 确保群已在腾讯云 IM 创建，返回腾讯云 GroupId。
 * 首次调用创建群并把当前成员一次性加入。
 */
export async function ensureGroupIm(groupId) {
  const g = db.prepare('SELECT * FROM groups WHERE id = ?').get(Number(groupId));
  if (!g) return null;
  if (g.im_groupid) return g.im_groupid;

  const members = groupMembers(g.id).map((m) => m.user_id);
  const owner = g.owner_id;
  // 先补齐所有成员的 IM 账号
  for (const uid of new Set([owner, ...members])) {
    await ensureUserIm(uid);
  }
  const accounts = members.map((id) => uim(id)).filter((a) => a !== uim(owner));
  // 全部群使用「公开群 + 禁止申请加入」：仅可邀请入群，同时保留踢人/禁言/管理员/转让等管理能力
  const type = 'Public';
  const applyJoinOption = 'DisableApply';
  // 官方群额外把 Jay AI 机器人加入，便于其发消息
  if (g.is_official) accounts.push(IM.aiAccount);

  const cloudId = await TIM.createGroup({
    ownerAccount: uim(owner),
    name: g.name,
    type,
    applyJoinOption,
    memberAccounts: accounts,
  });
  if (cloudId) {
    db.prepare('UPDATE groups SET im_groupid = ? WHERE id = ?').run(cloudId, g.id);
    console.log(`[im] 群「${g.name}」已同步 → ${cloudId}`);
  }
  return cloudId;
}

/** 某个用户的腾讯云 IM 群 ID（不存在则按需创建） */
export async function groupCloudId(groupId) {
  const g = db.prepare('SELECT * FROM groups WHERE id = ?').get(Number(groupId));
  if (!g) return null;
  return g.im_groupid || (await ensureGroupIm(g.id));
}

export async function addMembersIm(groupId, userIds) {
  const jaid = await groupCloudId(groupId);
  if (!jaid) return false;
  await Promise.all(userIds.map((id) => ensureUserIm(id)));
  return TIM.addGroupMembers(jaid, userIds.map((id) => uim(id)));
}

export async function removeMembersIm(groupId, userIds) {
  const g = db.prepare('SELECT * FROM groups WHERE id = ?').get(Number(groupId));
  if (!g?.im_groupid) return false;
  return TIM.deleteGroupMembers(g.im_groupid, userIds.map((id) => uim(id)));
}

/** 官方群：把 Jay AI 机器人也拉进来 */
export async function ensureAiInOfficialGroup() {
  const g = db.prepare('SELECT * FROM groups WHERE is_official = 1').get();
  if (!g) return;
  const cloudId = await groupCloudId(g.id);
  if (cloudId) await TIM.addGroupMembers(cloudId, [IM.aiAccount]);
}

/** Jay AI 在群里以机器人身份发言 */
export async function sendAiGroupMessage(groupId, text) {
  const g = db.prepare('SELECT * FROM groups WHERE id = ?').get(Number(groupId));
  if (!g?.im_groupid) return false;
  return TIM.sendGroupText(g.im_groupid, IM.aiAccount, text);
}

/**
 * 把一条聊天事件通过腾讯云 IM 转发给会话对方 / 群成员。
 * 前端登录 IM SDK 后即可跨网络、跨区域实时收到（离线也会在下次登录时补收）。
 * fromUserId 为 0 表示机器人（Jay AI）身份。
 */
export async function relayChatEvent(convType, convId, event, data, fromUserId) {
  try {
    const envelope = JSON.stringify({ jc: 1, event, data });
    if (convType === 'group') {
      const g = db.prepare('SELECT im_groupid FROM groups WHERE id = ?').get(Number(convId));
      if (!g?.im_groupid) return false;
      const from = Number(fromUserId) > 0 ? uim(fromUserId) : IM.aiAccount;
      return TIM.sendGroupCustom(g.im_groupid, from, envelope);
    }
    const parts = String(convId).split('_').map(Number);
    const meId = Number(fromUserId);
    const toId = parts.find((x) => x !== meId);
    if (!meId || !toId) return false;
    await Promise.all([ensureUserIm(meId), ensureUserIm(toId)]);
    return TIM.sendCustomToUser(uim(meId), uim(toId), envelope);
  } catch (e) {
    console.warn('[im] 事件转发失败', event, e.message);
    return false;
  }
}

/* ----------------------------- 关系链 ----------------------------- */
export async function friendAddIm(aId, bId) {
  await Promise.all([ensureUserIm(aId), ensureUserIm(bId)]);
  await Promise.all([
    TIM.friendAdd(uim(aId), uim(bId)),
    TIM.friendAdd(uim(bId), uim(aId)),
  ]);
}

export async function friendDeleteIm(aId, bId) {
  await Promise.all([
    TIM.friendDelete(uim(aId), uim(bId)),
    TIM.friendDelete(uim(bId), uim(aId)),
  ]);
}

export async function friendRemarkIm(aId, bId, remark) {
  await TIM.friendUpdateRemark(uim(aId), uim(bId), remark);
}

export { OFFICIAL_GROUP_NAME };
