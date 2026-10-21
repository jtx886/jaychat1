/* ============ 全局配置与 HTTP / WebSocket 客户端 ============ */
const LS_SERVER = 'jc_server';
const LS_TOKEN = 'jc_token';
const LS_USER = 'jc_user';

export const isNative = () => typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
export const isAndroid = () => isNative() && window.Capacitor?.getPlatform?.() === 'android';

/** 轮询间隔（毫秒）：后端不支持 WebSocket 时自动降级为 HTTP 轮询 */
const POLL_MS = Number(import.meta.env.VITE_POLL_INTERVAL || 3000);

/** App 内置默认服务器地址（打包进 APK，免手填） */
const BUILTIN_BASE = 'http://jaychat.ct.ws';

/** 服务器地址：优先本地设置 > 构建时注入 > App 内置 > 同源（网页版） */
export function getBase() {
  const saved = localStorage.getItem(LS_SERVER);
  if (saved) return saved.replace(/\/$/, '');
  const env = import.meta.env.VITE_API_BASE;
  if (env) return String(env).replace(/\/$/, '');
  if (isNative()) return BUILTIN_BASE;
  return '';
}

export function setBase(url) {
  const v = String(url || '').trim().replace(/\/$/, '');
  if (v) localStorage.setItem(LS_SERVER, v);
  else localStorage.removeItem(LS_SERVER);
  ws.reset();
  ws.connect();
}

/** 视频扩展名（含服务端统一追加的 .dat 包装） */
const VIDEO_URL_RE = /\.(mp4|m4v|mov|webm|ogv|avi|mkv|3gp|flv|wmv|mpe?g)(\.dat)?$/i;

/** 媒体地址补全（后端返回 /uploads/xxx）
 *  视频走 /api/media 输出：保证 Content-Type 正确、支持 Range 拖动，
 *  且避免个别共享主机按 .mp4 扩展名拦截或清理文件。 */
export function mediaUrl(u) {
  if (!u) return '';
  if (/^(https?:)?\/\//.test(u) || u.startsWith('data:') || u.startsWith('blob:')) return u;
  const clean = u.split('#')[0];
  if (clean.startsWith('/uploads/') && VIDEO_URL_RE.test(clean)) {
    return getBase() + '/api/media?f=' + encodeURIComponent(clean.slice('/uploads/'.length));
  }
  return getBase() + u;
}

export const tokenStore = {
  get: () => localStorage.getItem(LS_TOKEN) || '',
  set: (t) => (t ? localStorage.setItem(LS_TOKEN, t) : localStorage.removeItem(LS_TOKEN)),
  user: () => {
    try {
      return JSON.parse(localStorage.getItem(LS_USER) || 'null');
    } catch {
      return null;
    }
  },
  setUser: (u) => (u ? localStorage.setItem(LS_USER, JSON.stringify(u)) : localStorage.removeItem(LS_USER)),
  clear: () => {
    localStorage.removeItem(LS_TOKEN);
    localStorage.removeItem(LS_USER);
  },
};

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function http(path, { method = 'GET', body, token, raw, timeout } = {}) {
  const headers = {};
  const t = token ?? tokenStore.get();
  if (t) headers.Authorization = `Bearer ${t}`;
  let payload;
  if (body instanceof FormData) {
    payload = body;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeout || 15000) : null;
  try {
    res = await fetch(getBase() + path, { method, headers, body: payload, signal: ctrl?.signal });
  } catch (e) {
    throw new ApiError(e?.name === 'AbortError' ? '请求超时，请检查网络或服务器地址' : '网络不可用，请检查网络或服务器地址', 0);
  } finally {
    if (timer) clearTimeout(timer);
  }
  if (raw) return res;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 后端未安装（PHP 版首次部署）→ 自动跳转到一键安装向导
    if (data && data.install && typeof window !== 'undefined') {
      try {
        window.location.replace('./install.php');
      } catch {}
    }
    throw new ApiError(data.error || `请求失败(${res.status})`, res.status);
  }
  return data;
}

export const api = {
  get: (p, o) => http(p, o),
  post: (p, b, o) => http(p, { ...o, method: 'POST', body: b }),
  // 部分共享主机/WAF 会拦截 PATCH/DELETE 等非常用方法，统一改用 POST，
  // 后端路由对 POST 做了 PATCH 兼容分发。
  patch: (p, b, o) => http(p, { ...o, method: 'POST', body: b }),
  del: (p, o) => http(p, { ...o, method: 'DELETE' }),
  upload: (file, kind) => {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', kind || (file.type?.startsWith('video') ? 'video' : 'image'));
    // 图片/视频上传体积大、耗时长，单独放宽超时（3 分钟）
    return http('/api/upload', { method: 'POST', body: fd, timeout: 180000 });
  },
};

/* ============ 实时 WebSocket（自动重连 + 事件订阅） ============ */
class Realtime {
  constructor() {
    this.ws = null;
    this.listeners = new Map();
    this.timer = null;
    this.retry = 0;
    this.queue = [];
    this.status = 'idle';
    this.mode = 'ws'; // ws | poll
    this.cursor = 0;
    this.polling = false; // 轮询循环是否已启动（避免重复 connect 起出多条轮询循环）
    this.pollCapable = null; // null=未探测 | 'yes'=后端支持轮询 | 'no'=后端无轮询（走 WebSocket）
  }
  on(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
    return () => this.listeners.get(type)?.delete(fn);
  }
  emit(type, data) {
    this.listeners.get(type)?.forEach((fn) => {
      try {
        fn(data);
      } catch (e) {
        console.error('listener error', type, e);
      }
    });
  }
  async connect() {
    const token = tokenStore.get();
    if (!token) return;
    if (this.mode === 'poll') return this.startPoll();
    // 先探测后端实时能力：PHP 版没有 WebSocket，可直接走轮询，不必空等 WS 重连
    if (this.pollCapable !== 'no') {
      const probe = this.pollCapable === 'yes' ? 'yes' : await this.probePoll();
      if (probe === 'yes') {
        this.pollCapable = 'yes';
        return this.startPoll();
      }
      if (probe === 'no') this.pollCapable = 'no';
      // 'unknown'：服务器暂不可达，继续尝试 WebSocket，由重连逻辑稍后再探测
    }
    if (!tokenStore.get()) return;
    const base = getBase();
    const url = (base || window.location.origin).replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(token);
    this.close();
    try {
      this.ws = new WebSocket(url);
    } catch {
      return this.scheduleRetry();
    }
    this.status = 'connecting';
    this.ws.onopen = () => {
      this.status = 'open';
      this.retry = 0;
      this.emit('__status', 'open');
      this.queue.splice(0).forEach((m) => this.send(m));
    };
    this.ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      this.emit(msg.type, msg.data);
      this.emit('__any', msg);
    };
    this.ws.onclose = () => {
      this.status = 'closed';
      this.emit('__status', 'closed');
      this.scheduleRetry();
    };
    this.ws.onerror = () => {};
  }
  /**
   * 探测后端实时能力：
   *   'yes'     —— 提供 /api/poll（PHP / InfinityFree 版），可直接走轮询
   *   'no'      —— 服务器有响应但没有轮询接口（Node 版），走 WebSocket
   *   'unknown' —— 未拿到 HTTP 响应（网络异常），稍后重试
   */
  async probePoll() {
    try {
      const d = await http('/api/poll', { timeout: 8000 });
      if (d && typeof d.cursor === 'number') {
        this.cursor = d.cursor;
        return 'yes';
      }
      return 'no';
    } catch (e) {
      return e && e.status ? 'no' : 'unknown';
    }
  }
  startPoll() {
    if (this.polling) return;
    this.polling = true;
    this.mode = 'poll';
    this.status = 'open';
    this.emit('__status', 'open');
    this.pollOnce();
  }
  async pollOnce() {
    if (this.mode !== 'poll' || !tokenStore.get()) return;
    try {
      const d = await http('/api/poll' + (this.cursor ? '?since=' + this.cursor : ''), { timeout: 20000 });
      if (typeof d?.cursor === 'number') this.cursor = d.cursor;
      (d?.events || []).forEach((e) => {
        if (!e || !e.type) return;
        this.emit(e.type, e.data);
        this.emit('__any', e);
      });
    } catch {}
    if (this.mode !== 'poll' || !tokenStore.get()) return;
    this.timer = setTimeout(() => this.pollOnce(), POLL_MS);
  }
  scheduleRetry() {
    if (this.timer) return;
    this.retry = Math.min(this.retry + 1, 8);
    const delay = Math.min(1000 * this.retry, 6000);
    this.timer = setTimeout(() => {
      this.timer = null;
      if (!tokenStore.get()) return;
      // connect() 内部会重新探测后端能力：能轮询就直接降级，否则继续连 WebSocket
      this.connect();
    }, delay);
  }
  send(obj) {
    if (this.mode === 'poll') return;
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(obj));
    else this.queue.push(obj);
  }
  typing(convType, convId) {
    if (this.mode === 'poll') {
      http('/api/typing', { method: 'POST', body: { convType, convId } }).catch(() => {});
      return;
    }
    this.send({ type: 'typing', convType, convId });
  }
  close() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.polling = false;
    if (this.ws) {
      this.ws.onclose = null;
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }
  /** 重置连接状态（切换服务器地址时调用，下次 connect() 会重新探测后端能力） */
  reset() {
    this.close();
    this.mode = 'ws';
    this.cursor = 0;
    this.pollCapable = null;
    this.retry = 0;
    this.queue = [];
    this.status = 'idle';
  }
}

export const ws = new Realtime();
