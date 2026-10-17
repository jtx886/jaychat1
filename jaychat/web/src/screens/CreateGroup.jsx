import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { Avatar, Empty, Loading, TopBar, toast, Spinner } from '../components/ui.jsx';
import { groupByInitial } from '../lib/time.js';

export default function CreateGroupScreen() {
  const { back, push, refreshConversations, me } = useApp();
  const [name, setName] = useState('');
  const [friends, setFriends] = useState([]);
  const [picked, setPicked] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get('/api/friends');
        setFriends(d.friends || []);
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const groups = useMemo(() => groupByInitial(friends, (f) => f.remark || f.username), [friends]);

  const toggle = (id) => setPicked((s) => {
    const n = new Set(s);
    n.has(id) ? n.delete(id) : n.add(id);
    return n;
  });

  const create = async () => {
    const n = name.trim();
    if (!n) return toast('请输入群名称', 'error');
    setBusy(true);
    try {
      const d = await api.post('/api/groups', { name: n, memberIds: [...picked] });
      await refreshConversations();
      toast('群聊创建成功');
      back();
      setTimeout(() => push('chat', { convType: 'group', convId: String(d.group.id), title: d.group.name, avatar: d.group.avatar }), 60);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page" style={{ height: '100%' }}>
      <TopBar title="创建群聊" sub={picked.size ? `已选 ${picked.size} 人` : '选填邀请好友'} onBack={back} />
      <div className="page-scroll">
        <div className="mx mt">
          <div className="field">
            <label>群名称</label>
            <input className="input" placeholder="给群聊起个名字" maxLength={20} value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>

        <div className="section-head">选择好友（{friends.length}）</div>
        {loading ? (
          <Loading />
        ) : friends.length === 0 ? (
          <Empty icon="users" text="还没有好友，先添加好友再建群吧" />
        ) : (
          <div className="glass mx">
            <div className="list">
              {groups.map((g) => (
                <React.Fragment key={g.letter}>
                  <div className="section-head" style={{ padding: '12px 16px 6px' }}>{g.letter}</div>
                  {g.items.map((f) => (
                    <div key={f.id} className="list-item" onClick={() => toggle(f.id)}>
                      <Avatar user={f} size={44} />
                      <div className="list-main">
                        <div className="list-title">{f.remark || f.username}</div>
                      </div>
                      <div className={'switch' + (picked.has(f.id) ? ' on' : '')}><i /></div>
                    </div>
                  ))}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        <div className="mx mt" style={{ marginTop: 18 }}>
          <button className="btn btn-primary btn-block" disabled={busy} onClick={create}>
            {busy ? <Spinner size={18} /> : '创建群聊'}
          </button>
        </div>
      </div>
    </div>
  );
}
