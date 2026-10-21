import React, { useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { Avatar, TopBar, toast, Spinner, MediaPicker, Sheet } from '../components/ui.jsx';
import { PRESET_AVATARS, presetIndex } from '../lib/avatar.js';
import { maskEmail } from '../lib/time.js';

export default function EditProfileScreen({ focus = 'avatar' }) {
  const { me, setMe, back } = useApp();
  const [tab, setTab] = useState(focus);
  const [name, setName] = useState(me?.username || '');
  const [bio, setBio] = useState(me?.bio || '');
  const [avatar, setAvatar] = useState(me?.avatar || '');
  const [busy, setBusy] = useState(false);
  const [avatarSheet, setAvatarSheet] = useState(false);
  const [remaining, setRemaining] = useState(null);

  const saveName = async () => {
    const u = name.trim();
    if (u === me.username) return toast('昵称没有变化');
    if (u.length < 1 || u.length > 6) return toast('昵称只能为 1-6 个字符', 'error');
    setBusy(true);
    try {
      const d = await api.patch('/api/auth/me', { username: u });
      setMe(d.user);
      setRemaining(d.remaining);
      toast('昵称已更新');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const saveAvatar = async (value) => {
    const prev = avatar;
    // 先本地生效，头像区域立即刷新，不必等接口返回或退回首页
    setAvatar(value);
    setAvatarSheet(false);
    setBusy(true);
    try {
      const d = await api.patch('/api/auth/me', { avatar: value });
      setMe(d.user);
      setAvatar(d.user?.avatar ?? value);
      toast('头像已更新');
    } catch (e) {
      setAvatar(prev);
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const uploadAvatar = async (files) => {
    try {
      const up = await api.upload(files[0], 'image');
      await saveAvatar(up.url);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const saveBio = async () => {
    setBusy(true);
    try {
      const d = await api.patch('/api/auth/me', { bio: bio.slice(0, 60) });
      setMe(d.user);
      toast('个性签名已更新');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page" style={{ height: '100%' }}>
      <TopBar title="编辑资料" onBack={back} />
      <div className="page-scroll">
        <div className="glass glass-strong mx" style={{ padding: 18, marginTop: 6, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center' }} onClick={() => setAvatarSheet(true)}>
            <Avatar user={{ ...me, avatar }} size={92} />
          </div>
          <div className="hint" style={{ marginTop: 10 }}>点击头像更换 · {maskEmail(me?.email)}</div>
          <div className="flex gap6" style={{ justifyContent: 'center', marginTop: 14 }}>
            <button className={'chip' + (tab === 'avatar' ? ' active' : '')} onClick={() => setTab('avatar')}>更换头像</button>
            <button className={'chip' + (tab === 'name' ? ' active' : '')} onClick={() => setTab('name')}>更换昵称</button>
            <button className={'chip' + (tab === 'bio' ? ' active' : '')} onClick={() => setTab('bio')}>个性签名</button>
          </div>
        </div>

        {tab === 'avatar' ? (
          <div className="glass mx mt" style={{ padding: 14 }}>
            <div className="section-head" style={{ padding: '0 0 10px' }}>预设头像</div>
            <div className="avatar-pick">
              {PRESET_AVATARS.map((p) => (
                <div
                  key={p.index}
                  className={'opt' + (presetIndex(avatar) === p.index ? ' sel' : '')}
                  onClick={() => saveAvatar(p.code)}
                  style={{ backgroundImage: `url("${p.url}")`, backgroundSize: 'cover' }}
                />
              ))}
            </div>
            <MediaPicker onPick={uploadAvatar} accept="image/*" multiple={false}>
              <button className="btn btn-block mt" style={{ marginTop: 14 }} disabled={busy}>{busy ? <Spinner size={16} /> : '上传本地图片'}</button>
            </MediaPicker>
          </div>
        ) : tab === 'name' ? (
          <div className="glass mx mt" style={{ padding: 14 }}>
            <div className="field">
              <label>新昵称（1-6 个字符）</label>
              <input className="input" maxLength={6} value={name} onChange={(e) => setName(e.target.value)} placeholder="输入新昵称" />
              <div className="hint">
                {name.trim().length}/6 · 每周最多修改 2 次
                {remaining != null ? ` · 剩余 ${remaining} 次` : ''}
              </div>
            </div>
            <button className="btn btn-primary btn-block" disabled={busy} onClick={saveName}>{busy ? <Spinner size={16} /> : '保存昵称'}</button>
          </div>
        ) : (
          <div className="glass mx mt" style={{ padding: 14 }}>
            <div className="field">
              <label>个性签名</label>
              <textarea className="input" style={{ minHeight: 90, resize: 'none' }} maxLength={60} value={bio} onChange={(e) => setBio(e.target.value)} placeholder="介绍一下自己…" />
              <div className="hint">{bio.length}/60</div>
            </div>
            <button className="btn btn-primary btn-block" disabled={busy} onClick={saveBio}>{busy ? <Spinner size={16} /> : '保存签名'}</button>
          </div>
        )}
        <div style={{ height: 20 }} />
      </div>

      <Sheet open={avatarSheet} onClose={() => setAvatarSheet(false)} title="更换头像">
        <div className="avatar-pick" style={{ justifyContent: 'center' }}>
          {PRESET_AVATARS.map((p) => (
            <div
              key={p.index}
              className={'opt' + (presetIndex(avatar) === p.index ? ' sel' : '')}
              onClick={() => saveAvatar(p.code)}
              style={{ backgroundImage: `url("${p.url}")`, backgroundSize: 'cover' }}
            />
          ))}
        </div>
        <MediaPicker onPick={uploadAvatar} accept="image/*" multiple={false}>
          <button className="btn btn-block mt" style={{ marginTop: 14 }}>上传本地图片</button>
        </MediaPicker>
      </Sheet>
    </div>
  );
}
