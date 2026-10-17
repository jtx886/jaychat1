import React, { useCallback, useEffect, useState } from 'react';
import { api, ws } from '../api.js';
import { useApp } from '../App.jsx';
import { Avatar, Empty, Loading, TopBar, toast } from '../components/ui.jsx';
import MomentCard from '../components/MomentCard.jsx';

export default function UserMomentsScreen({ userId, mine }) {
  const { back, me, push } = useApp();
  const isSelf = mine || Number(userId) === Number(me?.id);
  const [user, setUser] = useState(isSelf ? me : null);
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (isSelf) {
        const d = await api.get('/api/moments/mine');
        setMoments(d.moments || []);
        setUser(me);
      } else {
        const [u, m] = await Promise.all([
          api.get(`/api/users/${userId}`).catch(() => ({ user: null })),
          api.get(`/api/users/${userId}/moments`),
        ]);
        setUser(u.user);
        setMoments(m.moments || []);
      }
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [isSelf, userId, me]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const offs = [ws.on('moment:update', load), ws.on('moment:new', load), ws.on('moment:delete', load)];
    return () => offs.forEach((o) => o());
  }, [load]);

  const like = async (m) => {
    try {
      const d = await api.post(`/api/moments/${m.id}/like`, {});
      setMoments((list) => list.map((x) => (x.id === m.id ? d.moment : x)));
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <div className="page" style={{ height: '100%' }}>
      <TopBar
        title={isSelf ? '我的动态' : `${user?.username || 'TA'} 的动态`}
        sub={`共 ${moments.length} 条`}
        onBack={back}
      />
      <div className="page-scroll">
        {user ? (
          <div className="glass glass-strong mx" style={{ padding: 16, marginTop: 6 }}>
            <div className="flex gap12">
              <Avatar user={user} size={60} />
              <div className="grow">
                <div style={{ fontSize: 18, fontWeight: 800 }}>
                  {user.username}
                  {user.is_official ? <span className="badge-soft" style={{ marginLeft: 8 }}>官方</span> : null}
                </div>
                <div className="hint" style={{ marginTop: 4 }}>
                  {user.remark ? `备注：${user.remark} · ` : ''}共发布 {moments.length} 条动态
                </div>
              </div>
              {!isSelf ? (
                <button className="btn btn-sm" onClick={() => push('chat', { convType: 'dm', convId: `${Math.min(Number(userId), Number(me.id))}_${Math.max(Number(userId), Number(me.id))}`, title: user.remark || user.username, avatar: user.avatar })}>私聊</button>
              ) : null}
            </div>
          </div>
        ) : null}

        {isSelf ? (
          <div className="mx mt">
            <button className="btn btn-primary btn-block" onClick={() => push('postMoment')}>✨ 发布新动态</button>
          </div>
        ) : null}

        {loading ? (
          <Loading />
        ) : moments.length === 0 ? (
          <Empty icon="📸" text={isSelf ? '你还没有发布动态' : 'TA 还没有发布动态'} />
        ) : (
          moments.map((m) => <MomentCard key={m.id} moment={m} onLike={like} onOpen={() => push('momentDetail', { momentId: m.id })} />)
        )}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}
