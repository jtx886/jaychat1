/* ============ 腾讯云 IM 实时通道（跨网络 / 跨区域） ============
 * 服务端把聊天事件以自定义消息（TIMCustomElem）经腾讯云 IM 下发，
 * 这里登录 IM SDK 接收后再投递到本地事件总线（ws），复用现有页面逻辑。
 *
 * 注意：IM SDK 体积较大，这里改成「按需动态加载」，避免 SDK 初始化异常
 * 影响应用首屏渲染（首屏黑屏问题的防御措施）。
 */
import { api, ws } from '../api.js';

let chat = null;
let sdk = null; // { TencentCloudChat, TYPES, EVENT }
let currentUserId = '';
let loggingIn = null;
let loadingSdk = null;

export const getChat = () => chat;

async function loadSdk() {
  if (sdk) return sdk;
  if (!loadingSdk) {
    loadingSdk = (async () => {
      const [chatMod, uploadMod] = await Promise.all([
        import('@tencentcloud/chat'),
        import('tim-upload-plugin'),
      ]);
      const TencentCloudChat = chatMod.default || chatMod;
      const TIMUploadPlugin = uploadMod.default || uploadMod;
      sdk = {
        TencentCloudChat,
        TIMUploadPlugin,
        EVENT: TencentCloudChat.EVENT,
        TYPES: TencentCloudChat.TYPES,
      };
      return sdk;
    })().catch((e) => {
      loadingSdk = null;
      throw e;
    });
  }
  return loadingSdk;
}

/** 登录腾讯云 IM；重复调用返回同一个 Promise */
export function loginIM() {
  if (loggingIn) return loggingIn;
  loggingIn = (async () => {
    const { TencentCloudChat, TIMUploadPlugin, EVENT, TYPES } = await loadSdk();
    const info = await api.get('/api/im/usersig');
    if (chat && currentUserId && currentUserId !== info.imUserId) {
      try {
        await chat.logout();
      } catch {}
      chat = null;
    }
    if (!chat) {
      chat = TencentCloudChat.create({ SDKAppID: info.sdkAppId });
      chat.setLogLevel(0);
      chat.registerPlugin({ 'tim-upload-plugin': TIMUploadPlugin });
      bindEvents(chat, EVENT, TYPES);
    }
    currentUserId = info.imUserId;
    try {
      await chat.login({ userID: info.imUserId, userSig: info.userSig });
    } catch (e) {
      // 已登录（复用同一 SDK 实例）时忽略
      if (e?.code !== 2000 && !/logined|already/i.test(e?.message || '')) throw e;
    }
    console.info('[im] 腾讯云 IM 已登录：' + info.imUserId);
    ws.emit('__imstatus', 'open');
    return chat;
  })().catch((e) => {
    loggingIn = null;
    ws.emit('__imstatus', 'closed');
    throw e;
  });
  return loggingIn;
}

export async function logoutIM() {
  loggingIn = null;
  currentUserId = '';
  ws.emit('__imstatus', 'closed');
  const c = chat;
  chat = null;
  if (c) {
    try {
      await c.logout();
    } catch {}
  }
}

function bindEvents(c, EVENT, TYPES) {
  c.on(EVENT.MESSAGE_RECEIVED, (event) => {
    (event?.data || []).forEach((msg) => dispatchIncoming(msg, TYPES));
  });
}

function dispatchIncoming(msg, TYPES) {
  if (!msg || msg.type !== TYPES.MSG_CUSTOM) return;
  const raw = msg.payload?.data ?? msg.payload?.Data;
  if (!raw) return;
  let env;
  try {
    env = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return;
  }
  if (!env || env.jc !== 1 || !env.event) return;
  ws.emit(env.event, env.data);
}
