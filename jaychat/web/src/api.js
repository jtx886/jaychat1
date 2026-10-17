/* ============ 全局配置与 HTTP / WebSocket 客户端 ============ */
const LS_SERVER = 'jc_server';
const LS_TOKEN = 'jc_token';
const LS_USER = 'jc_user';

export const isNative = () => typeof window !== 'undefined' && !!window.Capacitor?.isNativePlatform?.();
export const isAndroid = () => isNative() && window.Capacitor?.getPlatform?.() === 'android';

/** App 内置默认服务器地址（打包进 APK，免手填） */
const BUILTIN_BASE = 'https://jaychat-330497-11-1391073131.sh.run.tcloudbase.com';

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
  ws.close();
  ws.connect();
}

/** 媒体地址补全（后端返回 /uploads/xxx） */
export function mediaUrl(u) {
  if (!u) return '';
  if (/^(https?:)?\/\//.test(u) || u.startsWith('data:') || u.startsWith('blob:')) return u;
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
  if (!res.ok) throw new ApiError(data.error || `请求失败(${res.status})`, res.status);
  return data;
}

export const api = {
  get: (p, o) => http(p, o),
  post: (p, b, o) => http(p, { ...o, method: 'POST', body: b }),
  patch: (p, b, o) => http(p, { ...o, method: 'PATCH', body: b }),
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
  connect() {
    const token = tokenStore.get();
    if (!token) return;
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
  scheduleRetry() {
    if (this.timer) return;
    this.retry = Math.min(this.retry + 1, 8);
    this.timer = setTimeout(() => {
      this.timer = null;
      if (tokenStore.get()) this.connect();
    }, Math.min(1000 * this.retry, 6000));
  }
  send(obj) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(obj));
    else this.queue.push(obj);
  }
  typing(convType, convId) {
    this.send({ type: 'typing', convType, convId });
  }
  close() {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.ws) {
      this.ws.onclose = null;
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }
  }
}

export const ws = new Realtime();
