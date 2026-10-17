import { createRequire } from 'node:module';
import { IM } from './config.js';

const require = createRequire(import.meta.url);
const { Api: TlsSigApi } = require('tls-sig-api-v2');

const sigApi = new TlsSigApi(IM.sdkAppId, IM.secretKey);

/** imUserId -> { sig, expireAt } */
const sigCache = new Map();

export function genUserSig(imUserId, expire = IM.expire) {
  const cached = sigCache.get(imUserId);
  if (cached && cached.expireAt - Date.now() > 120_000) return cached.sig;
  const sig = sigApi.genUserSig(String(imUserId), expire);
  sigCache.set(imUserId, { sig, expireAt: Date.now() + expire * 1000 });
  return sig;
}

const BASE = 'https://console.tim.qq.com/v4/';

/** 调用腾讯云 IM 服务端 REST 接口 */
export async function call(path, body, identifier = IM.admin) {
  const url =
    `${BASE}${path}?sdkappid=${IM.sdkAppId}` +
    `&identifier=${encodeURIComponent(identifier)}` +
    `&usersig=${encodeURIComponent(genUserSig(identifier))}` +
    `&random=${Math.floor(Math.random() * 4294967295)}` +
    `&contenttype=json`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
    const data = await res.json().catch(() => ({}));
    if (data.ActionStatus !== 'OK') {
      console.warn(`[im] ${path} → code=${data.ErrorCode} info=${data.ErrorInfo}`);
    }
    return data;
  } catch (e) {
    console.warn(`[im] ${path} 请求失败: ${e.message}`);
    return { ActionStatus: 'FAIL', ErrorCode: -1, ErrorInfo: e.message };
  }
}

const ok = (r) => r && r.ActionStatus === 'OK';

/* ----------------------------- 账号 ----------------------------- */
export async function importAccount(imUserId, nick, faceUrl = '') {
  return ok(
    await call('im_open_login_svc/account_import', {
      UserID: String(imUserId),
      Nick: String(nick || imUserId).slice(0, 32),
      FaceUrl: faceUrl || '',
    }),
  );
}

export async function setProfile(imUserId, { nick, faceUrl } = {}) {
  const item = { Tag: 'Tag_Profile_IM_Nick', Value: String(nick || '').slice(0, 32) };
  const list = [item];
  if (faceUrl) list.push({ Tag: 'Tag_Profile_IM_Image', Value: String(faceUrl) });
  return ok(
    await call('profile/portrait_set', { From_Account: String(imUserId), ProfileItem: list }),
  );
}

/* ----------------------------- 群组 ----------------------------- */
export async function createGroup({ ownerAccount, name, type = 'Public', applyJoinOption = 'DisableApply', memberAccounts = [] }) {
  const r = await call('group_open_http_svc/create_group', {
    Owner_Account: String(ownerAccount),
    Type: type,
    ApplyJoinOption: applyJoinOption,
    Name: String(name).slice(0, 30),
    MemberList: memberAccounts.map((a) => ({ Member_Account: String(a) })),
  });
  return ok(r) ? r.GroupId : null;
}

export async function getGroupInfo(groupId) {
  const r = await call('group_open_http_svc/get_group_info', { GroupIdList: [String(groupId)] });
  return ok(r) ? r.GroupInfo?.[0] : null;
}

export async function addGroupMembers(groupId, accounts) {
  if (!accounts.length) return true;
  return ok(
    await call('group_open_http_svc/add_group_member', {
      GroupId: String(groupId),
      MemberList: accounts.map((a) => ({ Member_Account: String(a) })),
    }),
  );
}

export async function deleteGroupMembers(groupId, accounts) {
  if (!accounts.length) return true;
  return ok(
    await call('group_open_http_svc/delete_group_member', {
      GroupId: String(groupId),
      MemberToDel_Account: accounts.map(String),
      Silence: 1,
    }),
  );
}

export async function setMemberRole(groupId, account, role) {
  return ok(
    await call('group_open_http_svc/modify_group_member_info', {
      GroupId: String(groupId),
      Member_Account: String(account),
      Role: role === 'admin' ? 'Admin' : 'Member',
    }),
  );
}

/** untilSec：0 表示解除禁言，其余为「禁言到」的 unix 秒 */
export async function muteMember(groupId, account, untilSec) {
  return ok(
    await call('group_open_http_svc/modify_group_member_info', {
      GroupId: String(groupId),
      Member_Account: String(account),
      MuteUntil: Math.max(0, Math.floor(Number(untilSec) || 0)),
    }),
  );
}

export async function modifyGroupBaseInfo(groupId, { name, faceUrl, notification, introduction } = {}) {
  const body = { GroupId: String(groupId) };
  if (name !== undefined) body.Name = String(name).slice(0, 30);
  if (faceUrl !== undefined) body.FaceUrl = faceUrl;
  if (notification !== undefined) body.Notification = String(notification).slice(0, 300);
  if (introduction !== undefined) body.Introduction = String(introduction).slice(0, 300);
  return ok(await call('group_open_http_svc/modify_group_base_info', body));
}

export async function changeGroupOwner(groupId, newOwner) {
  return ok(
    await call('group_open_http_svc/change_group_owner', {
      GroupId: String(groupId),
      NewOwner_Account: String(newOwner),
    }),
  );
}

export async function quitGroup(groupId, accounts) {
  return ok(
    await call('group_open_http_svc/quit_group', {
      GroupId: String(groupId),
      Delete_Account: 0,
      MemberList: accounts.map(String),
    }),
  );
}

export async function destroyGroup(groupId) {
  return ok(await call('group_open_http_svc/destroy_group', { GroupId: String(groupId) }));
}

/* --------------------------- 发送消息 --------------------------- */
export async function sendGroupText(groupId, fromAccount, text) {
  return ok(
    await call('group_open_http_svc/send_group_msg', {
      GroupId: String(groupId),
      From_Account: String(fromAccount),
      Random: Math.floor(Math.random() * 4294967295),
      MsgBody: [{ MsgType: 'TIMTextElem', MsgContent: { Text: String(text) } }],
    }),
  );
}

const random32 = () => Math.floor(Math.random() * 4294967295);

/** 服务端以某账号身份，向单个用户下发自定义消息（跨网络实时通道） */
export async function sendCustomToUser(fromAccount, toAccount, dataStr) {
  return ok(
    // 注意：单聊 REST 接口的 identifier 必须是 App 管理员，发送方通过 From_Account 指定
    await call('openim/sendmsg', {
      SyncOtherMachine: 2, // 不回同步给发送者本人，避免自发自收
      From_Account: String(fromAccount),
      To_Account: String(toAccount),
      MsgRandom: random32(),
      MsgBody: [{ MsgType: 'TIMCustomElem', MsgContent: { Data: String(dataStr), Desc: 'JayChat', Ext: '' } }],
    }),
  );
}

/** 服务端以某账号身份，在群内下发自定义消息 */
export async function sendGroupCustom(groupId, fromAccount, dataStr) {
  return ok(
    await call('group_open_http_svc/send_group_msg', {
      GroupId: String(groupId),
      From_Account: String(fromAccount),
      Random: random32(),
      MsgBody: [{ MsgType: 'TIMCustomElem', MsgContent: { Data: String(dataStr), Desc: 'JayChat', Ext: '' } }],
    }),
  );
}

/* ----------------------------- 关系链 ----------------------------- */
export async function friendAdd(account, toAccount, remark = '') {
  return ok(
    await call('sns/friend_add', {
      From_Account: String(account),
      AddFriendItem: [{ To_Account: String(toAccount), Remark: remark, AddSource: 'AddSource_Type_Web' }],
      AddType: 'Add_Type_Both',
    }),
  );
}

export async function friendDelete(account, toAccount) {
  return ok(
    await call('sns/friend_delete', {
      From_Account: String(account),
      To_Account: [String(toAccount)],
    }),
  );
}

export async function friendUpdateRemark(account, toAccount, remark) {
  return ok(
    await call('sns/friend_update', {
      From_Account: String(account),
      UpdateItem: [{ To_Account: String(toAccount), SnsItem: [{ Tag: 'Tag_SNS_IM_Remark', Value: String(remark) }] }],
    }),
  );
}

/* ----------------------------- 初始化 ----------------------------- */
let inited = false;
export async function initIM() {
  if (inited) return true;
  if (!IM.enabled) {
    console.warn('[im] 未配置腾讯云 IM，跳过初始化');
    return false;
  }
  inited = true;
  await importAccount(IM.admin, 'JayChatAdmin');
  await importAccount(IM.aiAccount, 'Jay AI');
  console.log(`[im] 已连接腾讯云 IM (SDKAppID=${IM.sdkAppId})`);
  return true;
}
