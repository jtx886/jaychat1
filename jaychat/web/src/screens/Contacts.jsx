import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { Avatar, Empty, Loading, InitialIndex, toast } from '../components/ui.jsx';
import { groupByInitial, initialOf } from '../lib/time.js';

export default function ContactsScreen() {
  const { push, presence, refreshBadges, refreshConversations, me, openUser } = useApp();
  const [friends, setFriends] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [jump, setJump] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [f, r] = await Promise.all([api.get('/api/friends'), api.get('/api/friends/requests')]);
      setFriends(f.friends || []);
      setRequests(r.requests || []);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const groups = useMemo(() => groupByInitial(friends, (f) => f.remark || f.username), [friends]);

  useEffect(() => {
    if (!jump) return;
    const el = document.getElementById('idx-' + jump);
    if (el) el.scrollIntoView({ block: 'start' });
    setJump('');
  }, [jump]);

  const handleRequest = async (r, accept) => {
    try {
      await api.post(`/api/friends/requests/${r.id}/${accept ? 'accept' : 'reject'}`, {});
      setRequests((l) => l.filter((x) => x.id !== r.id));
      toast(accept ? '已通过好友申请' : '已拒绝');
      if (accept) {
        await load();
        refreshConversations();
      }
      refreshBadges();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <>
      <div className="topbar">
        <div className="list-main">
          <div className="topbar-title">联系人</div>
          <div className="topbar-sub">共 {friends.length} 位好友</div>
        </div>
        <button className="icon-btn" onClick={() => push('addFriend', { tab: 'search' })} aria-label="添加好友">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      <div className="page-scroll with-nav" style={{ position: 'relative' }}>
        {/* 好友申请模块 */}
        {requests.length > 0 ? (
          <>
            <div className="section-head">好友申请 · {requests.length}</div>
            <div className="glass mx">
              <div className="list">
                {requests.map((r) => (
                  <div key={r.id} className="list-item">
                    <Avatar user={r.from} size={46} />
                    <div className="list-main">
                      <div className="list-title">{r.from?.username}</div>
                      <div className="list-desc">{r.message || '请求添加你为好友'}</div>
                    </div>
                    <div className="flex gap8">
                      <button className="btn btn-sm" onClick={() => handleRequest(r, false)}>拒绝</button>
                      <button className="btn btn-sm btn-primary" onClick={() => handleRequest(r, true)}>通过</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}

        {/* 模块入口 */}
        <div className="section-head">功能</div>
        <div className="glass mx">
          <div className="list">
            <div className="list-item" onClick={() => push('moments', { scope: 'all' })}>
              <Avatar name="动" size={44} style={{ background: 'linear-gradient(135deg,#ff8fd0,#e0559f)' }} />
              <div className="list-main">
                <div className="list-title">动态</div>
                <div className="list-desc">查看全站所有用户发布的动态（大社区）</div>
              </div>
              <span className="chev dim">›</span>
            </div>
            <div className="list-item" onClick={() => push('moments', { scope: 'friends' })}>
              <Avatar name="友" size={44} style={{ background: 'linear-gradient(135deg,#5b9dff,#3b6dff)' }} />
              <div className="list-main">
                <div className="list-title">好友动态</div>
                <div className="list-desc">只看已添加好友发布的动态</div>
              </div>
              <span className="chev dim">›</span>
            </div>
          </div>
        </div>

        {/* 好友列表（首字母分组） */}
        <div className="section-head">好友列表</div>
        {loading ? (
          <Loading />
        ) : friends.length === 0 ? (
          <Empty icon="🧑‍🤝‍🧑" text="还没有好友，点右上角 + 添加好友" />
        ) : (
          <div className="glass mx">
            <div className="list">
              {groups.map((g) => (
                <React.Fragment key={g.letter}>
                  <div id={'idx-' + g.letter} className="section-head" style={{ padding: '12px 16px 6px' }}>
                    {g.letter}
                  </div>
                  {g.items.map((f) => (
                    <div key={f.id} className="list-item" onClick={() => push('chat', { convType: 'dm', convId: dmId(f.id, me.id), title: f.remark || f.username, avatar: f.avatar })}>
                      <Avatar
                        user={{ ...f, online: presence[f.id] ?? f.online }}
                        size={46}
                        onClick={(e) => { e.stopPropagation(); openUser({ ...f, online: presence[f.id] ?? f.online }); }}
                      />
                      <div className="list-main">
                        <div className="list-title">
                          {f.remark || f.username}
                          {f.is_official ? <span className="badge-soft">官方</span> : null}
                        </div>
                        <div className="list-desc">
                          {(presence[f.id] ?? f.online) ? <span className="tag-online"><i />在线</span> : <span className="dim">离线</span>}
                          {f.remark ? <span style={{ marginLeft: 8 }}>昵称：{f.username}</span> : null}
                        </div>
                      </div>
                      <span className="chev dim">›</span>
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
        {groups.length > 0 ? (
          <InitialIndex letters={groups.map((g) => g.letter)} onJump={(l) => setJump(l)} />
        ) : null}
      </div>
    </>
  );
}

/** 私聊会话 id：两个 uid 升序拼接（与后端保持一致） */
function dmId(peerId, myId) {
  const a = Math.min(Number(peerId), Number(myId));
  const b = Math.max(Number(peerId), Number(myId));
  return `${a}_${b}`;
}
