import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { Avatar, Empty, Loading, TopBar, toast, Sheet } from '../components/ui.jsx';

export default function AddFriendScreen({ tab = 'search' }) {
  const { back, refreshBadges, openUser } = useApp();
  const [mode, setMode] = useState(['search', 'groups', 'requests'].includes(tab) ? tab : 'search');
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [requests, setRequests] = useState([]);
  const [sentIds, setSentIds] = useState(new Set());
  const [greet, setGreet] = useState(null);
  const [greetText, setGreetText] = useState('你好，我想加你为好友');
  // 群聊搜索
  const [gq, setGq] = useState('');
  const [gResults, setGResults] = useState([]);
  const [gSearching, setGSearching] = useState(false);
  const [gSent, setGSent] = useState(new Set());
  const [joinTarget, setJoinTarget] = useState(null);
  const [joinText, setJoinText] = useState('');

  const loadRequests = async () => {
    try {
      const [r, s] = await Promise.all([api.get('/api/friends/requests'), api.get('/api/friends/requests/sent')]);
      setRequests(r.requests || []);
      setSentIds(new Set(s.ids || []));
    } catch {}
  };

  const loadGroupSent = async () => {
    try {
      const d = await api.get('/api/groups/join-requests/sent');
      setGSent(new Set(d.ids || []));
    } catch {}
  };

  useEffect(() => {
    loadRequests();
    loadGroupSent();
  }, []);

  const doSearch = async () => {
    const kw = q.trim();
    if (!kw) return toast('请输入用户名或用户 ID', 'error');
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

  const doGroupSearch = async (kwArg) => {
    const kw = String(kwArg ?? gq).trim();
    if (!kw) return toast('请输入群名称或群 ID', 'error');
    setGSearching(true);
    try {
      const d = await api.get('/api/groups/search?q=' + encodeURIComponent(kw));
      setGResults(d.groups || []);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setGSearching(false);
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

  const sendJoinRequest = async () => {
    if (!joinTarget) return;
    try {
      await api.post(`/api/groups/${joinTarget.id}/join-request`, { message: joinText.slice(0, 60) });
      setGSent((s) => new Set([...s, joinTarget.id]));
      setGResults((l) => l.map((g) => (g.id === joinTarget.id ? { ...g, pending: true } : g)));
      toast('入群申请已提交，等待群主或管理员审核');
      setJoinTarget(null);
      setJoinText('');
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
              ['groups', '群聊'],
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
                <input
                  className="input"
                  placeholder="按用户昵称或用户 ID 搜索"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && doSearch()}
                />
                <button className="btn btn-primary" style={{ padding: '0 18px' }} onClick={doSearch} disabled={searching}>
                  {searching ? '…' : '搜索'}
                </button>
              </div>
              <div className="hint" style={{ marginTop: 8 }}>支持用户名模糊搜索，也可以直接输入对方的用户 ID 精确查找</div>
            </div>

            {searching ? <Loading /> : null}
            {!searching && results.length === 0 && q ? (
              <div>
                <Empty icon="search" text="没有找到相关用户" />
                {/^\d+$/.test(q.trim()) ? (
                  <button
                    className="btn btn-sm"
                    style={{ display: 'block', margin: '0 auto 16px' }}
                    onClick={() => {
                      const kw = q.trim();
                      setGq(kw);
                      setMode('groups');
                      doGroupSearch(kw);
                    }}
                  >
                    在「群聊」中搜索 ID {q.trim()}
                  </button>
                ) : null}
              </div>
            ) : null}
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
                          <div className="list-desc">
                            <span className="dim">ID: {u.id}</span>
                            <span style={{ marginLeft: 8 }}>
                              {u.online ? <span className="tag-online"><i />在线</span> : <span className="dim">离线</span>}
                            </span>
                          </div>
                        </div>
                        {u.is_friend ? (
                          <span className="badge-soft">已是好友</span>
                        ) : pending ? (
                          <span className="badge-soft">等待验证</span>
                        ) : u.request?.direction === 'in' ? (
                          <span className="badge-soft">待你处理</span>
                        ) : (
                          <button className="btn btn-sm btn-primary" onClick={() => setGreet(u)}>
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
        ) : mode === 'groups' ? (
          <>
            <div className="mx mt">
              <div className="input-row">
                <input
                  className="input"
                  placeholder="按群名称或群 ID 搜索"
                  value={gq}
                  onChange={(e) => setGq(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && doGroupSearch()}
                />
                <button className="btn btn-primary" style={{ padding: '0 18px' }} onClick={() => doGroupSearch()} disabled={gSearching}>
                  {gSearching ? '…' : '搜索'}
                </button>
              </div>
              <div className="hint" style={{ marginTop: 8 }}>支持群名称模糊搜索，或群 ID 精确查找（可直接粘贴「群 ID：12」）；申请后需群主 / 管理员审核</div>
            </div>

            {gSearching ? <Loading /> : null}
            {!gSearching && gResults.length === 0 && gq ? <Empty icon="search" text="没有找到相关群聊" /> : null}
            {gResults.length > 0 ? (
              <div className="glass mx mt">
                <div className="list">
                  {gResults.map((g) => {
                    const pending = g.pending || gSent.has(g.id);
                    return (
                      <div key={g.id} className="list-item">
                        <Avatar user={{ id: 0, username: g.name, avatar: g.avatar }} size={46} />
                        <div className="list-main">
                          <div className="list-title">
                            {g.name}
                            {g.is_official ? <span className="badge-soft">官方</span> : null}
                          </div>
                          <div className="list-desc">
                            <span className="dim">群 ID: {g.id} · {g.member_count} 人</span>
                          </div>
                        </div>
                        {g.is_member ? (
                          <span className="badge-soft">已在群中</span>
                        ) : pending ? (
                          <span className="badge-soft">等待审核</span>
                        ) : (
                          <button className="btn btn-sm btn-primary" onClick={() => setJoinTarget(g)}>
                            申请加入
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

      <Sheet open={!!joinTarget} onClose={() => setJoinTarget(null)} title={`申请加入「${joinTarget?.name || ''}」`}>
        <div className="field">
          <label>验证消息（可选）</label>
          <input
            className="input"
            value={joinText}
            onChange={(e) => setJoinText(e.target.value)}
            maxLength={60}
            placeholder="介绍一下自己，方便管理员审核"
          />
        </div>
        <button className="btn btn-primary btn-block mt" style={{ marginTop: 8 }} onClick={sendJoinRequest}>提交入群申请</button>
      </Sheet>
    </div>
  );
}
