import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';
import { Avatar, Empty, Loading, Sheet, TopBar, toast } from '../components/ui.jsx';
import { Icon, IconTile } from '../components/icons.jsx';
import { VIS_OPTIONS } from '../lib/momentVis.js';

/** 修改已发布动态的可见范围 */
export default function MomentVisibilityScreen({ momentId, onSaved }) {
  const { back } = useApp();
  const [moment, setMoment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [visibility, setVisibility] = useState('public');
  const [picked, setPicked] = useState(new Set());
  const [friends, setFriends] = useState([]);
  const [visSheet, setVisSheet] = useState(false);
  const [pickSheet, setPickSheet] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get(`/api/moments/${momentId}`);
        setMoment(d.moment);
        setVisibility(d.moment.visibility || 'public');
      } catch (e) {
        toast(e.message, 'error');
        back();
      } finally {
        setLoading(false);
      }
    })();
    api.get('/api/friends').then((d) => setFriends(d.friends || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [momentId]);

  const cur = VIS_OPTIONS.find((v) => v.key === visibility) || VIS_OPTIONS[0];
  const needPick = visibility === 'custom' || visibility === 'exclude';

  const togglePick = (id) => {
    setPicked((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const save = async () => {
    if (needPick && picked.size === 0) return toast('请选择好友', 'error');
    setSaving(true);
    try {
      const ids = [...picked];
      const d = await api.patch(`/api/moments/${momentId}`, {
        visibility,
        allowIds: visibility === 'custom' ? ids : [],
        denyIds: visibility === 'exclude' ? ids : [],
      });
      setMoment(d.moment);
      toast('可见范围已更新');
      onSaved?.(d.moment);
      back();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page" style={{ height: '100%' }}>
        <TopBar title="修改可见范围" onBack={back} />
        <Loading />
      </div>
    );
  }

  return (
    <div className="page" style={{ height: '100%' }}>
      <TopBar
        title="修改可见范围"
        onBack={back}
        right={<button className="btn btn-sm btn-primary" disabled={saving} onClick={save}>保存</button>}
      />
      <div className="page-scroll">
        {moment?.text ? (
          <div className="glass mx" style={{ padding: 12, marginTop: 6 }}>
            <div className="hint ellipsis" style={{ whiteSpace: 'normal' }}>{moment.text}</div>
          </div>
        ) : null}

        <div className="glass mx mt">
          <div className="list">
            <div className="list-item" onClick={() => setVisSheet(true)}>
              <IconTile name={cur.icon} tone={cur.tone} />
              <div className="list-main">
                <div className="list-title">{cur.label}</div>
                <div className="list-desc">{cur.desc}</div>
              </div>
              <span className="chev dim">›</span>
            </div>
            {needPick ? (
              <div className="list-item" onClick={() => setPickSheet(true)}>
                <IconTile name="user" tone="violet" />
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

      <Sheet open={visSheet} onClose={() => setVisSheet(false)} title="谁可以看">
        <div className="list">
          {VIS_OPTIONS.map((v) => (
            <div key={v.key} className="list-item" onClick={() => { setVisibility(v.key); setVisSheet(false); if (v.key !== 'custom' && v.key !== 'exclude') setPicked(new Set()); }}>
              <IconTile name={v.icon} tone={v.tone} />
              <div className="list-main">
                <div className="list-title">{v.label}</div>
                <div className="list-desc">{v.desc}</div>
              </div>
              {visibility === v.key ? <Icon name="check" size={18} strokeWidth={2.6} className="ok-text" /> : null}
            </div>
          ))}
        </div>
      </Sheet>

      <Sheet open={pickSheet} onClose={() => setPickSheet(false)} title={visibility === 'custom' ? '选择可见好友' : '选择不可见好友'}>
        {friends.length === 0 ? (
          <Empty icon="users" text="还没有好友" />
        ) : (
          <div className="list">
            {friends.map((f) => (
              <div key={f.id} className="list-item" onClick={() => togglePick(f.id)}>
                <Avatar user={f} size={44} />
                <div className="list-main">
                  <div className="list-title">{f.remark || f.username}</div>
                </div>
                <span style={{ width: 22, height: 22, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, border: '1.5px solid ' + (picked.has(f.id) ? 'var(--brand-2)' : 'rgba(255,255,255,.24)'), background: picked.has(f.id) ? 'var(--brand-grad)' : 'transparent' }}>{picked.has(f.id) ? <Icon name="check" size={14} strokeWidth={3} color="#fff" /> : null}</span>
              </div>
            ))}
          </div>
        )}
        <button className="btn btn-primary btn-block mt" style={{ marginTop: 12 }} onClick={() => setPickSheet(false)}>完成（{picked.size}）</button>
      </Sheet>
    </div>
  );
}
