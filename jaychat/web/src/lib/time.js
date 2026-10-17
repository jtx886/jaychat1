import { pinyin } from 'pinyin-pro';

/** 全场景统一时间格式：YYYY-MM-DD HH:mm:ss（24 小时制） */
export function fullTime(ts) {
  const d = new Date(Number(ts) || Date.now());
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** 列表用的短时间：今天显示 HH:mm，昨天显示「昨天 HH:mm」，其它显示 MM-DD HH:mm */
export function shortTime(ts) {
  const t = Number(ts);
  if (!t) return '';
  const d = new Date(t);
  const now = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const hm = `${p(d.getHours())}:${p(d.getMinutes())}`;
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return hm;
  const y = new Date(now.getTime() - 86400000);
  if (d.toDateString() === y.toDateString()) return `昨天 ${hm}`;
  if (d.getFullYear() === now.getFullYear()) return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${hm}`;
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${hm}`;
}

/** 聊天气泡时间：YYYY-MM-DD HH:mm */
export function bubbleTime(ts) {
  const d = new Date(Number(ts) || Date.now());
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function fromNow(ts) {
  const diff = Date.now() - Number(ts);
  const m = Math.floor(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} 天前`;
  return fullTime(ts);
}

/** 名称首字母（中文取拼音首字母），用于联系人群组索引 */
export function initialOf(name) {
  if (!name) return '#';
  const ch = String(name).trim().charAt(0);
  if (!ch) return '#';
  if (/[a-zA-Z]/.test(ch)) return ch.toUpperCase();
  if (/[0-9]/.test(ch)) return '#';
  try {
    const py = pinyin(ch, { pattern: 'first', toneType: 'none', type: 'array' })?.[0];
    if (py && /[a-z]/i.test(py)) return py.toUpperCase();
  } catch {}
  return '#';
}

/** 按首字母分组排序 */
export function groupByInitial(list, nameOf = (x) => x.username) {
  const groups = new Map();
  list.forEach((item) => {
    const k = initialOf(nameOf(item));
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(item);
  });
  return [...groups.entries()]
    .sort((a, b) => (a[0] === '#' ? 1 : b[0] === '#' ? -1 : a[0].localeCompare(b[0])))
    .map(([letter, items]) => ({ letter, items }));
}

export function dayLabel(ts) {
  const d = new Date(Number(ts));
  const now = new Date();
  const p = (n) => String(n).padStart(2, '0');
  const same = d.toDateString() === now.toDateString();
  if (same) return '今天';
  const y = new Date(now.getTime() - 86400000);
  if (d.toDateString() === y.toDateString()) return '昨天';
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function maskEmail(e) {
  if (!e || !e.includes('@')) return e || '';
  const [a, b] = e.split('@');
  return `${a.slice(0, 2)}***@${b}`;
}

export function fmtDuration(sec) {
  const s = Math.max(0, Math.floor(sec));
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (d) return `${d} 天 ${h} 小时`;
  if (h) return `${h} 小时 ${m} 分`;
  if (m) return `${m} 分 ${ss} 秒`;
  return `${ss} 秒`;
}
