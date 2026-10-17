import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { Avatar, Empty, Loading, TopBar, Sheet, ActionSheet, toast, Switch, MediaPicker } from '../components/ui.jsx';
import { groupByInitial, fmtDuration } from '../lib/time.js';
import { PRESET_AVATARS } from '../lib/avatar.js';

const MUTE_OPTIONS = [
  { label: '10 分钟', sec: 600 },
  { label: '1 小时', sec: 3600 },
  { label: '1 天', sec: 86400 },
  { label: '7 天', sec: 604800 },
  { label: '永久', sec: 315360000 },
];

export default function GroupInfoScreen({ groupId }) {
  const { back, push, presence, refreshConversations, me } = useApp();
  const [group, setGroup] = useState(null);
  const [members, setMembers] = useState([]);
  const [can, setCan] = useState({});
  const [myRole, setMyRole] = useState('member');
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(null); // editName | editAvatar | invite | mute
  const [target, setTarget] = useState(null);
  const [nameDraft, setNameDraft] = useState('');
  const [annDraft, setAnnDraft] = useState('');
  const [muteSel, setMuteSel] = useState(MUTE_OPTIONS[1]);
  const [muteCustom, setMuteCustom] = useState('');
  const [friends, setFriends] = useState([]);

  const load = async () => {
    try {
      const d = await api.get(`/api/groups/${groupId}`);
      setGroup(d.group);
      setMembers(d.members || []);
      setCan(d.can || {});
      setMyRole(d.my_role);
      setNameDraft(d.group.name);
      setAnnDraft(d.group.announcement || '');
    } catch (e) {
      toast(e.message, 'error');
      back();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupId]);

  const openInvite = async () => {
    setSheet('invite');
    try {
      const d = await api.get('/api/friends');
      const ids = new Set(members.map((m) => m.id));
      setFriends((d.friends || []).map((f) => ({ ...f, joined: ids.has(f.id) })));
    } catch {}
  };

  const memberGroups = useMemo(
    () => groupByInitial(members.filter((m) => m.id !== me.id), (m) => m.remark || m.username),
    [members, me?.id],
  );
  const onlineCount = members.filter((m) => presence[m.id] ?? m.online).length;

  const patchGroup = async (patch) => {
    try {
      const d = await api.patch(`/api/groups/${groupId}`, patch);
      setGroup((g) => ({ ...g, ...d.group }));
      toast('已更新');
      refreshConversations();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const doInvite = async (uid) => {
    try {
      await api.post(`/api/groups/${groupId}/invite`, { userIds: [uid] });
      setFriends((l) => l.map((f) => (f.id === uid ? { ...f, joined: true } : f)));
      toast('已邀请入群');
      load();
      refreshConversations();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const memberAction = async (action) => {
    const m = target;
    try {
      if (action === 'setAdmin') await api.post(`/api/groups/${groupId}/set-admin`, { userId: m.id, admin: true });
      if (action === 'unsetAdmin') await api.post(`/api/groups/${groupId}/set-admin`, { userId: m.id, admin: false });
      if (action === 'mute') {
        setSheet('mute');
        return;
      }
      if (action === 'unmute') await api.post(`/api/groups/${groupId}/mute`, { userId: m.id, durationSec: 0 });
      if (action === 'kick') await api.post(`/api/groups/${groupId}/kick`, { userId: m.id });
      if (action === 'transfer') await api.post(`/api/groups/${groupId}/transfer`, { userId: m.id });
      toast('操作成功');
      load();
      refreshConversations();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const applyMute = async () => {
    const sec = muteCustom ? Number(muteCustom) * 60 : muteSel.sec;
    try {
      await api.post(`/api/groups/${groupId}/mute`, { userId: target.id, durationSec: sec });
      toast(`已禁言 ${muteCustom ? muteCustom + ' 分钟' : muteSel.label}`);
      setSheet(null);
      setMuteCustom('');
      load();
      refreshConversations();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const quit = async () => {
    try {
      await api.post(`/api/groups/${groupId}/quit`, {});
      toast('已退出群聊');
      await refreshConversations();
      back();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ height: '100%' }}>
        <TopBar title="群聊信息" onBack={back} />
        <Loading />
      </div>
    );
  }

  return (
    <div className="page" style={{ height: '100%' }}>
      <TopBar title="群聊信息" sub={`${members.length} 位成员 · ${onlineCount} 人在线`} onBack={back} />
      <div className="page-scroll">
        {/* 群资料 */}
        <div className="glass glass-strong mx" style={{ padding: 18, marginTop: 6 }}>
          <div className="flex gap12">
            <Avatar user={{ id: group.id, username: group.name, avatar: group.avatar, is_official: group.is_official }} size={64} />
            <div className="grow">
              <div style={{ fontSize: 19, fontWeight: 800 }}>
                {group.name}
                {group.is_official ? <span className="badge-soft" style={{ marginLeft: 8 }}>官方群</span> : null}
              </div>
              <div className="hint" style={{ marginTop: 4 }}>
                群主：{group.owner?.username} · 我的身份：
                {myRole === 'owner' ? '群主' : myRole === 'admin' ? '管理员' : '成员'}
              </div>
              <div className="hint" style={{ marginTop: 2 }}>
                群 ID：{group.id} · <span className="tag-online"><i />{onlineCount} 人在线</span>
              </div>
            </div>
          </div>

          {can.edit ? (
            <div className="flex gap8" style={{ marginTop: 14 }}>
              <button className="btn btn-sm btn-ghost grow" onClick={() => setSheet('editName')}>修改群名称</button>
              <button className="btn btn-sm btn-ghost grow" onClick={() => setSheet('editAvatar')}>更换群头像</button>
            </div>
          ) : null}

          <div className="glass pad" style={{ marginTop: 14, borderRadius: 14 }}>
            <div className="hint" style={{ fontWeight: 700, color: 'var(--text-2)', marginBottom: 6 }}>群公告</div>
            {can.edit ? (
              <textarea className="input" rows={2} value={annDraft} onChange={(e) => setAnnDraft(e.target.value)} placeholder="填写群公告" />
            ) : (
              <div className="small">{group.announcement || '暂无公告'}</div>
            )}
            {can.edit ? (
              <button className="btn btn-sm btn-primary mt" style={{ marginTop: 8 }} onClick={() => patchGroup({ announcement: annDraft })}>保存公告</button>
            ) : null}
          </div>
        </div>

        {/* 开关 */}
        <div className="glass mx mt">
          <div className="list">
            <div className="list-item">
              <span style={{ fontSize: 19 }}>🔕</span>
              <div className="list-main">
                <div className="list-title">消息免打扰</div>
                <div className="list-desc">开启后新消息不再弹出通知</div>
              </div>
              <Switch
                on={!!group.dnd}
                onChange={async (v) => {
                  try {
                    await api.patch(`/api/groups/${groupId}/dnd`, { dnd: v });
                    setGroup((g) => ({ ...g, dnd: v }));
                    refreshConversations();
                    toast(v ? '已开启免打扰' : '已关闭免打扰');
                  } catch (e) {
                    toast(e.message, 'error');
                  }
                }}
              />
            </div>
            <div className="list-item" onClick={openInvite}>
              <span style={{ fontSize: 19 }}>➕</span>
              <div className="list-main">
                <div className="list-title">邀请好友入群</div>
                <div className="list-desc">从好友列表选择成员加入</div>
              </div>
              <span className="chev dim">›</span>
            </div>
            <div className="list-item" onClick={() => push('chat', { convType: 'group', convId: String(group.id), title: group.name, avatar: group.avatar })}>
              <span style={{ fontSize: 19 }}>💬</span>
              <div className="list-main">
                <div className="list-title">进入群聊</div>
              </div>
              <span className="chev dim">›</span>
            </div>
          </div>
        </div>

        {/* 群成员（首字母分组） */}
        <div className="section-head">群成员（{members.length}）</div>
        <div className="glass mx">
          <div className="list">
            <div className="section-head" style={{ padding: '12px 16px 6px' }}>群主 / 我</div>
            {members.filter((m) => m.id === me.id || m.role === 'owner').map((m) => (
              <MemberRow key={m.id} m={m} online={presence[m.id] ?? m.online} me={me} />
            ))}
            {memberGroups.map((g) => (
              <React.Fragment key={g.letter}>
                <div className="section-head" style={{ padding: '12px 16px 6px' }}>{g.letter}</div>
                {g.items.map((m) => (
                  <MemberRow
                    key={m.id}
                    m={m}
                    online={presence[m.id] ?? m.online}
                    me={me}
                    onClick={() => {
                      if (!can.kick && !can.mute) return;
                      setTarget(m);
                    }}
                  />
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="mx mt" style={{ marginTop: 18 }}>
          {group.is_official ? (
            <div className="hint center">官方群不支持退出，由官方账号「杰同学」管理</div>
          ) : can.quit ? (
            <button className="btn btn-block btn-danger" onClick={quit}>退出群聊</button>
          ) : (
            <div className="hint center">群主需先转让群主后才能退出</div>
          )}
        </div>
        <div style={{ height: 20 }} />
      </div>

      {/* 修改群名 */}
      <Sheet open={sheet === 'editName'} onClose={() => setSheet(null)} title="修改群名称">
        <input className="input" value={nameDraft} maxLength={20} onChange={(e) => setNameDraft(e.target.value)} placeholder="群名称" />
        <button className="btn btn-primary btn-block mt" style={{ marginTop: 12 }} onClick={() => { patchGroup({ name: nameDraft }); setSheet(null); }}>保存</button>
      </Sheet>

      {/* 更换群头像 */}
      <Sheet open={sheet === 'editAvatar'} onClose={() => setSheet(null)} title="更换群头像">
        <div className="avatar-pick" style={{ justifyContent: 'center' }}>
          {PRESET_AVATARS.map((p) => (
            <Avatar key={p.emoji} src={p.url} name={group.name} size={48} radius={14} onClick={() => { patchGroup({ avatar: p.url }); setSheet(null); }} style={{ cursor: 'pointer' }} />
          ))}
        </div>
        <MediaPicker
          onPick={async (files) => {
            try {
              const up = await api.upload(files[0], 'image');
              await patchGroup({ avatar: up.url });
              setSheet(null);
            } catch (e) {
              toast(e.message, 'error');
            }
          }}
        >
          <button className="btn btn-block mt" style={{ marginTop: 14 }}>上传本地图片</button>
        </MediaPicker>
      </Sheet>

      {/* 邀请好友 */}
      <Sheet open={sheet === 'invite'} onClose={() => setSheet(null)} title="邀请好友入群">
        {friends.length === 0 ? (
          <Empty icon="👥" text="还没有好友可邀请" />
        ) : (
          <div className="list">
            {friends.map((f) => (
              <div key={f.id} className="list-item">
                <Avatar user={f} size={44} />
                <div className="list-main">
                  <div className="list-title">{f.remark || f.username}</div>
                </div>
                {f.joined ? (
                  <span className="badge-soft">已在群内</span>
                ) : (
                  <button className="btn btn-sm btn-primary" onClick={() => doInvite(f.id)}>邀请</button>
                )}
              </div>
            ))}
          </div>
        )}
      </Sheet>

      {/* 禁言时长（自定义） */}
      <Sheet open={sheet === 'mute'} onClose={() => setSheet(null)} title={`禁言 ${target?.username || ''}`}>
        <div className="chip-row">
          {MUTE_OPTIONS.map((o) => (
            <div key={o.label} className={'chip' + (muteSel.label === o.label && !muteCustom ? ' active' : '')} onClick={() => { setMuteSel(o); setMuteCustom(''); }}>
              {o.label}
            </div>
          ))}
        </div>
        <div className="field" style={{ marginTop: 14 }}>
          <label>自定义时长（分钟）</label>
          <input className="input" type="number" min="1" placeholder="例如 30" value={muteCustom} onChange={(e) => setMuteCustom(e.target.value)} />
        </div>
        <button className="btn btn-primary btn-block" onClick={applyMute}>确认禁言</button>
      </Sheet>

      {/* 成员操作 */}
      <ActionSheet
        open={!!target && sheet !== 'mute'}
        onClose={() => setTarget(null)}
        title={target?.username}
        actions={
          target
            ? [
                ...(can.set_admin && target.role !== 'owner'
                  ? [target.role === 'admin'
                    ? { icon: '🔽', label: '取消管理员', onClick: () => memberAction('unsetAdmin') }
                    : { icon: '⭐', label: '设为管理员', onClick: () => memberAction('setAdmin') }]
                  : []),
                ...(can.mute && target.role !== 'owner'
                  ? target.mute_until > Date.now()
                    ? [{ icon: '🔊', label: `解除禁言（剩余 ${fmtDuration((target.mute_until - Date.now()) / 1000)}）`, onClick: () => memberAction('unmute') }]
                    : [{ icon: '🔇', label: '禁言（可自定义时长）', onClick: () => memberAction('mute') }]
                  : []),
                ...(can.transfer && target.role !== 'owner' ? [{ icon: '👑', label: '转让群主', onClick: () => memberAction('transfer') }] : []),
                ...(can.kick && target.role !== 'owner' ? [{ icon: '🚪', label: '移出群聊', danger: true, onClick: () => memberAction('kick') }] : []),
              ]
            : []
        }
      />
    </div>
  );
}

function MemberRow({ m, online, me, onClick }) {
  return (
    <div className="list-item" onClick={onClick}>
      <Avatar user={{ ...m, online }} size={44} />
      <div className="list-main">
        <div className="list-title">
          {m.username}
          {m.id === me.id ? <span className="badge-soft">我</span> : null}
          {m.role === 'owner' ? <span className="badge-soft">群主</span> : null}
          {m.role === 'admin' ? <span className="badge-soft">管理员</span> : null}
          {m.mute_until > Date.now() ? <span className="badge-soft" style={{ color: '#ffd479' }}>已禁言</span> : null}
        </div>
        <div className="list-desc">{online ? <span className="tag-online"><i />在线</span> : <span className="dim">离线</span>}</div>
      </div>
      <span className="chev dim">›</span>
    </div>
  );
}
