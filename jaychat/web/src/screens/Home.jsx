import React, { useRef, useState } from 'react';
import { useApp } from '../App.jsx';
import { Avatar, Sheet, ActionSheet, toast } from '../components/ui.jsx';
import { Icon, IconTile } from '../components/icons.jsx';
import { api } from '../api.js';
import { shortTime } from '../lib/time.js';

export default function HomeScreen() {
  const app = useApp();
  const { conversations, notifyUnread, push, me, wsStatus, imStatus, refreshConversations } = app;
  const [menuOpen, setMenuOpen] = useState(false);
  const [convMenu, setConvMenu] = useState(null); // 当前长按的会话
  const [pressKey, setPressKey] = useState('');
  const press = useRef({ timer: null, fired: false });
  const live = wsStatus === 'open' || imStatus === 'open';

  const startPress = (c) => {
    press.current.fired = false;
    setPressKey(c.key);
    clearTimeout(press.current.timer);
    press.current.timer = setTimeout(() => {
      press.current.fired = true;
      setPressKey('');
      setConvMenu(c);
    }, 460);
  };
  const cancelPress = () => {
    clearTimeout(press.current.timer);
    setPressKey('');
  };
  const openConv = (c) => {
    if (press.current.fired) {
      press.current.fired = false;
      return;
    }
    push('chat', { convType: c.conv_type, convId: c.conv_id, title: c.name, avatar: c.avatar, isOfficial: c.is_official });
  };

  const togglePin = async (c) => {
    const next = !c.pinned;
    try {
      await api.patch('/api/conversations/pin', { convType: c.conv_type, convId: c.conv_id, pinned: next });
      await refreshConversations();
      toast(next ? '已置顶该会话' : '已取消置顶');
    } catch (e) {
      toast(e?.message || '操作失败', 'error');
    }
  };

  const toggleDnd = async (c) => {
    const next = !c.dnd;
    try {
      if (c.conv_type === 'group') {
        await api.patch(`/api/groups/${c.conv_id}/dnd`, { dnd: next });
      } else {
        const peerId = Number(String(c.conv_id).split('_').find((x) => Number(x) !== me?.id));
        await api.patch('/api/dm-dnd', { peerId, dnd: next });
      }
      await refreshConversations();
      toast(next ? '已开启免打扰' : '已关闭免打扰');
    } catch (e) {
      toast(e?.message || '操作失败', 'error');
    }
  };

  return (
    <>
      <div className="topbar">
        <button className="icon-btn" onClick={() => push('notifications')} aria-label="通知">
          <Icon name="bell" size={19} strokeWidth={1.8} />
          {notifyUnread > 0 ? <span className="badge-dot" style={{ position: 'absolute', top: 7, right: 7 }} /> : null}
        </button>
        <div className="list-main">
          <div className="topbar-title">
            首页
            <span style={{ marginLeft: 7, fontSize: 11, fontWeight: 600, color: live ? 'var(--ok)' : 'var(--text-3)', display: 'inline-flex', alignItems: 'center', gap: 4, verticalAlign: 'middle' }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'currentColor', display: 'inline-block' }} />
              {live ? '实时连接中' : '连接中…'}
            </span>
          </div>
          <div className="topbar-sub">你好，{me?.username}</div>
        </div>
        <button className="icon-btn" onClick={() => setMenuOpen(true)} aria-label="更多">
          <Icon name="plus" size={20} strokeWidth={2.1} />
        </button>
      </div>

      <div className="page-scroll with-nav">
        {conversations.length === 0 ? (
          <div className="empty">
            <div className="empty-icon"><Icon name="message" size={30} strokeWidth={1.7} /></div>
            还没有会话，去「联系人」添加好友或等待官方群消息吧
          </div>
        ) : null}

        <div className="list">
          {conversations.map((c) => (
            <div
              key={c.key}
              className={'list-item' + (pressKey === c.key ? ' pressing' : '')}
              onClick={() => openConv(c)}
              onPointerDown={() => startPress(c)}
              onPointerUp={cancelPress}
              onPointerLeave={cancelPress}
              onPointerCancel={cancelPress}
              onContextMenu={(e) => e.preventDefault()}
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
                  <span className="conv-flags">
                    {c.pinned ? <span className="flag-pin" title="已置顶"><Icon name="pin" size={14} strokeWidth={1.9} /></span> : null}
                    {c.dnd ? <span className="flag-dnd" title="免打扰"><Icon name="bellOff" size={14} strokeWidth={1.9} /></span> : null}
                  </span>
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
            <IconTile name="userPlus" tone="sky" box={34} size={18} /> 添加好友
            <span className="chev">›</span>
          </div>
          <div
            className="menu-item"
            onClick={() => {
              setMenuOpen(false);
              push('createGroup');
            }}
          >
            <IconTile name="users" tone="violet" box={34} size={18} /> 创建群聊
            <span className="chev">›</span>
          </div>
          <div
            className="menu-item"
            onClick={() => {
              setMenuOpen(false);
              push('postMoment');
            }}
          >
            <IconTile name="sparkle" tone="amber" box={34} size={18} /> 发布动态
            <span className="chev">›</span>
          </div>
        </div>
      </Sheet>

      <ActionSheet
        open={!!convMenu}
        onClose={() => setConvMenu(null)}
        title={convMenu ? convMenu.name : ''}
        actions={
          convMenu
            ? [
                {
                  icon: <IconTile name="pin" tone={convMenu.pinned ? 'slate' : 'brand'} box={34} size={18} />,
                  label: convMenu.pinned ? '取消置顶' : '置顶该会话',
                  onClick: () => togglePin(convMenu),
                },
                {
                  icon: <IconTile name={convMenu.dnd ? 'bell' : 'bellOff'} tone={convMenu.dnd ? 'amber' : 'slate'} box={34} size={18} />,
                  label: convMenu.dnd ? '关闭免打扰' : '开启免打扰',
                  onClick: () => toggleDnd(convMenu),
                },
              ]
            : []
        }
      />
    </>
  );
}

export function goHomeTab(app, tab) {
  app.reset();
}
