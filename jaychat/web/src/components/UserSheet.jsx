import React, { useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { Avatar, Sheet, ActionSheet, toast } from './ui.jsx';
import { maskEmail } from '../lib/time.js';

const dmId = (a, b) => {
  const x = Math.min(Number(a), Number(b));
  const y = Math.max(Number(a), Number(b));
  return `${x}_${y}`;
};

/** 点击他人头像弹出的用户卡片：查看动态 / 加好友 / 发消息 / 拉黑 */
export default function UserSheet({ user, onClose }) {
  const app = useApp();
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!user) return null;

  const isMe = user.id === app.me?.id;
  const isFriend = !!user.is_friend;

  const goMoments = () => {
    onClose?.();
    app.push('userMoments', { userId: Number(user.id) });
  };

  const goChat = () => {
    onClose?.();
    app.push('chat', {
      convType: 'dm',
      convId: dmId(user.id, app.me.id),
      title: user.remark || user.username,
      avatar: user.avatar,
    });
  };

  const addFriend = async () => {
    setBusy(true);
    try {
      await api.post('/api/friends/request', { toUserId: Number(user.id), message: `我是 ${app.me.username}` });
      toast('好友申请已发送');
      onClose?.();
      app.refreshBadges?.();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const doBlock = async () => {
    try {
      await api.post('/api/friends/block', { userId: Number(user.id) });
      toast('已拉黑该用户');
      app.refreshConversations?.();
      app.refreshBadges?.();
      onClose?.();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const actions = [
    { icon: '📸', label: '查看 TA 的动态', onClick: goMoments },
    isFriend
      ? { icon: '💬', label: '发消息', onClick: goChat }
      : { icon: '➕', label: '加为好友', onClick: addFriend },
    { icon: '详细资料', label: '查看资料', onClick: () => { onClose?.(); app.push('friendInfo', { userId: Number(user.id) }); } },
    { icon: '🚫', label: '拉黑', danger: true, onClick: () => setConfirmBlock(true) },
  ];

  return (
    <>
      <Sheet open={!!user} onClose={onClose}>
        <div className="flex gap14" style={{ padding: '4px 2px 14px' }}>
          <Avatar user={user} size={62} online={user.online} />
          <div className="grow" style={{ minWidth: 0 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              {user.remark || user.username}
              {user.is_official ? <span className="badge-soft" style={{ marginLeft: 8 }}>官方</span> : null}
            </div>
            {user.remark ? <div className="hint" style={{ marginTop: 3 }}>昵称：{user.username}</div> : null}
            <div className="hint" style={{ marginTop: 4 }}>
              {user.online ? <span className="tag-online"><i />在线</span> : <span className="dim">离线</span>}
              <span style={{ marginLeft: 8 }}>ID：{user.id}</span>
            </div>
          </div>
        </div>
        {user.email ? <div className="hint" style={{ marginBottom: 10 }}>{maskEmail(user.email)}</div> : null}

        <div className="menu-list">
          {actions
            .filter((a) => !(isMe && (a.label === '加为好友' || a.label === '拉黑')))
            .map((a, i) => (
              <div
                key={i}
                className={'menu-item' + (a.danger ? ' danger' : '')}
                onClick={() => {
                  if (busy) return;
                  a.onClick?.();
                }}
              >
                <span className="menu-ico">{a.icon}</span>
                <span>{a.label}</span>
              </div>
            ))}
        </div>

        <button className="btn btn-block btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>
          取消
        </button>
      </Sheet>

      <ActionSheet
        open={confirmBlock}
        onClose={() => setConfirmBlock(false)}
        title={`拉黑「${user.username}」？拉黑后将解除好友关系并互相收不到消息`}
        actions={[{ icon: '🚫', label: '确定拉黑', danger: true, onClick: doBlock }]}
      />
    </>
  );
}
