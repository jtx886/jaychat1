import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { Avatar, Sheet, ActionSheet, toast } from '../components/ui.jsx';
import { IconTile } from '../components/icons.jsx';
import { maskEmail } from '../lib/time.js';
import { ensureNotificationPermission } from '../lib/notify.js';

export default function MeScreen() {
  const { me, setMe, logout, push, conversations, refreshConversations } = useApp();
  const [stats, setStats] = useState({ moments: 0, friends: 0 });
  const [confirmLogout, setConfirmLogout] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [m, f] = await Promise.all([api.get('/api/moments/mine'), api.get('/api/friends')]);
        setStats({ moments: (m.moments || []).length, friends: (f.friends || []).length });
      } catch {}
    })();
  }, [me?.id]);

  const remainder = (() => {
    const wk = weekKey();
    if (me?.name_week !== wk) return 2;
    return Math.max(0, 2 - (me?.name_count || 0));
  })();

  return (
    <>
      <div className="topbar">
        <div className="list-main">
          <div className="topbar-title">我的</div>
          <div className="topbar-sub">Jay Chat 个人中心</div>
        </div>
      </div>

      <div className="page-scroll with-nav">
        <div className="glass glass-strong mx" style={{ padding: 18, marginTop: 6 }}>
          <div className="flex gap12">
            <Avatar user={me} size={68} />
            <div className="grow">
              <div style={{ fontSize: 20, fontWeight: 800 }}>
                {me?.username}
                {me?.is_official ? <span className="badge-soft" style={{ marginLeft: 8 }}>官方账号</span> : null}
              </div>
              <div className="hint" style={{ marginTop: 4 }}>{maskEmail(me?.email)}</div>
              <div className="hint" style={{ marginTop: 2 }}>
                昵称修改：本周还剩 <b className="ok-text">{remainder}</b> 次（每周 2 次）
              </div>
            </div>
          </div>
          <div className="flex gap12" style={{ marginTop: 16 }}>
            <div className="glass pad grow center">
              <div style={{ fontSize: 19, fontWeight: 800 }}>{stats.moments}</div>
              <div className="hint">我的动态</div>
            </div>
            <div className="glass pad grow center">
              <div style={{ fontSize: 19, fontWeight: 800 }}>{stats.friends}</div>
              <div className="hint">好友</div>
            </div>
            <div className="glass pad grow center">
              <div style={{ fontSize: 19, fontWeight: 800 }}>{conversations.length}</div>
              <div className="hint">会话</div>
            </div>
          </div>
        </div>

        <div className="section-head">我的动态</div>
        <div className="glass mx">
          <div className="list">
            <div className="list-item" onClick={() => push('postMoment')}>
              <IconTile name="sparkle" tone="amber" />
              <div className="list-main">
                <div className="list-title">发布动态</div>
                <div className="list-desc">图文 / 视频，可设置谁可以看</div>
              </div>
              <span className="chev dim">›</span>
            </div>
            <div className="list-item" onClick={() => push('userMoments', { userId: me.id, mine: true })}>
              <IconTile name="gallery" tone="sky" />
              <div className="list-main">
                <div className="list-title">我的动态列表</div>
                <div className="list-desc">查看自己发布的全部动态</div>
              </div>
              <span className="chev dim">›</span>
            </div>
            <div className="list-item" onClick={() => push('moments', { scope: 'all' })}>
              <IconTile name="globe" tone="brand" />
              <div className="list-main">
                <div className="list-title">动态社区</div>
                <div className="list-desc">看看全站用户都在发什么</div>
              </div>
              <span className="chev dim">›</span>
            </div>
          </div>
        </div>

        <div className="section-head">隐私与安全</div>
        <div className="glass mx">
          <div className="list">
            <div className="list-item" onClick={() => push('blacklist')}>
              <IconTile name="ban" tone="rose" />
              <div className="list-main">
                <div className="list-title">黑名单</div>
                <div className="list-desc">查看已拉黑用户，可随时解除拉黑</div>
              </div>
              <span className="chev dim">›</span>
            </div>
          </div>
        </div>

        <div className="section-head">账号设置</div>
        <div className="glass mx">
          <div className="list">
            <div className="list-item" onClick={() => push('editProfile', { focus: 'avatar' })}>
              <IconTile name="image" tone="violet" />
              <div className="list-main">
                <div className="list-title">更换头像</div>
                <div className="list-desc">预设头像或上传本地图片</div>
              </div>
              <span className="chev dim">›</span>
            </div>
            <div className="list-item" onClick={() => push('editProfile', { focus: 'name' })}>
              <IconTile name="pencil" tone="cyan" />
              <div className="list-main">
                <div className="list-title">更换昵称</div>
                <div className="list-desc">1-6 个字符，每周最多 2 次（剩余 {remainder} 次）</div>
              </div>
              <span className="chev dim">›</span>
            </div>
            <div className="list-item" onClick={async () => { const ok = await ensureNotificationPermission(); toast(ok ? '通知权限已开启' : '通知权限未开启'); }}>
              <IconTile name="bell" tone="amber" />
              <div className="list-main">
                <div className="list-title">通知权限</div>
                <div className="list-desc">开启后可接收消息与互动通知</div>
              </div>
              <span className="chev dim">›</span>
            </div>
          </div>
        </div>

        <div className="mx" style={{ marginTop: 18 }}>
          <button className="btn btn-block btn-danger" onClick={() => setConfirmLogout(true)}>退出登录</button>
        </div>
        <div className="center hint" style={{ marginTop: 14 }}>Jay Chat v1.0.0</div>
      </div>

      <ActionSheet
        open={confirmLogout}
        onClose={() => setConfirmLogout(false)}
        title="确定要退出登录吗？"
        actions={[{ icon: <IconTile name="logout" tone="rose" box={34} size={18} />, label: '退出登录', danger: true, onClick: logout }]}
      />
    </>
  );
}

function weekKey(d = new Date()) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t - yearStart) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}
