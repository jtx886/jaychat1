import { WebSocketServer } from 'ws';
import { db, now } from './db.js';
import { verifyToken } from './auth.js';

/** uid -> Set<WebSocket> */
const clients = new Map();
/** uid -> offline 延时定时器 */
const offTimer = new Map();
let wss = null;

export function initRealtime(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url, 'http://localhost');
    const data = verifyToken(url.searchParams.get('token'));
    if (!data) {
      ws.close(4001, 'unauthorized');
      return;
    }
    const uid = data.uid;
    ws.uid = uid;

    if (!clients.has(uid)) clients.set(uid, new Set());
    clients.get(uid).add(ws);

    // 上线：取消离线延时，登记在线状态
    const t = offTimer.get(uid);
    if (t) {
      clearTimeout(t);
      offTimer.delete(uid);
    }
    const wasOffline = !db.prepare('SELECT online FROM users WHERE id = ?').get(uid)?.online;
    db.prepare('UPDATE users SET online = 1, last_seen = ? WHERE id = ?').run(now(), uid);
    if (wasOffline || t) broadcastPresence(uid, 1);

    ws.send(JSON.stringify({ type: 'ready', data: { uid, serverTime: now() } }));
    // 首次连接下发全量在线名单，前端可立即渲染
    ws.send(JSON.stringify({ type: 'presence:all', data: { userIds: onlineUserIds() } }));

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      handleClientEvent(uid, ws, msg);
    });

    const cleanup = () => {
      const set = clients.get(uid);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          clients.delete(uid);
          // 5 秒宽限期，避免刷新/切换网络误判离线
          const timer = setTimeout(() => {
            offTimer.delete(uid);
            db.prepare('UPDATE users SET online = 0, last_seen = ? WHERE id = ?').run(now(), uid);
            broadcastPresence(uid, 0);
          }, 5000);
          offTimer.set(uid, timer);
        }
      }
    };

    ws.on('close', cleanup);
    ws.on('error', cleanup);

    ws.isAlive = true;
    ws.on('pong', () => (ws.isAlive = true));
  });

  // 心跳保活
  const hb = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      try {
        ws.ping();
      } catch {}
    });
  }, 25000);
  wss.on('close', () => clearInterval(hb));

  return wss;
}

function handleClientEvent(uid, ws, msg) {
  // 目前客户端仅发送 typing 与 ping
  if (msg.type === 'ping') {
    ws.send(JSON.stringify({ type: 'pong', data: { t: now() } }));
    return;
  }
  if (msg.type === 'typing') {
    broadcast(
      { type: 'typing', data: { convType: msg.convType, convId: msg.convId, userId: uid } },
      uid,
    );
  }
}

function broadcastPresence(uid, online) {
  const u = db.prepare('SELECT id, username, avatar, last_seen FROM users WHERE id = ?').get(uid);
  broadcast({ type: 'presence', data: { userId: uid, online: !!online, user: u } });
}

export function broadcast(payload, exceptUid) {
  if (!wss) return;
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
  wss.clients.forEach((ws) => {
    if (ws.readyState === 1 && ws.uid !== exceptUid) {
      try {
        ws.send(raw);
      } catch {}
    }
  });
}

export function sendToUser(uid, payload) {
  const set = clients.get(Number(uid));
  if (!set) return false;
  const raw = typeof payload === 'string' ? payload : JSON.stringify(payload);
  let ok = false;
  set.forEach((ws) => {
    if (ws.readyState === 1) {
      try {
        ws.send(raw);
        ok = true;
      } catch {}
    }
  });
  return ok;
}

export function sendToUsers(uids, payload) {
  uids.forEach((u) => sendToUser(u, payload));
}

export function onlineUserIds() {
  return [...clients.keys()];
}

export function isOnline(uid) {
  return clients.has(Number(uid));
}
