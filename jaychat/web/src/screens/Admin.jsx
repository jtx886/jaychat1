import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { Avatar, TopBar, ActionSheet, MediaPicker, toast, Spinner, Empty } from '../components/ui.jsx';
import { Icon, IconTile } from '../components/icons.jsx';

const TABS = [
  { key: 'overview', name: '总览', icon: 'globe' },
  { key: 'ai', name: 'AI 配置', icon: 'robot' },
  { key: 'users', name: '用户管理', icon: 'users' },
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
      const d = await api.patch('/api/admin/ai', {
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
        <div className="hint">兼容 OpenAI 协议的第三方接口，一般以 /v1/chat/completions 结尾</div>
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
