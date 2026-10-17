import React, { useState } from 'react';
import { useApp } from '../App.jsx';
import { Avatar, Sheet, toast } from '../components/ui.jsx';
import { shortTime } from '../lib/time.js';

export default function HomeScreen() {
  const app = useApp();
  const { conversations, notifyUnread, push, me, wsStatus, imStatus } = app;
  const [menuOpen, setMenuOpen] = useState(false);
  const live = wsStatus === 'open' || imStatus === 'open';

  return (
    <>
      <div className="topbar">
        <button className="icon-btn" onClick={() => push('notifications')} aria-label="通知">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none">
            <path d="M6.5 10a5.5 5.5 0 0 1 11 0c0 4 1.3 5.2 1.8 5.9H4.7C5.2 15.2 6.5 14 6.5 10z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M10 18.4a2.2 2.2 0 0 0 4 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {notifyUnread > 0 ? <span className="badge-dot" style={{ position: 'absolute', top: 7, right: 7 }} /> : null}
        </button>
        <div className="list-main">
          <div className="topbar-title">
            首页
            <span style={{ fontSize: 11, fontWeight: 600, color: live ? 'var(--ok)' : 'var(--text-3)' }}>
              ● {live ? '实时连接中' : '连接中…'}
            </span>
          </div>
          <div className="topbar-sub">你好，{me?.username}</div>
        </div>
        <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="更多">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="page-scroll with-nav">
        {conversations.length === 0 ? (
          <div className="empty">
            <div className="icon">💬</div>
            还没有会话，去「联系人」添加好友或等待官方群消息吧
          </div>
        ) : null}

        <div className="list">
          {conversations.map((c) => (
            <div
              key={c.key}
              className="list-item press-scale"
              onClick={() => push('chat', { convType: c.conv_type, convId: c.conv_id, title: c.name, avatar: c.avatar, isOfficial: c.is_official })}
            >
              <Avatar
                user={c.peer || { id: c.conv_id, username: c.name, avatar: c.avatar, is_official: c.is_official }}
                size={50}
                online={c.conv_type === 'dm' ? c.online : undefined}
                onClick={
                  c.peer
                    ? (e) => { e.stopPropagation(); app.openUser({ ...c.peer, online: c.online }); }
                    : undefined
                }
              />
              <div className="list-main">
                <div className="list-title">
                  <span className="ellipsis">{c.name}</span>
                  {c.is_official ? <span className="badge-soft">官方</span> : null}
                </div>
                <div className="list-desc">
                  {c.conv_type === 'group' ? (
                    <span className="tag-online" style={{ color: c.online_count > 0 ? 'var(--ok)' : 'var(--text-3)' }}>
                      <i style={{ background: c.online_count > 0 ? 'var(--ok)' : 'var(--text-3)' }} />
                      {c.online_count} 人在线 / {c.member_count} 人
                    </span>
                  ) : c.online ? (
                    <span className="tag-online"><i />在线</span>
                  ) : (
                    <span className="dim">离线</span>
                  )}
                  {c.last ? <span className="dim" style={{ marginLeft: 8 }}>{c.last.text}</span> : null}
                </div>
              </div>
              <div className="list-meta">
                <span className="hint">{shortTime(c.last_time)}</span>
                {c.unread > 0 ? <span className="badge">{c.unread > 99 ? '99+' : c.unread}</span> : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)}>
        <div className="menu-list">
          <div
            className="menu-item"
            onClick={() => {
              setMenuOpen(false);
              push('addFriend', { tab: 'search' });
            }}
          >
            <span style={{ fontSize: 19 }}>🔍</span> 添加好友
            <span className="chev">›</span>
          </div>
          <div
            className="menu-item"
            onClick={() => {
              setMenuOpen(false);
              push('createGroup');
            }}
          >
            <span style={{ fontSize: 19 }}>👥</span> 创建群聊
            <span className="chev">›</span>
          </div>
          <div
            className="menu-item"
            onClick={() => {
              setMenuOpen(false);
              push('postMoment');
            }}
          >
            <span style={{ fontSize: 19 }}>✨</span> 发布动态
            <span className="chev">›</span>
          </div>
          <div
            className="menu-item"
            onClick={() => {
              setMenuOpen(false);
              push('moments', { scope: 'all' });
            }}
          >
            <span style={{ fontSize: 19 }}>🌍</span> 动态社区
            <span className="chev">›</span>
          </div>
        </div>
      </Sheet>
    </>
  );
}

export function goHomeTab(app, tab) {
  app.reset();
}
