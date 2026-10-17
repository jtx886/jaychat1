import nodemailer from 'nodemailer';
import { SMTP, DEV_MODE } from './config.js';

let transporter = null;
function getTransport() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: SMTP.host,
    port: SMTP.port,
    secure: SMTP.secure,
    auth: { user: SMTP.user, pass: SMTP.pass },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 12000,
  });
  return transporter;
}

function html(code) {
  return `
  <div style="font-family:-apple-system,'PingFang SC',sans-serif;max-width:520px;margin:auto;padding:28px;background:#f5f7fb;border-radius:16px">
    <h2 style="margin:0 0 8px;color:#111">Jay Chat 验证码</h2>
    <p style="color:#555;font-size:14px;margin:0 0 18px">你的验证码是（5 分钟内有效）：</p>
    <div style="font-size:34px;letter-spacing:10px;font-weight:700;color:#2b7cff;background:#fff;border-radius:12px;padding:16px;text-align:center">${code}</div>
    <p style="color:#999;font-size:12px;margin-top:18px">如非本人操作请忽略此邮件。</p>
  </div>`;
}

/**
 * 发送验证码邮件。
 * 返回 { sent: boolean, devCode?: string }
 * 沙箱/无外网 SMTP 环境下，DEV_MODE 会把验证码回传，便于调试。
 */
export async function sendCodeMail(email, code, purpose) {
  const subject = `【Jay Chat】${purpose === 'reset' ? '重置密码' : '注册'}验证码`;
  try {
    await getTransport().sendMail({
      from: `"${SMTP.fromName}" <${SMTP.from}>`,
      to: email,
      subject,
      html: html(code),
      text: `你的 Jay Chat 验证码是：${code}（5 分钟内有效）`,
    });
    console.log('[mail] 已发送验证码到', email);
    return { sent: true };
  } catch (e) {
    console.error('[mail] 发送失败:', e.message);
    console.log(`[mail][DEV] ${email} 验证码 = ${code}`);
    if (DEV_MODE) return { sent: false, devCode: code, error: e.message };
    return { sent: false, error: e.message };
  }
}
