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

/** 媒体地址补全（后端返回 /uploads/xxx）
 *  统一走 /api/media 输出：
 *   - 保证 Content-Type 正确（部分主机按扩展名返回错误类型，导致图片不显示、视频不能播）
 *   - 支持 Range（视频拖动进度条必需）
 *   - 部分共享主机（InfinityFree 等）会拦截或清理 /uploads 下的直链，走接口可绕过
 *  图片与视频一视同仁，避免「视频能看、图片打不开」这类不一致问题。 */
export function mediaUrl(u) {
  if (!u) return '';
  if (/^(https?:)?\/\//.test(u) || u.startsWith('data:') || u.startsWith('blob:')) return u;
  const clean = u.split('#')[0];
  if (clean.startsWith('/uploads/')) {
    return getBase() + '/api/media?f=' + encodeURIComponent(clean.slice('/uploads/'.length));
  }
  return getBase() + u;
}

/**
 * 直链地址（备用）：/uploads/... 直接访问。
 * 正常情况下走 /api/media；万一接口不可用，前端会自动降级到这里。
 */
export function directMediaUrl(u) {
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
  upload: (file, kind) => uploadFile(file, kind),
};

/* ============ 文件上传（压缩 + 多协议自动降级） ============
 * 共享主机常见的三个坑，这里逐一兜住：
 *   1) 手机原图 3~8MB，超过主机 upload_max_filesize / post_max_size → 先在前端压缩到 1MB 内；
 *   2) 部分主机/WAF 直接拦截 multipart/form-data 并返回 403 → 自动改用 application/octet-stream；
 *   3) 视频动辄十几 MB，任何单次请求都超限 → 自动切片上传（每片 512KB）后由服务端合并。
 * 三者任意一条可用，上传就能成功。
 */
const UPLOAD_TIMEOUT = 180000;
const CHUNK_SIZE = 512 * 1024;
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
// 单次请求安全的体积上限：免费主机 upload_max_filesize 通常只有 2MB，
// 超过这个值直接走分片，避免先发一次注定失败的大请求。
const SINGLE_MAX = 1200 * 1024;
const IMAGE_TARGET = 700 * 1024;
const IMAGE_MAX_SIDE = 1920;

function randomHex(n) {
  const bytes = new Uint8Array(n);
  (globalThis.crypto || window.crypto).getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode failed'));
    };
    img.src = url;
  });
}

function imageTypeOf(file) {
  const t = (file?.type || '').toLowerCase();
  if (t.startsWith('image/')) return t;
  const name = (file?.name || '').toLowerCase();
  if (/\.jpe?g$/.test(name)) return 'image/jpeg';
  if (/\.png$/.test(name)) return 'image/png';
  if (/\.gif$/.test(name)) return 'image/gif';
  if (/\.webp$/.test(name)) return 'image/webp';
  if (/\.bmp$/.test(name)) return 'image/bmp';
  return '';
}

/**
 * 图片压缩：逐级缩小长边并把质量压到目标体积以内。
 * 免费主机单文件上限可能只有 2MB，压缩到 700KB 内后任何协议都能传上去。
 * 解码失败（如 HEIC）时原样返回，交给分片上传 / 明确的错误提示处理。
 */
async function compressImage(file) {
  if (!file) return file;
  const type = imageTypeOf(file);
  if (!type) return file;
  // GIF/WebP 可能带动画，SVG 是矢量，压缩会丢失信息，直接原样上传
  if (type === 'image/gif' || type === 'image/webp' || type === 'image/svg+xml') return file;
  if (file.size <= IMAGE_TARGET) return file;
  let img;
  try {
    img = await loadImage(file);
  } catch {
    return file;
  }
  const render = (side, quality) => new Promise((resolve) => {
    try {
      const scale = Math.min(1, side / Math.max(img.width, img.height));
      const width = Math.max(1, Math.round(img.width * scale));
      const height = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);
      // JPEG 无透明通道，先铺白底避免透明区域变黑
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(blob), 'image/jpeg', quality);
    } catch {
      resolve(null);
    }
  });
  try {
    let best = null;
    const sides = [IMAGE_MAX_SIDE, 1440, 1080, 800, 640];
    for (const side of sides) {
      const blob = await render(side, 0.82);
      if (!blob) continue;
      if (!best || blob.size < best.size) best = blob;
      if (blob.size <= IMAGE_TARGET) break;
    }
    if (!best || best.size >= file.size) return file;
    const base = (file.name || 'image').replace(/\.[^.]+$/, '') || 'image';
    return new File([best], base + '.jpg', { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

async function uploadDirect(file, kind, mode) {
  const t = tokenStore.get();
  const headers = {};
  if (t) headers.Authorization = `Bearer ${t}`;
  let body;
  if (mode === 'raw') {
    headers['Content-Type'] = 'application/octet-stream';
    headers['X-File-Name'] = encodeURIComponent(file.name || 'upload');
    headers['X-File-Kind'] = kind;
    body = file;
  } else {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', kind);
    body = fd;
  }
  const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), UPLOAD_TIMEOUT) : null;
  let res;
  try {
    res = await fetch(getBase() + '/api/upload', { method: 'POST', headers, body, signal: ctrl?.signal });
  } catch (e) {
    throw new ApiError(e?.name === 'AbortError' ? '上传超时，请重试' : '上传失败：网络连接被中断，请换用 WiFi/移动网络后重试', 0);
  } finally {
    if (timer) clearTimeout(timer);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `上传失败(${res.status})`, res.status);
  if (!data || !data.url) throw new ApiError('上传失败：服务器未返回文件地址', 0);
  return data;
}

/** 分片上传：绕过主机对单次请求体积的限制（视频必用） */
async function uploadChunked(file, kind) {
  const total = Math.max(1, Math.ceil(file.size / CHUNK_SIZE));
  if (total > 400) throw new ApiError('文件过大，请选择更小的文件', 400);
  const id = randomHex(16);
  const t = tokenStore.get();
  const headers = {
    ...(t ? { Authorization: `Bearer ${t}` } : {}),
    'Content-Type': 'application/octet-stream',
    'X-Upload-Id': id,
    'X-Chunk-Total': String(total),
    'X-File-Name': encodeURIComponent(file.name || 'upload'),
    'X-File-Kind': kind,
  };

  const postChunk = async (index) => {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(() => ctrl.abort(), 60000) : null;
    let res;
    try {
      res = await fetch(getBase() + '/api/upload/chunk', {
        method: 'POST',
        headers: { ...headers, 'X-Chunk-Index': String(index) },
        body: file.slice(index * CHUNK_SIZE, (index + 1) * CHUNK_SIZE),
        signal: ctrl?.signal,
      });
    } catch (e) {
      throw new ApiError(e?.name === 'AbortError' ? '分片上传超时，请重试' : '上传失败：网络连接被中断，请换用 WiFi/移动网络后重试', 0);
    } finally {
      if (timer) clearTimeout(timer);
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || `上传失败(${res.status})`, res.status);
    return data;
  };

  for (let i = 0; i < total; i += 1) {
    let data;
    try {
      data = await postChunk(i);
    } catch (e) {
      // 网络抖动导致单片失败时自动重试一次（鉴权/参数类错误不重试）
      if (!e.status) {
        await new Promise((r) => setTimeout(r, 600));
        data = await postChunk(i);
      } else {
        throw e;
      }
    }
    if (data && data.url) return data;
  }
  throw new ApiError('上传未完成，请重试', 0);
}

async function uploadFile(file, kind) {
  if (!file) throw new ApiError('未选择文件', 400);
  const k = kind || (file.type?.startsWith('video') ? 'video' : 'image');
  if (k === 'image' && (/\.(heic|heif)$/i.test(file.name || '') || /^image\/hei[cf]$/i.test(file.type || ''))) {
    throw new ApiError('该图片为 HEIC/HEIF 格式，请先在相册中转换为 JPG 再上传', 400);
  }
  const prepared = k === 'image' ? await compressImage(file) : file;
  if (prepared.size > MAX_UPLOAD_BYTES) {
    throw new ApiError('文件超过 10MB，请选择更小的文件（视频请先裁剪）', 400);
  }
  // 超过单请求安全上限：直接分片，永远不撞主机的 2MB / post_max_size 限制
  if (prepared.size > SINGLE_MAX) {
    return uploadChunked(prepared, k);
  }
  try {
    return await uploadDirect(prepared, k, 'form');
  } catch (e) {
    if (e.status === 401 || e.status === 429) throw e;
    try {
      // 主机/WAF 拦截 multipart 时，改发原始二进制
      return await uploadDirect(prepared, k, 'raw');
    } catch (e2) {
      if (e2.status === 401 || e2.status === 429) throw e2;
      try {
        // 仍然失败：改用分片（可绕过单请求体积与表单限制）
        return await uploadChunked(prepared, k);
      } catch (e3) {
        if (e2.status === 0 || e3.status === 0) {
          throw new ApiError('上传失败：网络连接被中断，请换用 WiFi/移动网络后重试', 0);
        }
        throw e2;
      }
    }
  }
}

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
    this.longPoll = true; // 是否启用长轮询（主机不支持时自动退回固定间隔轮询）
    this.pollFail = 0;
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
    let ok = false;
    const wait = this.longPoll ? 12 : 0;
    try {
      const d = await http(
        '/api/poll?since=' + this.cursor + (wait ? '&wait=' + wait : ''),
        { timeout: wait ? (wait + 8) * 1000 : 20000 },
      );
      ok = true;
      if (typeof d?.cursor === 'number') this.cursor = d.cursor;
      (d?.events || []).forEach((e) => {
        if (!e || !e.type) return;
        this.emit(e.type, e.data);
        this.emit('__any', e);
      });
    } catch {}
    if (ok) {
      this.pollFail = 0;
    } else if (this.longPoll) {
      this.pollFail += 1;
      // 连续失败说明主机不允许长连接（或超时被中断）→ 退回固定间隔轮询
      if (this.pollFail >= 2) this.longPoll = false;
    }
    if (this.mode !== 'poll' || !tokenStore.get()) return;
    // 长轮询成功后立刻开始下一次（服务器会挂起等待新事件），否则退回固定间隔
    const delay = ok && this.longPoll ? 120 : POLL_MS;
    this.timer = setTimeout(() => this.pollOnce(), delay);
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
    this.longPoll = true;
    this.pollFail = 0;
    this.retry = 0;
    this.queue = [];
    this.status = 'idle';
  }
}

export const ws = new Realtime();
