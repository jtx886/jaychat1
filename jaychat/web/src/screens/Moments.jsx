import React, { useCallback, useEffect, useState } from 'react';
import { api, ws } from '../api.js';
import { useApp } from '../App.jsx';
import { Empty, Loading, TopBar, toast } from '../components/ui.jsx';
import { Icon } from '../components/icons.jsx';
import MomentCard from '../components/MomentCard.jsx';

export default function MomentsScreen({ scope = 'all' }) {
  const { back, push } = useApp();
  const [tab, setTab] = useState(scope === 'friends' ? 'friends' : 'all');
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (s) => {
    setLoading(true);
    try {
      const d = await api.get(`/api/moments?scope=${s}`);
      setMoments(d.moments || []);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(tab);
  }, [tab, load]);

  // 实时：有新动态 / 动态更新时刷新
  useEffect(() => {
    const offs = [
      ws.on('moment:new', () => load(tab)),
      ws.on('moment:update', () => load(tab)),
      ws.on('moment:delete', () => load(tab)),
    ];
    return () => offs.forEach((o) => o());
  }, [tab, load]);

  const like = async (m) => {
    try {
      const d = await api.post(`/api/moments/${m.id}/like`, {});
      setMoments((list) => list.map((x) => (x.id === m.id ? d.moment : x)));
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const open = (m, kind) => {
    if (kind === 'user') push('userMoments', { userId: m.author?.id });
    else push('momentDetail', { momentId: m.id });
  };

  return (
    <div className="page" style={{ height: '100%' }}>
      <TopBar
        title={tab === 'friends' ? '好友动态' : '动态社区'}
        sub={tab === 'friends' ? '只看已添加好友发布的动态' : '全站用户动态大社区'}
        onBack={back}
        right={
          <div className="flex gap6">
            <button className={'chip' + (tab === 'all' ? ' active' : '')} onClick={() => setTab('all')}>动态</button>
            <button className={'chip' + (tab === 'friends' ? ' active' : '')} onClick={() => setTab('friends')}>好友动态</button>
          </div>
        }
      />
      <div className="page-scroll">
        <div className="mx mt">
          <button className="btn btn-primary btn-block" onClick={() => push('postMoment')}><Icon name="sparkle" size={17} strokeWidth={1.9} /> 发布动态</button>
        </div>
        {loading ? (
          <Loading />
        ) : moments.length === 0 ? (
          <Empty icon="globe" text={tab === 'friends' ? '好友们还没有发布动态' : '还没有人发布动态，快来第一个吧'} />
        ) : (
          moments.map((m) => <MomentCard key={m.id} moment={m} onOpen={(k) => open(m, k)} onLike={like} />)
        )}
        <div style={{ height: 20 }} />
      </div>
    </div>
  );
}
