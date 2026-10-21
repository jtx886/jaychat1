import React, { useEffect, useRef, useState } from 'react';
import { api, mediaUrl } from '../api.js';
import { useApp } from '../App.jsx';
import { Avatar, TopBar, ActionSheet, Sheet, Switch, MediaPicker, toast, Spinner, Empty, VideoPlayer } from '../components/ui.jsx';
import { Icon, IconTile } from '../components/icons.jsx';

const TABS = [
  { key: 'overview', name: '总览', icon: 'globe' },
  { key: 'ai', name: 'AI 配置', icon: 'robot' },
  { key: 'users', name: '用户管理', icon: 'users' },
  { key: 'ips', name: '用户IP', icon: 'shield' },
  { key: 'chatlog', name: '聊天记录', icon: 'message' },
];

const BAN_OPTIONS = [
  { label: '封禁 1 天', days: 1 },
  { label: '封禁 7 天', days: 7 },
  { label: '封禁 30 天', days: 30 },
  { label: '永久封禁', days: 0 },
];
const MUTE_OPTIONS = [
  { label: '禁言 10 分钟', minutes: 10 },
  { label: '禁言 1 小时', minutes: 60 },
  { label: '禁言 1 天', minutes: 60 * 24 },
  { label: '禁言 7 天', minutes: 60 * 24 * 7 },
];

function fmtTime(ms) {
  if (!ms) return '—';
  const d = new Date(Number(ms));
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function remainText(until) {
  const ms = Number(until) - Date.now();
  if (ms <= 0) return '已到期';
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d}天${h}小时`;
  if (h) return `${h}小时${m}分`;
  return `${Math.max(1, m)}分钟`;
}

export default function AdminScreen() {
  const { back, me } = useApp();
  const [tab, setTab] = useState('overview');

  if (!me?.is_admin) {
    return (
      <div className="page" style={{ height: '100%' }}>
        <TopBar title="管理员后台" onBack={back} />
        <Empty icon="lock" text="仅管理员可访问" />
      </div>
    );
  }

  return (
    <div className="page" style={{ height: '100%' }}>
      <TopBar title="管理员后台" sub="全站数据 · AI 配置 · 用户管理" onBack={back} />
      <div className="admin-tabs">
        {TABS.map((t) => (
          <div key={t.key} className={'admin-tab' + (tab === t.key ? ' active' : '')} onClick={() => setTab(t.key)}>
            <Icon name={t.icon} size={16} strokeWidth={1.9} /> {t.name}
          </div>
        ))}
      </div>
      <div className="page-scroll">
        {tab === 'overview' ? <Overview /> : null}
        {tab === 'ai' ? <AiConfig /> : null}
        {tab === 'users' ? <UserManager /> : null}
        {tab === 'ips' ? <IpManager /> : null}
        {tab === 'chatlog' ? <ChatLog /> : null}
      </div>
    </div>
  );
}

/* ================================ 总览 ================================ */
function StatTile({ icon, tone, label, value, sub }) {
  return (
    <div className="glass pad admin-stat">
      <IconTile name={icon} tone={tone} box={36} size={18} />
      <div className="admin-stat-val">{value}</div>
      <div className="admin-stat-label">{label}</div>
      {sub ? <div className="hint" style={{ fontSize: 11 }}>{sub}</div> : null}
    </div>
  );
}

function Overview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.get('/api/admin/overview');
      setData(d);
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

  if (loading && !data) {
    return <div className="center" style={{ padding: '40px 0' }}><Spinner size={24} /></div>;
  }
  if (!data) return <Empty icon="info" text="数据加载失败" />;

  const s = data.stats || {};
  const days = data.days || [];
  const maxUsers = Math.max(1, ...days.map((d) => d.users));
  const maxMsg = Math.max(1, ...days.map((d) => d.messages));

  return (
    <>
      <div className="admin-stats">
        <StatTile icon="userPlus" tone="mint" label="今日注册" value={s.today_users ?? 0} sub="较昨日截至现在" />
        <StatTile icon="sparkle" tone="brand" label="7 日新增" value={s.week_users ?? 0} />
        <StatTile icon="users" tone="sky" label="总用户" value={s.total_users ?? 0} />
        <StatTile icon="checkCircle" tone="cyan" label="当前在线" value={s.online_users ?? 0} />
        <StatTile icon="message" tone="violet" label="消息总数" value={s.messages ?? 0} sub={`今日 ${s.today_messages ?? 0}`} />
        <StatTile icon="users" tone="amber" label="群聊" value={s.groups ?? 0} />
        <StatTile icon="gallery" tone="brand" label="动态总数" value={s.moments ?? 0} />
        <StatTile icon="ban" tone="rose" label="已封禁" value={s.banned ?? 0} />
        <StatTile icon="clock" tone="amber" label="禁言中" value={s.muted ?? 0} />
      </div>

      <div className="section-head">近 7 天趋势</div>
      <div className="glass mx pad">
        <div className="admin-chart">
          {days.map((d) => (
            <div key={d.date} className="admin-chart-col">
              <div className="admin-chart-bars">
                <div
                  className="admin-bar bar-msg"
                  style={{ height: `${Math.round((d.messages / maxMsg) * 100)}%` }}
                  title={`${d.label} 消息 ${d.messages}`}
                />
                <div
                  className="admin-bar bar-user"
                  style={{ height: `${Math.round((d.users / maxUsers) * 100)}%` }}
                  title={`${d.label} 注册 ${d.users}`}
                />
              </div>
              <div className="admin-chart-label">{d.label}</div>
              <div className="admin-chart-num">{d.users}/{d.messages}</div>
            </div>
          ))}
        </div>
        <div className="flex gap12" style={{ justifyContent: 'center', marginTop: 8 }}>
          <span className="hint"><i className="legend-dot bar-user" />注册</span>
          <span className="hint"><i className="legend-dot bar-msg" />消息</span>
        </div>
          <div className="hint center" style={{ marginTop: 6 }}>每列：注册数 / 消息数</div>
      </div>

      <div className="section-head">最新注册</div>
      <div className="glass mx">
        <div className="list">
          {(data.recent_users || []).map((u) => (
            <div key={u.id} className="list-item">
              <Avatar user={u} size={42} />
              <div className="list-main">
                <div className="list-title">
                  {u.username}
                  {u.is_admin ? <span className="badge-soft" style={{ marginLeft: 6 }}>管理员</span> : null}
                </div>
                <div className="list-desc">{u.email} · {fmtTime(u.created_at)}</div>
              </div>
              {u.banned ? <span className="admin-tag tag-ban">封禁</span> : u.muted ? <span className="admin-tag tag-mute">禁言</span> : u.online ? <span className="tag-online"><i />在线</span> : null}
            </div>
          ))}
        </div>
      </div>
      <div className="center hint" style={{ marginTop: 12 }}>服务器时间：{fmtTime(data.server_time)}</div>
    </>
  );
}

/* ============================== AI 配置 ============================== */
function AiConfig() {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get('/api/admin/ai');
        setCfg(d.config || { url: '', key: '', model: '', name: '', avatar: '' });
      } catch (e) {
        toast(e.message, 'error');
      }
    })();
  }, []);

  const set = (k, v) => setCfg((c) => ({ ...c, [k]: v }));

  const save = async () => {
    if (!cfg) return;
    setSaving(true);
    try {
      // 用 POST 保存：部分共享主机 / WAF 会拦截 PATCH 等非常用方法，导致配置保存后不生效
      const d = await api.post('/api/admin/ai', {
        url: cfg.url || '',
        key: cfg.key || '',
        model: cfg.model || '',
        name: cfg.name || '',
        avatar: cfg.avatar || '',
      });
      setCfg(d.config || cfg);
      toast('AI 配置已保存');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (files) => {
    const f = files?.[0];
    if (!f) return;
    setUploading(true);
    try {
      const up = await api.upload(f, 'image');
      set('avatar', up.url);
      toast('头像已上传，记得保存');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  if (!cfg) {
    return <div className="center" style={{ padding: '40px 0' }}><Spinner size={24} /></div>;
  }

  return (
    <div className="glass glass-strong mx" style={{ padding: 16, marginTop: 6 }}>
      <div className="flex gap12" style={{ alignItems: 'center' }}>
        <Avatar src={cfg.avatar} name={cfg.name || 'Jay AI'} size={58} />
        <div className="grow">
          <div style={{ fontWeight: 800, fontSize: 16 }}>聊天中的 AI 形象</div>
          <div className="hint">自定义名称与头像，将展示在聊天页面</div>
        </div>
      </div>

      <div className="field mt" style={{ marginTop: 14 }}>
        <label>聊天显示名称</label>
        <input className="input" placeholder="例如：Jay AI" value={cfg.name || ''} onChange={(e) => set('name', e.target.value)} />
      </div>

      <div className="field mt">
        <label>AI 头像</label>
        <div className="flex gap8" style={{ alignItems: 'center' }}>
          <input className="input grow" placeholder="图片地址，或点右侧上传" value={cfg.avatar || ''} onChange={(e) => set('avatar', e.target.value)} />
          <MediaPicker onPick={uploadAvatar} accept="image/*" multiple={false}>
            <button className="btn">{uploading ? <Spinner size={16} /> : '上传'}</button>
          </MediaPicker>
        </div>
        <div className="hint">支持填入任意图片链接，或上传本地图片</div>
      </div>

      <div className="section-head" style={{ marginLeft: 0 }}>接口配置（OpenAI 兼容）</div>

      <div className="field">
        <label>接口地址</label>
        <input className="input" placeholder="https://api.openai.com/v1/chat/completions" value={cfg.url || ''} onChange={(e) => set('url', e.target.value)} />
        <div className="hint">支持两种协议：Chat Completions（…/v1/chat/completions）与 Responses（…/v1/responses，如腾讯 TokenHub）</div>
      </div>

      <div className="field mt">
        <label>模型名称（可自定义，方便接入第三方）</label>
        <input className="input" placeholder="例如：gpt-4o-mini / deepseek-chat / qwen-plus" value={cfg.model || ''} onChange={(e) => set('model', e.target.value)} />
      </div>

      <div className="field mt">
        <label>密钥（API Key）</label>
        <input className="input" type="password" placeholder="sk-..." value={cfg.key || ''} onChange={(e) => set('key', e.target.value)} autoComplete="off" />
      </div>

      <button className="btn btn-primary btn-block mt" style={{ marginTop: 16 }} disabled={saving} onClick={save}>
        {saving ? <Spinner size={18} /> : '保存配置'}
      </button>
    </div>
  );
}

/* ============================== 用户管理 ============================== */
function UserManager() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [q, setQ] = useState('');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [banTarget, setBanTarget] = useState(null);
  const [muteTarget, setMuteTarget] = useState(null);

  const load = async (kw) => {
    setLoading(true);
    try {
      const d = await api.get(`/api/admin/users?q=${encodeURIComponent(kw ?? q)}&limit=200`);
      setUsers(d.users || []);
      setTotal(d.total || 0);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const apply = (u) => setUsers((list) => list.map((x) => (x.id === u.id ? u : x)));

  const doBan = async (days) => {
    if (!banTarget) return;
    try {
      const d = await api.post(`/api/admin/users/${banTarget.id}/ban`, { days });
      apply(d.user);
      toast(days > 0 ? `已封禁 ${days} 天` : '已永久封禁');
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const doUnban = async (u) => {
    try {
      const d = await api.post(`/api/admin/users/${u.id}/unban`, {});
      apply(d.user);
      toast('已解封');
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const doMute = async (minutes) => {
    if (!muteTarget) return;
    try {
      const d = await api.post(`/api/admin/users/${muteTarget.id}/mute`, { minutes });
      apply(d.user);
      toast('已禁言');
    } catch (e) {
      toast(e.message, 'error');
    }
  };
  const doUnmute = async (u) => {
    try {
      const d = await api.post(`/api/admin/users/${u.id}/unmute`, {});
      apply(d.user);
      toast('已解除禁言');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <>
      <div className="glass mx" style={{ padding: 12, marginTop: 6 }}>
        <div className="flex gap8">
          <input
            className="input grow"
            placeholder="搜索用户名 / 邮箱"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setQ(input);
                load(input);
              }
            }}
          />
          <button
            className="btn btn-primary"
            onClick={() => {
              setQ(input);
              load(input);
            }}
          >
            <Icon name="search" size={17} strokeWidth={2} />
          </button>
        </div>
        <div className="hint" style={{ marginTop: 8 }}>
          共 {total} 位用户{q ? `，匹配「${q}」${users.length} 条` : ''}
        </div>
      </div>

      {loading && !users.length ? (
        <div className="center" style={{ padding: '40px 0' }}><Spinner size={24} /></div>
      ) : (
        <div className="glass mx mt">
          <div className="list">
            {users.map((u) => (
              <div key={u.id} className="list-item admin-user-item">
                <Avatar user={u} size={44} />
                <div className="list-main">
                  <div className="list-title">
                    {u.username}
                    {u.is_admin ? <span className="badge-soft" style={{ marginLeft: 6 }}>管理员</span> : null}
                  </div>
                  <div className="list-desc">
                    {u.email}
                    {u.banned ? <span className="admin-tag tag-ban">封禁{u.banned_until ? ' · ' + remainText(u.banned_until) : ' · 永久'}</span> : null}
                    {u.muted ? <span className="admin-tag tag-mute">禁言 · {remainText(u.muted_until)}</span> : null}
                  </div>
                </div>
                {u.is_admin ? (
                  <span className="hint">—</span>
                ) : (
                  <div className="flex gap6">
                    <button className={'admin-mini' + (u.banned ? ' positive' : ' danger')} onClick={() => (u.banned ? doUnban(u) : setBanTarget(u))}>
                      {u.banned ? '解封' : '封禁'}
                    </button>
                    <button className={'admin-mini' + (u.muted ? ' positive' : '')} onClick={() => (u.muted ? doUnmute(u) : setMuteTarget(u))}>
                      {u.muted ? '解除' : '禁言'}
                    </button>
                  </div>
                )}
              </div>
            ))}
            {!users.length ? <Empty icon="users" text="没有找到用户" /> : null}
          </div>
        </div>
      )}

      <ActionSheet
        open={!!banTarget}
        onClose={() => setBanTarget(null)}
        title={`封禁「${banTarget?.username || ''}」`}
        actions={BAN_OPTIONS.map((o) => ({
          icon: <IconTile name="ban" tone="rose" box={34} size={18} />,
          label: o.label,
          danger: true,
          onClick: () => doBan(o.days),
        }))}
      />

      <ActionSheet
        open={!!muteTarget}
        onClose={() => setMuteTarget(null)}
        title={`禁言「${muteTarget?.username || ''}」`}
        actions={MUTE_OPTIONS.map((o) => ({
          icon: <IconTile name="clock" tone="amber" box={34} size={18} />,
          label: o.label,
          onClick: () => doMute(o.minutes),
        }))}
      />
    </>
  );
}

/* ============================== 聊天记录 ============================== */
function msgPreview(m) {
  if (m.recalled) return '该消息已撤回';
  if (m.msg_type === 'image') return '[图片]';
  if (m.msg_type === 'video') return '[视频]';
  if (m.msg_type === 'sticker') return '[动画表情]';
  return m.content || '';
}

function origPreview(o) {
  if (!o) return '';
  if (o.msg_type === 'image') return '[图片]';
  if (o.msg_type === 'video') return '[视频]';
  if (o.msg_type === 'sticker') return '[动画表情]';
  return o.content || '';
}

/** 指定会话的消息记录（含撤回原文） */
function ChatMessages({ target, onBack }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [recalledTotal, setRecalledTotal] = useState(0);
  const listRef = useRef(null);

  const fetchPage = async (before) => {
    const q = `/api/admin/chat/messages?convType=${target.convType}&convId=${encodeURIComponent(target.convId)}&limit=60`;
    const d = await api.get(before ? `${q}&before=${before}` : q);
    const items = d.messages || [];
    if (before) setMessages((l) => items.concat(l));
    else setMessages(items);
    setHasMore(!!d.has_more);
    setRecalledTotal(d.recalled_total || 0);
    return items;
  };

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        await fetchPage(0);
        setTimeout(() => {
          const el = listRef.current;
          if (el) el.scrollTop = el.scrollHeight;
        }, 60);
      } catch (e) {
        toast(e.message, 'error');
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target.convId]);

  const loadEarlier = async () => {
    if (moreLoading || !messages.length) return;
    setMoreLoading(true);
    const el = listRef.current;
    const prevH = el ? el.scrollHeight : 0;
    const prevTop = el ? el.scrollTop : 0;
    try {
      await fetchPage(messages[0].id);
      setTimeout(() => {
        if (el) el.scrollTop = prevTop + (el.scrollHeight - prevH);
      }, 30);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setMoreLoading(false);
    }
  };

  return (
    <div className="mx mt">
      <div className="glass glass-strong pad flex gap8" style={{ alignItems: 'center' }}>
        <button className="icon-btn" onClick={onBack} aria-label="返回">
          <Icon name="chevron" size={18} strokeWidth={2} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <Avatar user={{ id: target.convId, username: target.title, avatar: target.avatar }} size={38} />
        <div className="list-main">
          <div className="list-title">
            <span className="ellipsis">{target.title}</span>
            {target.is_official ? <span className="badge-soft">官方</span> : null}
          </div>
          <div className="list-desc">{target.convType === 'group' ? '群聊记录' : '私聊记录'} · 共 {messages.length} 条已加载{hasMore ? '（还有更早的）' : ''}</div>
        </div>
        {recalledTotal > 0 ? <span className="mention-pill">撤回 {recalledTotal}</span> : null}
      </div>

      <div className="admin-chat-list" ref={listRef}>
        {loading ? (
          <div className="center" style={{ padding: '30px 0' }}><Spinner size={22} /></div>
        ) : messages.length === 0 ? (
          <Empty icon="message" text="该会话暂无聊天记录" />
        ) : (
          <>
            {hasMore ? (
              <div className="center" style={{ padding: '4px 0 10px' }}>
                <button className="btn" onClick={loadEarlier} disabled={moreLoading}>
                  {moreLoading ? <Spinner size={16} /> : '加载更早的记录'}
                </button>
              </div>
            ) : (
              <div className="hint center" style={{ padding: '4px 0 10px' }}>已到最顶部</div>
            )}
            {messages.map((m) => (
              <div key={m.id} className="admin-chat-row">
                <div className="admin-chat-head">
                  <Avatar user={m.sender || { id: 0, username: 'AI' }} size={28} />
                  <span className="admin-chat-name">{m.sender?.username || (m.sender_id === 0 ? 'AI' : '用户')}</span>
                  <span className="hint" style={{ marginLeft: 'auto' }}>{fmtTime(m.created_at)}</span>
                </div>
                <div className={'admin-chat-bubble' + (m.recalled ? ' recalled' : '')}>
                  {m.one_time ? (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                      <span className="badge-soft">一次性</span>
                      {m.burned_by?.length ? (
                        <span className="badge-soft" style={{ color: '#ffb020', borderColor: 'rgba(255,176,32,.42)' }}>
                          已销毁 · 原文保留
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                  {m.recalled ? <span className="admin-recall-tag">已撤回</span> : null}
                  {!m.recalled && (m.msg_type === 'image' || m.msg_type === 'video') && m.media_url ? (
                    m.msg_type === 'video' ? (
                      <VideoPlayer src={mediaUrl(m.media_url)} style={{ maxWidth: 200, borderRadius: 10 }} />
                    ) : (
                      <img src={mediaUrl(m.media_url)} alt="" loading="lazy" style={{ maxWidth: 200, borderRadius: 10 }} />
                    )
                  ) : m.msg_type === 'sticker' && m.media_url && !m.recalled ? (
                    <img src={mediaUrl(m.media_url)} alt={m.content} loading="lazy" style={{ maxWidth: 120, borderRadius: 10 }} />
                  ) : (
                    <span>{msgPreview(m)}</span>
                  )}
                  {m.extra?.reply ? (
                    <div className="admin-chat-quote">引用 {m.extra.reply.name}：{m.extra.reply.text}</div>
                  ) : null}
                  {m.orig ? <div className="admin-chat-orig">撤回前原文：{origPreview(m.orig)}</div> : null}
                </div>
              </div>
            ))}
            <div className="hint center" style={{ padding: '10px 0 4px' }}>已到最新</div>
          </>
        )}
      </div>
    </div>
  );
}

function ChatLog() {
  const [target, setTarget] = useState(null); // { convType, convId, title, avatar, is_official }
  const [mode, setMode] = useState('dm'); // 'dm' | 'group'

  const [users, setUsers] = useState([]);
  const [uq, setUq] = useState('');
  const [userLoading, setUserLoading] = useState(false);
  const [pickedUser, setPickedUser] = useState(null);
  const [peers, setPeers] = useState([]);
  const [peerLoading, setPeerLoading] = useState(false);

  const [groups, setGroups] = useState([]);
  const [groupLoading, setGroupLoading] = useState(false);

  const loadUsers = async (kw) => {
    setUserLoading(true);
    try {
      const d = await api.get(`/api/admin/users?q=${encodeURIComponent(kw || '')}&limit=200`);
      setUsers(d.users || []);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setUserLoading(false);
    }
  };

  const loadGroups = async () => {
    setGroupLoading(true);
    try {
      const d = await api.get('/api/admin/chat/groups');
      setGroups(d.groups || []);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setGroupLoading(false);
    }
  };

  useEffect(() => {
    if (mode === 'dm' && !users.length) loadUsers('');
    if (mode === 'group' && !groups.length) loadGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const pickUser = async (u) => {
    setPickedUser(u);
    setPeers([]);
    setPeerLoading(true);
    try {
      const d = await api.get(`/api/admin/chat/peers?userId=${u.id}`);
      setPeers(d.peers || []);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setPeerLoading(false);
    }
  };

  if (target) return <ChatMessages target={target} onBack={() => setTarget(null)} />;

  return (
    <div className="mx mt">
      <div className="emoji-tabs">
        <div className={'emoji-tab' + (mode === 'dm' ? ' active' : '')} onClick={() => { setMode('dm'); setPickedUser(null); setPeers([]); }}>
          <Icon name="user" size={15} strokeWidth={1.9} /> 私聊
        </div>
        <div className={'emoji-tab' + (mode === 'group' ? ' active' : '')} onClick={() => setMode('group')}>
          <Icon name="users" size={15} strokeWidth={1.9} /> 群聊
        </div>
      </div>

      {mode === 'dm' ? (
        pickedUser ? (
          <>
            <div className="glass pad flex gap8" style={{ alignItems: 'center', marginTop: 8 }}>
              <button className="icon-btn" onClick={() => { setPickedUser(null); setPeers([]); }} aria-label="返回">
                <Icon name="chevron" size={18} strokeWidth={2} style={{ transform: 'rotate(180deg)' }} />
              </button>
              <Avatar user={pickedUser} size={38} />
              <div className="list-main">
                <div className="list-title">{pickedUser.username}</div>
                <div className="list-desc">选择要查看的私聊对象</div>
              </div>
            </div>
            {peerLoading ? (
              <div className="center" style={{ padding: '26px 0' }}><Spinner size={22} /></div>
            ) : (
              <div className="glass mx mt">
                <div className="list">
                  {peers.map((p) => (
                    <div
                      key={p.conv_id}
                      className="list-item"
                      onClick={() => setTarget({ convType: 'dm', convId: p.conv_id, title: `${pickedUser.username} ↔ ${p.peer?.username || ''}`, avatar: p.peer?.avatar })}
                    >
                      <Avatar user={p.peer} size={44} />
                      <div className="list-main">
                        <div className="list-title">{p.peer?.username || '用户'}</div>
                        <div className="list-desc">
                          <span className="dim">{p.last_recalled ? '[已撤回] ' : ''}{p.last_text || '（暂无消息）'}</span>
                        </div>
                      </div>
                      <div className="list-meta">
                        <span className="hint">{fmtTime(p.last_time)}</span>
                        <span className="hint">{p.msg_count} 条</span>
                      </div>
                    </div>
                  ))}
                  {!peers.length ? <Empty icon="message" text="该用户暂无任何私聊记录" /> : null}
                </div>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="glass mx" style={{ padding: 12, marginTop: 8 }}>
              <div className="flex gap8">
                <input
                  className="input grow"
                  placeholder="搜索用户名 / 邮箱"
                  value={uq}
                  onChange={(e) => setUq(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') loadUsers(uq);
                  }}
                />
                <button className="btn btn-primary" onClick={() => loadUsers(uq)}>
                  <Icon name="search" size={17} strokeWidth={2} />
                </button>
              </div>
              <div className="hint" style={{ marginTop: 8 }}>选择用户后，即可查看他与所有人的私聊记录（含已撤回内容）</div>
            </div>
            {userLoading ? (
              <div className="center" style={{ padding: '26px 0' }}><Spinner size={22} /></div>
            ) : (
              <div className="glass mx mt">
                <div className="list">
                  {users.map((u) => (
                    <div key={u.id} className="list-item" onClick={() => pickUser(u)}>
                      <Avatar user={u} size={44} />
                      <div className="list-main">
                        <div className="list-title">
                          {u.username}
                          {u.is_admin ? <span className="badge-soft" style={{ marginLeft: 6 }}>管理员</span> : null}
                        </div>
                        <div className="list-desc">{u.email}</div>
                      </div>
                      <Icon name="chevron" size={16} strokeWidth={2} style={{ opacity: 0.5 }} />
                    </div>
                  ))}
                  {!users.length ? <Empty icon="users" text="没有找到用户" /> : null}
                </div>
              </div>
            )}
          </>
        )
      ) : (
        <>
          <div className="hint" style={{ padding: '8px 4px 0' }}>选择群聊后，可查看该群全部聊天记录（含已撤回内容）</div>
          {groupLoading ? (
            <div className="center" style={{ padding: '26px 0' }}><Spinner size={22} /></div>
          ) : (
            <div className="glass mx mt">
              <div className="list">
                {groups.map((g) => (
                  <div
                    key={g.id}
                    className="list-item"
                    onClick={() => setTarget({ convType: 'group', convId: String(g.id), title: g.name, avatar: g.avatar, is_official: g.is_official })}
                  >
                    <Avatar user={{ id: g.id, username: g.name, avatar: g.avatar, is_official: g.is_official }} size={44} />
                    <div className="list-main">
                      <div className="list-title">
                        {g.name}
                        {g.is_official ? <span className="badge-soft" style={{ marginLeft: 6 }}>官方</span> : null}
                      </div>
                      <div className="list-desc">成员 {g.member_count} · 消息 {g.msg_count} · 最后 {fmtTime(g.last_time)}</div>
                    </div>
                    <Icon name="chevron" size={16} strokeWidth={2} style={{ opacity: 0.5 }} />
                  </div>
                ))}
                {!groups.length ? <Empty icon="users" text="暂无群聊" /> : null}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ============================== 用户 IP ============================== */

const IP_BLOCK_OPTIONS = [
  { label: '永久', days: 0 },
  { label: '1 天', days: 1 },
  { label: '7 天', days: 7 },
  { label: '30 天', days: 30 },
];

function IpManager() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [auto, setAuto] = useState(true);
  const [target, setTarget] = useState(null); // 待拉黑的用户行
  const [unblockTarget, setUnblockTarget] = useState(null);
  const [reason, setReason] = useState('');
  const [days, setDays] = useState(0);
  const [busy, setBusy] = useState(false);
  const qRef = useRef('');
  qRef.current = q;

  const load = async (silent) => {
    if (!silent) setLoading(true);
    try {
      const d = await api.get(`/api/admin/ips?q=${encodeURIComponent(qRef.current)}`);
      setData(d);
    } catch (e) {
      if (!silent) toast(e.message, 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 每 5 秒自动刷新，IP 与在线状态保持实时
  useEffect(() => {
    if (!auto) return () => {};
    const t = setInterval(() => load(true), 5000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto]);

  const openBlock = (u) => {
    setTarget(u);
    setReason('');
    setDays(0);
  };

  const doBlock = async () => {
    if (!target?.ip) return;
    setBusy(true);
    try {
      await api.post('/api/admin/ips/block', { ip: target.ip, days, reason });
      toast(days > 0 ? `已拉黑 ${target.ip}，${days} 天后自动解除` : `已永久拉黑 ${target.ip}`, 'info');
      setTarget(null);
      load(true);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const doUnblock = async () => {
    const ip = unblockTarget?.ip;
    if (!ip) return;
    try {
      await api.post('/api/admin/ips/unblock', { ip });
      toast(`已解除对 ${ip} 的拉黑`, 'info');
      setUnblockTarget(null);
      load(true);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const stats = data?.stats || {};
  const users = data?.users || [];

  return (
    <div className="mx mt">
      <div className="admin-stats" style={{ padding: 0 }}>
        <StatTile icon="users" tone="mint" label="在线用户" value={stats.online ?? 0} sub="60 秒内有请求" />
        <StatTile icon="globe" tone="brand" label="今日独立 IP" value={stats.today_ips ?? 0} />
        <StatTile icon="shield" tone="rose" label="已拉黑 IP" value={stats.blocked ?? 0} />
        <div className="glass pad admin-stat">
          <IconTile name="server" tone="violet" box={36} size={18} />
          <div className="admin-stat-val" style={{ fontSize: 15, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            {data?.my_ip || '—'}
          </div>
          <div className="admin-stat-label">我的 IP</div>
          <div className="hint" style={{ fontSize: 11 }}>请勿拉黑该 IP</div>
        </div>
      </div>

      <div className="glass pad mt">
        <div className="flex gap8">
          <input
            className="input grow"
            placeholder="搜索用户名 / IP"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') load();
            }}
          />
          <button className="btn btn-primary" onClick={() => load()}>
            <Icon name="search" size={17} strokeWidth={2} />
          </button>
        </div>
        <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
          <span className="hint">真实 IP 实时更新，每 5 秒自动刷新</span>
          <span className="flex gap6" style={{ alignItems: 'center' }}>
            <Switch on={auto} onChange={setAuto} />
            <span className="hint">自动刷新</span>
          </span>
        </div>
      </div>

      {loading && !data ? (
        <div className="center" style={{ padding: '30px 0' }}><Spinner size={24} /></div>
      ) : (
        <div className="glass mx mt">
          <div className="list">
            {users.map((u) => (
              <div key={u.id} className="list-item" style={{ alignItems: 'flex-start' }}>
                <Avatar user={{ id: u.id, username: u.username, avatar: u.avatar, is_official: u.is_official }} size={42} />
                <div className="list-main">
                  <div className="list-title">
                    {u.username}
                    {u.is_official ? <span className="badge-soft" style={{ marginLeft: 6 }}>官方</span> : null}
                    {u.is_admin ? <span className="badge-soft" style={{ marginLeft: 6 }}>管理员</span> : null}
                    {u.online ? (
                      <span className="tag-online" style={{ marginLeft: 8 }}><i />在线</span>
                    ) : null}
                  </div>
                  <div className="list-desc" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 }}>
                    {u.ip || '尚未记录到 IP'}
                    {u.blocked ? <span className="badge-soft" style={{ marginLeft: 8, color: '#ff9dad' }}>已拉黑</span> : null}
                  </div>
                  <div className="hint" style={{ marginTop: 3 }}>
                    最后活跃 {fmtTime(u.ip_at || u.last_seen)} · 请求 {u.hits} 次
                  </div>
                </div>
                <div style={{ flex: '0 0 auto', paddingTop: 2 }}>
                  {u.blocked ? (
                    <button className="btn btn-sm" onClick={() => setUnblockTarget(u)}>解除拉黑</button>
                  ) : u.ip ? (
                    <button className="btn btn-sm btn-danger" onClick={() => openBlock(u)}>拉黑</button>
                  ) : (
                    <span className="hint">—</span>
                  )}
                </div>
              </div>
            ))}
            {!users.length ? <Empty icon="shield" text="暂无 IP 记录，用户访问后会自动出现" /> : null}
          </div>
        </div>
      )}

      {data?.blocks?.length ? (
        <>
          <div className="section-head">已拉黑的 IP</div>
          <div className="glass mx">
            <div className="list">
              {data.blocks.map((b) => (
                <div key={b.ip} className="list-item">
                  <IconTile name="ban" tone="rose" box={36} size={17} />
                  <div className="list-main">
                    <div className="list-title" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13.5 }}>{b.ip}</div>
                    <div className="list-desc">
                      {b.until > 0 ? `到期：${fmtTime(b.until)}` : '永久拉黑'}
                      {b.reason ? ` · ${b.reason}` : ''}
                    </div>
                  </div>
                  <button className="btn btn-sm" onClick={() => setUnblockTarget({ ip: b.ip })}>解除</button>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}

      <Sheet open={!!target} onClose={() => setTarget(null)} title={target ? `拉黑 IP · ${target.ip}` : ''}>
        {target ? (
          <div className="pad">
            <div className="hint">
              拉黑后该 IP 将无法打开本站页面，也无法调用任何接口。请确认不是自己的网络。
            </div>
            <div className="emoji-tabs" style={{ marginTop: 12 }}>
              {IP_BLOCK_OPTIONS.map((o) => (
                <div
                  key={o.days}
                  className={'emoji-tab' + (days === o.days ? ' active' : '')}
                  onClick={() => setDays(o.days)}
                >
                  {o.label}
                </div>
              ))}
            </div>
            <input
              className="input mt"
              placeholder="拉黑原因（可选，仅管理员可见）"
              value={reason}
              maxLength={60}
              onChange={(e) => setReason(e.target.value)}
            />
            <div className="hint" style={{ marginTop: 8 }}>
              用户：{target.username} · 最后活跃 {fmtTime(target.ip_at || target.last_seen)}
            </div>
            <button className="btn btn-danger btn-block mt" disabled={busy} onClick={doBlock}>
              {busy ? '处理中…' : '确认拉黑该 IP'}
            </button>
          </div>
        ) : null}
      </Sheet>

      <ActionSheet
        open={!!unblockTarget}
        onClose={() => setUnblockTarget(null)}
        title={unblockTarget ? `解除拉黑 ${unblockTarget.ip || ''}` : ''}
        actions={[
          {
            label: '解除拉黑，允许该 IP 访问',
            danger: true,
            onClick: doUnblock,
          },
        ]}
      />
    </div>
  );
}

