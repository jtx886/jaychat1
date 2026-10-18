/* SQLite 数据库云端持久化：启动前恢复 + 运行期定时快照到 COS */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DATA_DIR, COS } from './config.js';
import { cosEnabled, uploadFile, downloadFile } from './cos.js';

const DB_FILE = path.join(DATA_DIR, 'jaychat.db');
const BACKUP_KEY = `${COS.prefix}/backup/jaychat.db`;
let lastHash = '';

const sqlStr = (p) => `'${p.replace(/'/g, "''")}'`; // SQLite 字符串转义

/** 启动前调用：云端存在备份则恢复到本地，返回是否恢复 */
export async function restoreDbFromCos() {
  if (!cosEnabled()) return false;
  const tmp = `${DB_FILE}.restore`;
  const ok = await downloadFile(BACKUP_KEY, tmp);
  if (!ok) return false;
  // 丢弃旧 WAL/SHM，避免与恢复出的库不一致
  for (const f of [`${DB_FILE}-wal`, `${DB_FILE}-shm`]) {
    try { fs.unlinkSync(f); } catch {}
  }
  fs.renameSync(tmp, DB_FILE);
  return true;
}

/** 生成一致性快照并上传；内容未变化（force=false）时跳过上传 */
export async function snapshotToCos(db, force = false) {
  if (!cosEnabled()) return { uploaded: false, reason: 'disabled' };
  const tmp = `${DB_FILE}.snap`;
  try { fs.unlinkSync(tmp); } catch {}
  try {
    db.exec(`VACUUM INTO ${sqlStr(tmp)}`);
    const buf = fs.readFileSync(tmp);
    const hash = crypto.createHash('sha1').update(buf).digest('hex');
    if (!force && hash === lastHash) return { uploaded: false, reason: 'unchanged' };
    await uploadFile(tmp, BACKUP_KEY, 'application/octet-stream');
    lastHash = hash;
    return { uploaded: true, bytes: buf.length };
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

/** 启动定时备份循环，返回定时器（未配置 COS 时返回 null） */
export function startBackupLoop(db, intervalMs) {
  if (!cosEnabled()) {
    console.log('[persist] 未配置 COS，数据仅存本地磁盘（容器重建会丢失）');
    return null;
  }
  console.log(`[persist] 已启用 COS 备份，间隔 ${Math.round(intervalMs / 1000)}s，桶 ${COS.bucket}`);
  const tick = () => snapshotToCos(db).catch((e) => console.warn('[persist] 备份失败：', e.message));
  tick();
  const timer = setInterval(tick, intervalMs);
  timer.unref?.();
  return timer;
}
