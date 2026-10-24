import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { Avatar, Empty, Loading, TopBar, toast } from '../components/ui.jsx';
import { IconTile } from '../components/icons.jsx';
import { fullTime, fromNow } from '../lib/time.js';

const TYPE_META = {
  friend_request: { icon: 'userPlus', tone: 'sky' },
  friend_accept: { icon: 'checkCircle', tone: 'mint' },
  moment_like: { icon: 'heart', tone: 'rose' },
  moment_comment: { icon: 'message', tone: 'violet' },
  comment_reply: { icon: 'reply', tone: 'amber' },
  group_invite: { icon: 'users', tone: 'cyan' },
  group_join_request: { icon: 'users', tone: 'cyan' },
  group_join_accept: { icon: 'checkCircle', tone: 'mint' },
  group_join_reject: { icon: 'close', tone: 'rose' },
};

export default function NotificationsScreen() {
  const { back, refreshBadges, refreshConversations, setNotifyUnread, push, openUser } = useApp();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joinBusy, setJoinBusy] = useState(false);

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

  // 群主 / 管理员在通知里审核入群申请
  const handleJoin = async (n, accept) => {
    if (joinBusy) return;
    setJoinBusy(true);
    try {
      await api.post(`/api/groups/join-requests/${n.ref_id}/${accept ? 'accept' : 'reject'}`, {});
      setItems((l) => l.filter((x) => x.id !== n.id));
      toast(accept ? '已同意入群申请' : '已拒绝入群申请');
      refreshBadges();
      if (accept) refreshConversations();
    } catch (e) {
      toast(e.message, 'error');
      // 申请已被其他管理员处理：移除这条过期通知
      if (String(e.message || '').indexOf('已处理') >= 0) {
        setItems((l) => l.filter((x) => x.id !== n.id));
      }
    } finally {
      setJoinBusy(false);
    }
  };

  return (
    <div className="page" style={{ height: '100%' }}>
      <TopBar title="通知" sub={`共 ${items.length} 条`} onBack={back} />
      <div className="page-scroll">
        {loading ? (
          <Loading />
        ) : items.length === 0 ? (
          <Empty icon="bell" text="暂无通知" />
        ) : (
          <div className="glass mx">
            <div className="list">
              {items.map((n) => {
                const meta = TYPE_META[n.type] || { icon: 'bell', tone: 'sky' };
                return (
                  <div key={n.id} className="list-item" onClick={() => onTap(n)}>
                    {n.actor ? (
                      <Avatar user={n.actor} size={46} onClick={n.actor?.id ? () => openUser(n.actor) : undefined} />
                    ) : (
                      <IconTile name={meta.icon} tone={meta.tone} box={46} size={22} />
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
                      {n.type === 'group_join_request' ? (
                        <div className="flex gap8" style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                          <button className="btn btn-sm" disabled={joinBusy} onClick={() => handleJoin(n, false)}>
                            拒绝
                          </button>
                          <button className="btn btn-sm btn-primary" disabled={joinBusy} onClick={() => handleJoin(n, true)}>
                            同意
                          </button>
                        </div>
                      ) : null}
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
