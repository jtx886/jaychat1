import express from 'express';
import { requireAuth } from '../auth.js';
import { IM, imUserId } from '../config.js';
import { genUserSig } from '../im.js';
import { ensureUserIm, sendAiGroupMessage } from '../im-sync.js';
import { getUser, publicUser, memberRole } from '../store.js';
import { askAI, AI_SYSTEM_PROMPT } from '../ai.js';
import { db } from '../db.js';

const router = express.Router();
router.use(requireAuth);

/** 当前用户的腾讯云 IM 登录票据 */
router.get('/im/usersig', async (req, res) => {
  const u = getUser(req.uid);
  if (!u) return res.status(404).json({ error: '用户不存在' });
  try {
    await ensureUserIm(u.id);
  } catch (e) {
    console.warn('[im] ensureUserIm 失败', e.message);
  }
  res.json({
    sdkAppId: IM.sdkAppId,
    imUserId: imUserId(u.id),
    userSig: genUserSig(imUserId(u.id)),
    aiAccount: IM.aiAccount,
    expire: IM.expire,
  });
});

/** 官方群 @Jay AI 提问：立即返回，AI 在群里异步回复 */
router.post('/ai/ask', (req, res) => {
  const gid = Number(req.body?.groupId);
  const question = String(req.body?.question || '').slice(0, 500);
  const g = db.prepare('SELECT * FROM groups WHERE id = ?').get(gid);
  if (!g?.is_official) return res.status(403).json({ error: '仅 Jay Chat 官方群支持 Jay AI' });
  if (!memberRole(gid, req.uid)) return res.status(403).json({ error: '你不在该群中' });
  res.json({ ok: true });
  handleAi(gid, req.uid, question).catch((e) => console.warn('[ai] 回复失败', e.message));
});

async function handleAi(gid, askerId, question) {
  const asker = publicUser(getUser(askerId));
  const prompt = String(question).replace(/@?\s*jay\s*ai\s*[:：,，]?/gi, '').trim() || '你好';
  const sys =
    `${AI_SYSTEM_PROMPT}\n当前提问者是「${asker.username}」。` +
    `请在回复的第一行单独写「@${asker.username}」，从第二行开始回答。`;
  const r = await askAI([
    { role: 'system', content: sys },
    { role: 'user', content: prompt },
  ]);
  let text = r.ok ? r.text : `抱歉，Jay AI 暂时无法回答（${r.error || '未知错误'}），请稍后再试。`;
  if (!text.startsWith(`@${asker.username}`)) text = `@${asker.username}\n${text}`;
  await sendAiGroupMessage(gid, text);
}

export default router;
