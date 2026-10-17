import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { Avatar, Empty, Loading, TopBar, Sheet, ActionSheet, Switch, toast } from '../components/ui.jsx';
import { fullTime, fromNow } from '../lib/time.js';
import { mediaUrl } from '../api.js';

export default function FriendInfoScreen({ userId }) {
  const { back, push, refreshConversations, me, conversations } = useApp();
  const [user, setUser] = useState(null);
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(null);
  const [remarkDraft, setRemarkDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dmKey = `${Math.min(Number(userId), Number(me.id))}_${Math.max(Number(userId), Number(me.id))}`;
  const conv = conversations.find((c) => c.conv_type === 'dm' && c.conv_id === dmKey);
  const dnd = !!conv?.dnd;
  const online = conv?.online;

  const load = async () => {
    setLoading(true);
    try {
      const [u, m] = await Promise.all([
        api.get(`/api/users/${userId}`),
        api.get(`/api/users/${userId}/moments`).catch(() => ({ moments: [] })),
      ]);
      setUser(u.user);
      setRemarkDraft(u.user?.remark || '');
      setMoments(m.moments || []);
    } catch (e) {
      toast(e.message, 'error');
      back();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const saveRemark = async () => {
    try {
      await api.patch(`/api/friends/${userId}`, { remark: remarkDraft.slice(0, 20) });
      setUser((u) => ({ ...u, remark: remarkDraft.slice(0, 20) }));
      setSheet(null);
      toast('备注已更新');
      refreshConversations();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const toggleDnd = async (v) => {
    try {
      await api.patch('/api/dm-dnd', { peerId: Number(userId), dnd: v });
      toast(v ? '已开启消息免打扰' : '已关闭消息免打扰');
      refreshConversations();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const removeFriend = async () => {
    try {
      await api.del(`/api/friends/${userId}`);
      toast('已删除好友');
      await refreshConversations();
      back();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ height: '100%' }}>
        <TopBar title="好友资料" onBack={back} />
        <Loading />
      </div>
    );
  }
  if (!user) return null;

  return (
    <div className="page" style={{ height: '100%' }}>
      <TopBar title="好友信息" sub={user.is_friend ? '好友' : '非好友'} onBack={back} />
      <div className="page-scroll">
        <div className="glass glass-strong mx" style={{ padding: 18, marginTop: 6 }}>
          <div className="flex gap12">
            <Avatar user={{ ...user, online }} size={68} />
            <div className="grow">
              <div style={{ fontSize: 19, fontWeight: 800 }}>
                {user.remark || user.username}
                {user.is_official ? <span className="badge-soft" style={{ marginLeft: 8 }}>官方</span> : null}
              </div>
              {user.remark ? <div className="hint" style={{ marginTop: 3 }}>昵称：{user.username}</div> : null}
              <div className="hint" style={{ marginTop: 3 }}>
                {online ? <span className="tag-online"><i />在线</span> : <span className="dim">离线</span>}
                <span style={{ marginLeft: 8 }}>ID：{user.id}</span>
              </div>
            </div>
          </div>
          {user.bio ? <div className="small mt" style={{ marginTop: 12 }}>{user.bio}</div> : null}
        </div>

        <div className="glass mx mt">
          <div className="list">
            <div className="list-item" onClick={() => { setSheet('remark'); }}>
              <span style={{ fontSize: 19 }}>📝</span>
              <div className="list-main">
                <div className="list-title">设置朋友资料</div>
                <div className="list-desc">添加备注名（最多 20 字）</div>
              </div>
              <span className="chev dim">›</span>
            </div>
            <div className="list-item">
              <span style={{ fontSize: 19 }}>🔕</span>
              <div className="list-main">
                <div className="list-title">消息免打扰</div>
                <div className="list-desc">开启后对方消息不再弹出通知</div>
              </div>
              <Switch on={dnd} onChange={toggleDnd} />
            </div>
            <div className="list-item" onClick={() => push('chat', { convType: 'dm', convId: dmKey, title: user.remark || user.username, avatar: user.avatar })}>
              <span style={{ fontSize: 19 }}>💬</span>
              <div className="list-main">
                <div className="list-title">发消息</div>
              </div>
              <span className="chev dim">›</span>
            </div>
          </div>
        </div>

        <div className="section-head">TA 的动态（{moments.length}）</div>
        <div className="glass mx">
          <div className="list">
            <div className="list-item" onClick={() => push('userMoments', { userId: Number(userId) })}>
              <span style={{ fontSize: 19 }}>📸</span>
              <div className="list-main">
                <div className="list-title">查看好友动态</div>
                <div className="list-desc">查看 TA 的全部未删除动态，可查看点赞与评论</div>
              </div>
              <span className="chev dim">›</span>
            </div>
            {moments.slice(0, 3).map((m) => (
              <div key={m.id} className="list-item" onClick={() => push('momentDetail', { momentId: m.id })}>
                {m.media?.[0]?.url ? (
                  m.media[0].type === 'video' ? (
                    <div className="avatar" style={{ width: 46, height: 46, borderRadius: 12, background: '#0b1226' }}>🎬</div>
                  ) : (
                    <img src={mediaUrl(m.media[0].url)} alt="" style={{ width: 46, height: 46, borderRadius: 12, objectFit: 'cover' }} />
                  )
                ) : (
                  <Avatar name="动" size={46} style={{ background: 'linear-gradient(135deg,#7a5cff,#5236e8)' }} />
                )}
                <div className="list-main">
                  <div className="list-title ellipsis" style={{ maxWidth: 220 }}>{m.text || '[图片/视频]'}</div>
                  <div className="list-desc">❤️ {m.likes?.length || 0} · 💬 {m.comments?.length || 0} · {fullTime(m.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mx" style={{ marginTop: 18 }}>
          <button className="btn btn-block btn-danger" onClick={() => setConfirmDelete(true)}>删除好友</button>
        </div>
        <div style={{ height: 20 }} />
      </div>

      <Sheet open={sheet === 'remark'} onClose={() => setSheet(null)} title="设置朋友资料">
        <div className="field">
          <label>备注名</label>
          <input className="input" maxLength={20} value={remarkDraft} onChange={(e) => setRemarkDraft(e.target.value)} placeholder="为 TA 添加备注" />
        </div>
        <button className="btn btn-primary btn-block" onClick={saveRemark}>保存</button>
      </Sheet>

      <ActionSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`删除好友「${user.username}」？`}
        actions={[{ icon: '🗑️', label: '删除好友', danger: true, onClick: removeFriend }]}
      />
    </div>
  );
}
