/* ============ 设备通知（安卓原生本地通知 / 浏览器通知） ============ */
import { isNative } from '../api.js';

const LN = () => window.Capacitor?.Plugins?.LocalNotifications;

let granted = false;

export async function ensureNotificationPermission() {
  try {
    if (isNative() && LN()) {
      const r = await LN().checkPermissions();
      if (r.display === 'granted') {
        granted = true;
        return true;
      }
      const req = await LN().requestPermissions();
      granted = req.display === 'granted';
      return granted;
    }
    if (typeof Notification !== 'undefined') {
      if (Notification.permission === 'granted') {
        granted = true;
        return true;
      }
      if (Notification.permission === 'denied') return false;
      const p = await Notification.requestPermission();
      granted = p === 'granted';
      return granted;
    }
  } catch (e) {
    console.warn('通知权限获取失败', e);
  }
  return false;
}

export async function pushNotification({ title, body, tag }) {
  if (!granted) return false;
  try {
    if (isNative() && LN()) {
      await LN().schedule({
        notifications: [
          {
            id: Math.floor(Math.random() * 2000000),
            title,
            body,
            smallIcon: 'ic_stat_icon_config_sample',
            iconColor: '#3b6dff',
            channelId: 'jaychat',
            schedule: { at: new Date(Date.now() + 60) },
          },
        ],
      });
      return true;
    }
    if (typeof Notification !== 'undefined') {
      const n = new Notification(title, { body, tag, icon: '/assets/official-group.svg' });
      n.onclick = () => window.focus?.();
      return true;
    }
  } catch (e) {
    console.warn('通知发送失败', e);
  }
  return false;
}

export async function createChannel() {
  try {
    if (isNative() && LN()) {
      await LN().createChannel({
        id: 'jaychat',
        name: 'Jay Chat 消息通知',
        description: '新消息与互动通知',
        importance: 5,
        visibility: 1,
        vibration: true,
        lights: true,
      });
    }
  } catch {}
}
