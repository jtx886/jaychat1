import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { Avatar, Empty, Loading, TopBar, ActionSheet, toast } from '../components/ui.jsx';
import { IconTile } from '../components/icons.jsx';
import { fromNow } from '../lib/time.js';

/** 黑名单：查看已拉黑用户并解除拉黑 */
export default function BlacklistScreen() {
  const { back, refreshConversations, refreshBadges, openUser } = useApp();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.get('/api/friends/blocks');
      setList(d.blocks || []);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const unblock = async () => {
    if (!target) return;
    try {
      await api.del(`/api/friends/block/${target.id}`);
      setList((l) => l.filter((u) => u.id !== target.id));
      toast(`已将「${target.remark || target.username}」移出黑名单`);
      refreshConversations();
      refreshBadges();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setTarget(null);
    }
  };

  return (
    <div className="page" style={{ height: '100%' }}>
      <TopBar title="黑名单" sub={`已拉黑 ${list.length} 人`} onBack={back} />
      <div className="page-scroll">
        {loading ? (
          <Loading />
        ) : list.length === 0 ? (
          <Empty icon="shield" text="黑名单为空，被你拉黑的用户会显示在这里" />
        ) : (
          <div className="glass mx mt" style={{ marginTop: 8 }}>
            <div className="list">
              {list.map((u) => (
                <div key={u.id} className="list-item">
                  <Avatar user={u} size={46} onClick={() => openUser?.(u)} />
                  <div className="list-main" onClick={() => openUser?.(u)}>
                    <div className="list-title">{u.remark || u.username}</div>
                    <div className="list-desc">
                      <span className="dim">拉黑于 {u.blocked_at ? fromNow(u.blocked_at) : '较早前'}</span>
                    </div>
                  </div>
                  <button className="btn btn-sm btn-ghost" onClick={() => setTarget(u)}>
                    解除拉黑
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="center hint" style={{ marginTop: 16, padding: '0 24px', lineHeight: 1.7 }}>
          拉黑后将解除好友关系，双方无法收发消息，也不会出现在对方的会话列表中。解除拉黑后可重新发送好友申请。
        </div>
      </div>

      <ActionSheet
        open={!!target}
        onClose={() => setTarget(null)}
        title={`解除拉黑「${target?.username || ''}」？`}
        actions={[{ icon: <IconTile name="checkCircle" tone="mint" box={34} size={18} />, label: '解除拉黑', onClick: unblock }]}
      />
    </div>
  );
}
