import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { Avatar, Empty, Loading, TopBar, toast } from '../components/ui.jsx';
import { fullTime, fromNow } from '../lib/time.js';

const TYPE_META = {
  friend_request: { icon: '👋', color: '#5b9dff' },
  friend_accept: { icon: '✅', color: '#2fd07b' },
  moment_like: { icon: '❤️', color: '#ff6b81' },
  moment_comment: { icon: '💬', color: '#7a5cff' },
  comment_reply: { icon: '↩️', color: '#ffb020' },
  group_invite: { icon: '👥', color: '#3ad0e0' },
};

export default function NotificationsScreen() {
  const { back, refreshBadges, setNotifyUnread, push, openUser } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get('/api/notifications');
        setItems(d.notifications || []);
        // 打开通知页即标记已读 → 红点消失
        await api.post('/api/notifications/read', {});
        setNotifyUnread(0);
        refreshBadges();
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onTap = (n) => {
    if (n.type === 'moment_like' || n.type === 'moment_comment' || n.type === 'comment_reply') {
      push('momentDetail', { momentId: n.ref_id });
    } else if (n.type === 'friend_request') {
      push('addFriend', { tab: 'requests' });
    }
  };

  return (
    <div className="page" style={{ height: '100%' }}>
      <TopBar title="通知" sub={`共 ${items.length} 条`} onBack={back} />
      <div className="page-scroll">
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty icon="🔔" text="暂无通知" />
        ) : (
          <div className="glass mx">
            <div className="list">
              {items.map((n) => {
                const meta = TYPE_META[n.type] || { icon: '🔔', color: '#5b9dff' };
                return (
                  <div key={n.id} className="list-item" onClick={() => onTap(n)}>
                    {n.actor ? (
                      <Avatar user={n.actor} size={46} onClick={n.actor?.id ? () => openUser(n.actor) : undefined} />
                    ) : (
                      <Avatar name={meta.icon} size={46} style={{ background: `linear-gradient(135deg, ${meta.color}, #2b3f8f)` }} />
                    )}
                    <div className="list-main">
                      <div className="list-title">
                        {!n.read ? <span className="badge-dot" style={{ marginRight: 4 }} /> : null}
                        {n.actor?.username || 'Jay Chat'}
                      </div>
                      <div className="list-desc" style={{ whiteSpace: 'normal' }}>{n.text}</div>
                      <div className="hint" style={{ marginTop: 3 }} title={fullTime(n.created_at)}>
                        {fullTime(n.created_at)} · {fromNow(n.created_at)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
