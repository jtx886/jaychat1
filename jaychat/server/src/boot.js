/* 容器启动入口：先把云端数据恢复到本地，再加载服务本体
 * （必须与 index.js 分开：index.js 会在导入时立即打开本地 SQLite） */
import { restoreDbFromCos } from './backup.js';

try {
  const restored = await restoreDbFromCos();
  if (restored) console.log('[persist] 已从 COS 恢复数据库');
} catch (e) {
  console.warn('[persist] 恢复数据库失败，改用本地数据启动：', e.message);
}

await import('./index.js');
