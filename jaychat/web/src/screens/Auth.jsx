import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { toast, Spinner, LogoMark } from '../components/ui.jsx';
import { ensureNotificationPermission } from '../lib/notify.js';

const EMAIL_RE = /^[A-Za-z0-9._%+-]+@(qq\.com|163\.com)$/;

export default function AuthScreen() {
  const { login } = useApp();
  const [view, setView] = useState('login'); // login | register | forgot
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    account: '', password: '',
    username: '', email: '', regPassword: '', regCode: '',
    fEmail: '', fCode: '', fPassword: '', fConfirm: '',
  });
  const [countdown, setCountdown] = useState(0);
  // 免费主机没有邮件服务，验证码会由后端直接返回：这里只做展示，不自动填入
  const [codeHint, setCodeHint] = useState({ register: '', reset: '' });

  useEffect(() => {
    if (!countdown) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const sendCode = async (email, purpose) => {
    if (!EMAIL_RE.test(email)) return toast('邮箱只支持 @qq.com 或 @163.com', 'error');
    setBusy(true);
    try {
      const d = await api.post('/api/auth/send-code', { email, purpose });
      setCountdown(60);
      if (d.devCode) {
        setCodeHint((h) => ({ ...h, [purpose]: d.devCode }));
        toast(`验证码已生成：${d.devCode}`);
      } else {
        toast(d.hint || '验证码已发送');
      }
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const doLogin = async () => {
    if (!form.account.trim() || !form.password) return toast('请输入账号和密码', 'error');
    setBusy(true);
    try {
      const d = await api.post('/api/auth/login', { account: form.account.trim(), password: form.password });
      await login(d.token, d.user);
      ensureNotificationPermission();
      toast(`欢迎回来，${d.user.username}`);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const doRegister = async () => {
    const u = form.username.trim();
    if (u.length < 1 || u.length > 6) return toast('昵称只能为 1-6 个字符', 'error');
    if (!EMAIL_RE.test(form.email)) return toast('邮箱只支持 @qq.com 或 @163.com', 'error');
    if (form.regPassword.length < 6) return toast('密码至少 6 位', 'error');
    if (!form.regCode.trim()) return toast('请输入邮箱验证码', 'error');
    setBusy(true);
    try {
      const d = await api.post('/api/auth/register', {
        username: u, email: form.email, password: form.regPassword, code: form.regCode.trim(),
      });
      await login(d.token, d.user);
      ensureNotificationPermission();
      toast('注册成功，已自动加入 Jay Chat官方群');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const doReset = async () => {
    if (!EMAIL_RE.test(form.fEmail)) return toast('请输入注册时使用的 @qq.com / @163.com 邮箱', 'error');
    if (!form.fCode.trim()) return toast('请输入验证码', 'error');
    if (form.fPassword.length < 6) return toast('新密码至少 6 位', 'error');
    if (form.fPassword !== form.fConfirm) return toast('两次输入的密码不一致', 'error');
    setBusy(true);
    try {
      await api.post('/api/auth/reset-password', { email: form.fEmail, code: form.fCode.trim(), password: form.fPassword });
      toast('密码已重置，请使用新密码登录');
      setView('login');
      setForm((f) => ({ ...f, account: f.fEmail, password: '', fCode: '', fPassword: '', fConfirm: '' }));
      setCodeHint((h) => ({ ...h, reset: '' }));
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ position: 'relative', zIndex: 2, height: '100%', display: 'flex', flexDirection: 'column', paddingTop: 'var(--safe-t)' }}>
      {/*
        注意：这里不要用 justifyContent:center。内容比可视高度高时（手机上带浏览器
        工具栏很常见），居中会导致内容被裁剪且无法滚动。改用 margin:auto —— 
        放得下时垂直居中，放不下时边距归零、内容从顶部开始并可正常滚动。
      */}
      <div className="page-scroll" style={{ display: 'flex', flexDirection: 'column', padding: '24px 20px' }}>
        <div style={{ margin: 'auto 0', flexShrink: 0, width: '100%' }}>
          <div style={{ textAlign: 'center', marginBottom: 26 }}>
            <LogoMark size={86} />
            <div className="splash-name" style={{ fontSize: 30 }}>Jay Chat</div>
            <div className="hint" style={{ marginTop: 8 }}>跨网络 · 实时聊天 · 官方群 · Jay AI</div>
          </div>

          <div className="glass glass-strong pad" style={{ padding: 20 }}>
            {view === 'login' ? (
              <>
                <div className="sheet-title" style={{ textAlign: 'left', fontSize: 19, marginBottom: 16 }}>登录</div>
                <div className="field">
                  <label>用户名 / 邮箱</label>
                  <input className="input" placeholder="输入用户名或 @qq.com / @163.com 邮箱" value={form.account} onChange={set('account')} autoComplete="username" />
                </div>
                <div className="field">
                  <label>密码</label>
                  <input className="input" type="password" placeholder="输入密码" value={form.password} onChange={set('password')} autoComplete="current-password" onKeyDown={(e) => e.key === 'Enter' && doLogin()} />
                </div>
                <button className="btn btn-primary btn-block" disabled={busy} onClick={doLogin}>
                  {busy ? <Spinner size={18} /> : '登录'}
                </button>
                <div className="flex-between mt" style={{ marginTop: 14 }}>
                  <span className="hint press-scale" onClick={() => setView('forgot')} style={{ cursor: 'pointer' }}>忘记密码？</span>
                  <span className="hint press-scale" onClick={() => setView('register')} style={{ cursor: 'pointer', color: 'var(--brand-2)' }}>
                    没有账号？立即注册
                  </span>
                </div>
              </>
            ) : view === 'register' ? (
              <>
                <div className="sheet-title" style={{ textAlign: 'left', fontSize: 19, marginBottom: 16 }}>注册</div>
                <div className="field">
                  <label>昵称（1-6 个字符）</label>
                  <input className="input" placeholder="给自己取个名字" maxLength={6} value={form.username} onChange={set('username')} />
                  <div className="hint">{form.username.trim().length}/6</div>
                </div>
                <div className="field">
                  <label>邮箱（仅支持 @qq.com / @163.com）</label>
                  <input className="input" placeholder="example@qq.com" value={form.email} onChange={set('email')} />
                </div>
                <div className="field">
                  <label>密码</label>
                  <input className="input" type="password" placeholder="至少 6 位" value={form.regPassword} onChange={set('regPassword')} />
                </div>
                <div className="field">
                  <label>邮箱验证码</label>
                  <div className="input-row">
                    <input className="input" placeholder="6 位验证码" value={form.regCode} onChange={set('regCode')} />
                    <button className="btn" style={{ padding: '0 14px', whiteSpace: 'nowrap' }} disabled={busy || countdown > 0} onClick={() => sendCode(form.email, 'register')}>
                      {countdown > 0 ? `${countdown}s` : '获取验证码'}
                    </button>
                  </div>
                  {codeHint.register ? (
                    <div className="dev-code">
                      <span className="dev-code-label">本主机不支持发送邮件，验证码为（请手动填入）：</span>
                      <span className="dev-code-value">{codeHint.register}</span>
                    </div>
                  ) : null}
                </div>
                <button className="btn btn-primary btn-block" disabled={busy} onClick={doRegister}>
                  {busy ? <Spinner size={18} /> : '注册并登录'}
                </button>
                <div className="center mt" style={{ marginTop: 14 }}>
                  <span className="hint press-scale" onClick={() => setView('login')} style={{ cursor: 'pointer' }}>已有账号？返回登录</span>
                </div>
              </>
            ) : (
              <>
                <div className="sheet-title" style={{ textAlign: 'left', fontSize: 19, marginBottom: 16 }}>忘记密码</div>
                <div className="field">
                  <label>注册时使用的邮箱</label>
                  <input className="input" placeholder="example@qq.com" value={form.fEmail} onChange={set('fEmail')} />
                </div>
                <div className="field">
                  <label>验证码</label>
                  <div className="input-row">
                    <input className="input" placeholder="6 位验证码" value={form.fCode} onChange={set('fCode')} />
                    <button className="btn" style={{ padding: '0 14px', whiteSpace: 'nowrap' }} disabled={busy || countdown > 0} onClick={() => sendCode(form.fEmail, 'reset')}>
                      {countdown > 0 ? `${countdown}s` : '获取验证码'}
                    </button>
                  </div>
                  {codeHint.reset ? (
                    <div className="dev-code">
                      <span className="dev-code-label">本主机不支持发送邮件，验证码为（请手动填入）：</span>
                      <span className="dev-code-value">{codeHint.reset}</span>
                    </div>
                  ) : null}
                </div>
                <div className="field">
                  <label>新密码</label>
                  <input className="input" type="password" placeholder="至少 6 位" value={form.fPassword} onChange={set('fPassword')} />
                </div>
                <div className="field">
                  <label>确认新密码</label>
                  <input className="input" type="password" placeholder="再次输入新密码" value={form.fConfirm} onChange={set('fConfirm')} />
                </div>
                <button className="btn btn-primary btn-block" disabled={busy} onClick={doReset}>
                  {busy ? <Spinner size={18} /> : '确认修改密码'}
                </button>
                <div className="center mt" style={{ marginTop: 14 }}>
                  <span className="hint press-scale" onClick={() => setView('login')} style={{ cursor: 'pointer' }}>返回登录</span>
                </div>
              </>
            )}
          </div>

          <div className="center hint" style={{ marginTop: 18 }}>
            官方账号：杰同学（官方群群主）
          </div>
        </div>
      </div>
    </div>
  );
}
