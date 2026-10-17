import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { Avatar, Sheet, TopBar, toast, Spinner, MediaPicker } from '../components/ui.jsx';

const VIS_OPTIONS = [
  { key: 'public', icon: '🌍', label: '公开', desc: '全站所有用户可见' },
  { key: 'friends', icon: '👥', label: '好友可见', desc: '仅已添加的好友可见' },
  { key: 'private', icon: '🔒', label: '私密', desc: '仅自己可见' },
  { key: 'custom', icon: '✅', label: '指定好友可见', desc: '只让选中的好友看到' },
  { key: 'exclude', icon: '🚫', label: '不给谁看', desc: '选中好友不可见' },
];

export default function PostMomentScreen() {
  const { back, me } = useApp();
  const [text, setText] = useState('');
  const [media, setMedia] = useState([]);
  const [visibility, setVisibility] = useState('public');
  const [friends, setFriends] = useState([]);
  const [picked, setPicked] = useState(new Set());
  const [visSheet, setVisSheet] = useState(false);
  const [pickSheet, setPickSheet] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get('/api/friends').then((d) => setFriends(d.friends || [])).catch(() => {});
  }, []);

  const pick = async (files) => {
    try {
      for (const f of files) {
        if (media.length >= 9) break;
        const up = await api.upload(f, f.type?.startsWith('video') ? 'video' : 'image');
        setMedia((list) => (list.length >= 9 ? list : [...list, { url: up.url, type: up.kind, localPreview: URL.createObjectURL(f) }]));
      }
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const submit = async () => {
    if (!text.trim() && !media.length) return toast('请输入内容或选择图片/视频', 'error');
    if ((visibility === 'custom' || visibility === 'exclude') && picked.size === 0) {
      return toast('请选择好友', 'error');
    }
    setSending(true);
    try {
      const ids = [...picked];
      await api.post('/api/moments', {
        text: text.trim(),
        media: media.map((m) => ({ url: m.url, type: m.type })),
        visibility,
        allowIds: visibility === 'custom' ? ids : [],
        denyIds: visibility === 'exclude' ? ids : [],
      });
      toast('发布成功');
      back();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSending(false);
    }
  };

  const togglePick = (id) => {
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const cur = VIS_OPTIONS.find((v) => v.key === visibility);

  return (
    <div className="page" style={{ height: '100%' }}>
      <TopBar
        title="发布动态"
        onBack={back}
        right={<button className="btn btn-sm btn-primary" disabled={sending} onClick={submit}>{sending ? <Spinner size={16} /> : '发布'}</button>}
      />
      <div className="page-scroll">
        <div className="glass glass-strong mx" style={{ padding: 14, marginTop: 6 }}>
          <div className="flex gap12" style={{ alignItems: 'flex-start' }}>
            <Avatar user={me} size={44} />
            <textarea
              className="input"
              style={{ minHeight: 110, resize: 'none', lineHeight: 1.6 }}
              placeholder="分享此刻的想法…"
              maxLength={1000}
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <div className="moment-media n3" style={{ marginTop: 12 }}>
            {media.map((m, i) => (
              <div key={i} style={{ position: 'relative' }}>
                {m.type === 'video' ? <video src={m.localPreview || m.url} muted /> : <img src={m.localPreview || m.url} alt="" />}
                <span
                  onClick={() => setMedia((l) => l.filter((_, k) => k !== i))}
                  style={{ position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, background: 'rgba(0,0,0,.6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 14 }}
                >
                  ×
                </span>
              </div>
            ))}
            {media.length < 9 ? (
              <MediaPicker onPick={pick} accept="image/*,video/*">
                <div className="add-tile" style={{ cursor: 'pointer' }}>+</div>
              </MediaPicker>
            ) : null}
          </div>
          <div className="hint" style={{ marginTop: 8 }}>最多 9 张图片 / 视频 · 已选 {media.length}</div>
        </div>

        <div className="glass mx mt">
          <div className="list">
            <div className="list-item" onClick={() => setVisSheet(true)}>
              <span style={{ fontSize: 19 }}>{cur.icon}</span>
              <div className="list-main">
                <div className="list-title">{cur.label}</div>
                <div className="list-desc">{cur.desc}</div>
              </div>
              <span className="chev dim">›</span>
            </div>
            {visibility === 'custom' || visibility === 'exclude' ? (
              <div className="list-item" onClick={() => setPickSheet(true)}>
                <span style={{ fontSize: 19 }}>👤</span>
                <div className="list-main">
                  <div className="list-title">{visibility === 'custom' ? '选择可见好友' : '选择不可见好友'}</div>
                  <div className="list-desc">已选 {picked.size} 位好友</div>
                </div>
                <span className="chev dim">›</span>
              </div>
            ) : null}
          </div>
        </div>
        <div style={{ height: 20 }} />
      </div>

      {/* 可见范围 */}
      <Sheet open={visSheet} onClose={() => setVisSheet(false)} title="谁可以看">
        <div className="list">
          {VIS_OPTIONS.map((v) => (
            <div key={v.key} className="list-item" onClick={() => { setVisibility(v.key); setVisSheet(false); if (v.key !== 'custom' && v.key !== 'exclude') setPicked(new Set()); }}>
              <span style={{ fontSize: 20 }}>{v.icon}</span>
              <div className="list-main">
                <div className="list-title">{v.label}</div>
                <div className="list-desc">{v.desc}</div>
              </div>
              {visibility === v.key ? <span className="ok-text">✓</span> : null}
            </div>
          ))}
        </div>
      </Sheet>

      {/* 好友选择 */}
      <Sheet open={pickSheet} onClose={() => setPickSheet(false)} title={visibility === 'custom' ? '选择可见好友' : '选择不可见好友'}>
        {friends.length === 0 ? (
          <div className="hint center" style={{ padding: 20 }}>还没有好友</div>
        ) : (
          <div className="list">
            {friends.map((f) => (
              <div key={f.id} className="list-item" onClick={() => togglePick(f.id)}>
                <Avatar user={f} size={44} />
                <div className="list-main">
                  <div className="list-title">{f.remark || f.username}</div>
                </div>
                <span style={{ width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, border: '1.5px solid ' + (picked.has(f.id) ? 'var(--brand-2)' : 'rgba(255,255,255,.24)'), background: picked.has(f.id) ? 'var(--brand-grad)' : 'transparent' }}>{picked.has(f.id) ? '✓' : ''}</span>
              </div>
            ))}
          </div>
        )}
        <button className="btn btn-primary btn-block mt" style={{ marginTop: 12 }} onClick={() => setPickSheet(false)}>完成（{picked.size}）</button>
      </Sheet>
    </div>
  );
}
