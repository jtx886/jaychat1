import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { Avatar, Empty, Loading, TopBar, toast, Sheet } from '../components/ui.jsx';

export default function AddFriendScreen({ tab = 'search' }) {
  const { back, refreshBadges, openUser } = useApp();
  const [mode, setMode] = useState(tab);
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [requests, setRequests] = useState([]);
  const [sentIds, setSentIds] = useState(new Set());
  const [greet, setGreet] = useState(null);
  const [greetText, setGreetText] = useState('你好，我想加你为好友');

  const loadRequests = async () => {
    try {
      const [r, s] = await Promise.all([api.get('/api/friends/requests'), api.get('/api/friends/requests/sent')]);
      setRequests(r.requests || []);
      setSentIds(new Set(s.ids || []));
    } catch {}
  };

  useEffect(() => {
    loadRequests();
  }, []);

  const doSearch = async () => {
    const kw = q.trim();
    if (!kw) return toast('请输入要搜索的用户名', 'error');
    setSearching(true);
    try {
      const d = await api.get('/api/users/search?q=' + encodeURIComponent(kw));
      setResults(d.users || []);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSearching(false);
    }
  };

  const sendRequest = async () => {
    if (!greet) return;
    try {
      await api.post('/api/friends/request', { toUserId: greet.id, message: greetText.slice(0, 60) });
      setSentIds((s) => new Set([...s, greet.id]));
      setResults((l) => l.map((u) => (u.id === greet.id ? { ...u, request: { direction: 'out' } } : u)));
      toast('好友申请已发送');
      setGreet(null);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const handleRequest = async (r, accept) => {
    try {
      await api.post(`/api/friends/requests/${r.id}/${accept ? 'accept' : 'reject'}`, {});
      setRequests((l) => l.filter((x) => x.id !== r.id));
      toast(accept ? '已通过' : '已拒绝');
      refreshBadges();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <div className="page" style={{ height: '100%' }}>
      <TopBar
        title="添加好友"
        onBack={back}
        right={
          <div className="flex gap6">
            {[
              ['search', '搜索'],
              ['requests', `申请${requests.length ? ' ' + requests.length : ''}`],
            ].map(([k, label]) => (
              <button key={k} className={'chip' + (mode === k ? ' active' : '')} onClick={() => setMode(k)}>
                {label}
              </button>
            ))}
          </div>
        }
      />

      <div className="page-scroll">
        {mode === 'search' ? (
          <>
            <div className="mx mt">
              <div className="input-row">
                <input className="input" placeholder="按用户昵称搜索" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && doSearch()} />
                <button className="btn btn-primary" style={{ padding: '0 18px' }} onClick={doSearch} disabled={searching}>
                  {searching ? '…' : '搜索'}
                </button>
              </div>
              <div className="hint" style={{ marginTop: 8 }}>支持按用户名模糊搜索，找到后可直接发送好友申请</div>
            </div>

            {searching ? <Loading /> : null}
            {!searching && results.length === 0 && q ? <Empty icon="search" text="没有找到相关用户" /> : null}
            {results.length > 0 ? (
              <div className="glass mx mt">
                <div className="list">
                  {results.map((u) => {
                    const pending = u.request?.direction === 'out' || sentIds.has(u.id);
                    return (
                      <div key={u.id} className="list-item">
                        <Avatar user={u} size={46} onClick={u?.id ? () => openUser(u) : undefined} />
                        <div className="list-main">
                          <div className="list-title">
                            {u.username}
                            {u.is_official ? <span className="badge-soft">官方</span> : null}
                          </div>
                          <div className="list-desc">{u.online ? <span className="tag-online"><i />在线</span> : <span className="dim">离线</span>}</div>
                        </div>
                        {u.is_friend ? (
                          <span className="badge-soft">已是好友</span>
                        ) : pending ? (
                          <span className="badge-soft">等待验证</span>
                        ) : u.request?.direction === 'in' ? (
                          <span className="badge-soft">待你处理</span>
                        ) : (
                          <button className="btn btn-sm btn-primary" onClick={() => { setGreet(u); setGreetText(`你好，我是${''}`); }}>
                            添加
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <>
            {requests.length === 0 ? (
              <Empty icon="mail" text="暂无好友申请" />
            ) : (
              <div className="glass mx mt">
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
            )}
          </>
        )}
      </div>

      <Sheet open={!!greet} onClose={() => setGreet(null)} title={`添加 ${greet?.username || ''} 为好友`}>
        <div className="field">
          <label>验证消息</label>
          <input className="input" value={greetText} onChange={(e) => setGreetText(e.target.value)} maxLength={60} placeholder="打个招呼吧" />
        </div>
        <button className="btn btn-primary btn-block mt" style={{ marginTop: 8 }} onClick={sendRequest}>发送好友申请</button>
      </Sheet>
    </div>
  );
}
