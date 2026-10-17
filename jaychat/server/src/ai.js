import { AI } from './config.js';

const TIMEOUT = 30000;

/**
 * 调用智谱 GLM-4-Flash。
 * messages: [{role:'system'|'user'|'assistant', content:string}]
 */
export async function askAI(messages) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(AI.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${AI.key}`,
      },
      body: JSON.stringify({ model: AI.model, messages, temperature: 0.7, max_tokens: 800 }),
      signal: ctrl.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('[ai] 接口错误', res.status, JSON.stringify(data).slice(0, 300));
      return { ok: false, error: data?.error?.message || `AI 接口错误(${res.status})` };
    }
    const text = data?.choices?.[0]?.message?.content || '';
    return { ok: true, text: text.trim() };
  } catch (e) {
    console.error('[ai] 请求失败', e.message);
    return { ok: false, error: e.message };
  } finally {
    clearTimeout(timer);
  }
}

export const AI_SYSTEM_PROMPT =
  '你是「Jay AI」，Jay Chat 官方群里的智能机器人，性格热情、简洁、靠谱。' +
  '回答使用简体中文，口语化，尽量控制在 120 字以内，必要时用短列表。';
