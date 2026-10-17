import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api, ws, mediaUrl, getBase } from '../api.js';
import { useApp } from '../App.jsx';
import {
  Avatar, TopBar, Sheet, ActionSheet, toast, Spinner, MediaViewer, MediaPicker, CameraPicker, Empty,
} from '../components/ui.jsx';
import EmojiPanel, { StickerView } from '../components/EmojiPanel.jsx';
import { bubbleTime, fmtDuration, groupByInitial } from '../lib/time.js';

const RECALL_WINDOW = 3 * 60 * 1000;

export default function ChatScreen({ convType, convId, title, isOfficial }) {
  const app = useApp();
  const { me, presence, push, back, refreshConversations, openConvRef } = app;
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [panel, setPanel] = useState(null); // 'emoji' | 'plus' | null
  const [members, setMembers] = useState([]);
  const [group, setGroup] = useState(null);
  const [dnd, setDnd] = useState(false);
  const [peer, setPeer] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmAct, setConfirmAct] = useState(null); // 'delete' | 'block'
  const [viewer, setViewer] = useState(null);
  const [actionMsg, setActionMsg] = useState(null);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [onlineSheet, setOnlineSheet] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [oneTime, setOneTime] = useState(false);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const convKey = `${convType}_${convId}`;
  const isGroup = convType === 'group';
  const isOfficialGroup = isGroup && (isOfficial || group?.is_official);
  const peerId = !isGroup ? Number(String(convId).split('_').find((x) => Number(x) !== me.id)) : 0;

  /* ---------- 初始化 ---------- */
  useEffect(() => {
    openConvRef.current = convKey;
    load();
    return () => {
      openConvRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convKey]);

  const load = async () => {
    setLoading(true);
    try {
      const d = await api.get(`/api/messages?convType=${convType}&convId=${convId}&limit=80`);
      setMessages(d.messages || []);
      if (isGroup) {
        const g = await api.get(`/api/groups/${convId}`);
        setMembers(g.members || []);
        setGroup(g.group);
        setDnd(!!g.group?.dnd);
      } else {
        api.get(`/api/users/${peerId}`).then((u) => setPeer(u.user)).catch(() => {});
      }
      refreshConversations();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
      setTimeout(scrollToBottom, 60);
    }
  };

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  };

  /* ---------- 实时事件 ---------- */
  useEffect(() => {
    const offs = [];
    offs.push(
      ws.on('message', (m) => {
        if (`${m.conv_type}_${m.conv_id}` !== convKey) return;
        setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
        setTimeout(scrollToBottom, 40);
        if (m.sender_id !== me.id && !m.extra?.ai) {
          api.post(`/api/messages/${m.id}/read`, {}).catch(() => {});
        }
      }),
    );
    offs.push(
      ws.on('message:update', (m) => {
        if (`${m.conv_type}_${m.conv_id}` !== convKey) return;
        setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, ...m } : x)));
      }),
    );
    offs.push(
      ws.on('message:read', (d) => {
        if (`${d.convType}_${d.convId}` !== convKey) return;
        setMessages((list) =>
          list.map((x) => (d.counts && d.counts[x.id] != null ? { ...x, read_count: d.counts[x.id] } : x)),
        );
      }),
    );
    offs.push(
      ws.on('message:recall', (d) => {
        if (`${d.convType}_${d.convId}` !== convKey) return;
        setMessages((list) => list.map((x) => (x.id === d.id ? { ...x, recalled: true, content: '', media_url: '' } : x)));
      }),
    );
    offs.push(
      ws.on('message:burn', (d) => {
        if (`${d.convType}_${d.convId}` !== convKey) return;
        if (d.userId === me.id) setMessages((list) => list.filter((x) => x.id !== d.id));
        else setMessages((list) => list.map((x) => (x.id === d.id ? { ...x, burned: true } : x)));
      }),
    );
    offs.push(ws.on('group:members', (d) => d.groupId === Number(convId) && reloadGroup()));
    offs.push(ws.on('group:update', (d) => d.groupId === Number(convId) && reloadGroup()));
    offs.push(ws.on('group:muted', (d) => d.groupId === Number(convId) && toast(d.mute_until ? `你已被禁言 ${fmtDuration(d.mute_until - Date.now())}` : '你已被解除禁言')));
    return () => offs.forEach((o) => o());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convKey, me?.id]);

  const reloadGroup = async () => {
    try {
      const g = await api.get(`/api/groups/${convId}`);
      setMembers(g.members || []);
      setGroup(g.group);
    } catch {}
  };

  /* ---------- 发送 ---------- */
  const sendText = async (content, msgType = 'text') => {
    const body = String(content || '').trim();
    if (!body) return;
    try {
      const d = await api.post('/api/messages', { convType, convId, msg_type: msgType, content: body });
      setMessages((list) => (list.some((x) => x.id === d.message.id) ? list : [...list, d.message]));
      setText('');
      setTimeout(scrollToBottom, 40);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const pickFiles = (files) => {
    setPendingFiles(files.map((f) => ({ file: f, url: URL.createObjectURL(f), type: f.type?.startsWith('video') ? 'video' : 'image' })));
    setOneTime(false);
    setPanel('confirm');
  };

  const doSendMedia = async () => {
    if (!pendingFiles.length) return;
    setSending(true);
    setPanel(null);
    try {
      for (const item of pendingFiles) {
        const up = await api.upload(item.file, item.type);
        const d = await api.post('/api/messages', {
          convType, convId, msg_type: up.kind === 'video' ? 'video' : 'image',
          media_url: up.url, media_thumb: '', one_time: oneTime,
        });
        setMessages((list) => (list.some((x) => x.id === d.message.id) ? list : [...list, d.message]));
      }
      setTimeout(scrollToBottom, 60);
      toast(oneTime ? '一次性消息已发送（对方查看后自动销毁）' : '发送成功');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSending(false);
      setPendingFiles([]);
      setOneTime(false);
    }
  };

  const onInputChange = (e) => {
    const v = e.target.value;
    setText(v);
    if (isOfficialGroup && /(^|\s)@$/.test(v)) setMentionOpen(true);
    else setMentionOpen(false);
    ws.typing(convType, convId);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
  };

  const insertMention = () => {
    setText((t) => t.replace(/(^|\s)@$/, (m, p) => `${p}@Jay AI `));
    setMentionOpen(false);
  };

  /* ---------- 撤回 / 复制 / 删除（本地） ---------- */
  const canRecall = (m) => m.sender_id === me.id && !m.recalled && Date.now() - m.created_at <= RECALL_WINDOW;

  const doRecall = async (m) => {
    try {
      await api.post(`/api/messages/${m.id}/recall`, {});
      setMessages((list) => list.map((x) => (x.id === m.id ? { ...x, recalled: true, content: '', media_url: '' } : x)));
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const doDeleteFriend = async () => {
    try {
      await api.del(`/api/friends/${peerId}`);
      toast('已删除好友');
      refreshConversations();
      back();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const doBlockPeer = async () => {
    try {
      await api.post('/api/friends/block', { userId: peerId });
      toast('已拉黑该用户');
      refreshConversations();
      back();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const doDeleteLocal = (m) => setMessages((list) => list.filter((x) => x.id !== m.id));
  const doCopy = async (m) => {
    try {
      await navigator.clipboard.writeText(m.content);
      toast('已复制');
    } catch {
      toast('复制失败', 'error');
    }
  };

  const onlineMembers = useMemo(() => {
    if (!isGroup) return [];
    return members.filter((m) => presence[m.id] ?? m.online);
  }, [members, presence, isGroup]);

  const onlineCount = onlineMembers.length;
  const headerSub = isGroup
    ? `${onlineCount} 人在线 · ${members.length} 人`
    : presence[peerId] ?? members[0]?.online
      ? '在线'
      : '离线';

  const readLabel = (m) => {
    if (m.sender_id !== me.id) return null;
    if (isGroup) {
      const n = Math.max(0, (m.read_count || 1) - 1);
      return n >= 1 ? { text: `${n}人已读`, read: true } : { text: '未读', read: false };
    }
    return (m.read_count || 1) >= 2 ? { text: '已读', read: true } : { text: '未读', read: false };
  };

  /* ---------- 渲染单条消息 ---------- */
  const renderMessage = (m) => {
    const mine = m.sender_id === me.id;
    const isAI = m.sender_id === 0 || m.extra?.ai;
    const senderName = isAI ? 'Jay AI' : m.sender?.username || '用户';
    const sticker = m.msg_type === 'sticker' ? m.content : null;
    const rl = readLabel(m);

    return (
      <div key={m.id} className={'msg-row' + (mine ? ' mine' : '')}>
        {!mine ? (
          <Avatar
            user={isAI ? { id: 'ai', username: 'Jay AI', avatar: '' } : m.sender}
            name={senderName}
            size={38}
            showOnline={!isAI}
            onClick={!isAI && m.sender?.id ? () => app.openUser(m.sender) : undefined}
          />
        ) : null}
        <div style={{ maxWidth: '78%', minWidth: 0 }}>
          {isGroup && !mine ? (
            <div className="sender-name" style={isAI ? { color: 'var(--ai)', fontWeight: 700 } : undefined}>
              {isAI ? '🤖 Jay AI' : senderName}
            </div>
          ) : null}
          <div
            className={'bubble' + (isAI ? ' bubble-ai' : '') + (m.recalled ? ' recalled' : '')}
            onContextMenu={(e) => {
              e.preventDefault();
              if (m.recalled) return;
              setActionMsg(m);
            }}
            onClick={() => {
              if (m.msg_type === 'image' || m.msg_type === 'video') {
                if (m.one_time && !mine && !m.burned) return;
                setViewer({ url: m.media_url, type: m.msg_type, messageId: m.id });
              }
            }}
            onTouchStart={(e) => {
              if (m.recalled) return;
              const t = setTimeout(() => setActionMsg(m), 480);
              e.currentTarget._lp = t;
            }}
            onTouchEnd={(e) => clearTimeout(e.currentTarget._lp)}
            onTouchMove={(e) => clearTimeout(e.currentTarget._lp)}
          >
            {m.recalled ? (
              <span>该消息已撤回</span>
            ) : m.burned ? (
              <span className="dim">🔥 已销毁</span>
            ) : m.msg_type === 'image' || m.msg_type === 'video' ? (
              <div className="bubble-media">
                {m.one_time && !mine ? (
                  <div
                    className="one-time-overlay"
                    style={{ position: 'relative', height: 150, width: 190, background: 'rgba(255,176,32,.08)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewer({ url: m.media_url, type: m.msg_type, messageId: m.id, oneTime: true });
                    }}
                  >
                    <div style={{ fontSize: 30 }}>🔥</div>
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>一次性消息，点击查看</div>
                  </div>
                ) : m.msg_type === 'video' ? (
                  <video src={mediaUrl(m.media_url)} controls playsInline preload="metadata" />
                ) : (
                  <img src={mediaUrl(m.media_url)} alt="" loading="lazy" />
                )}
              </div>
            ) : sticker ? (
              <StickerView text={sticker} />
            ) : (
              <span>{m.content}</span>
            )}
            <div className="bubble-meta">
              {m.one_time && !m.recalled ? <span className="one-time-tag">🔥 一次性</span> : null}
              <span className="mono-num">{bubbleTime(m.created_at)}</span>
              {rl ? <span className={'talk-badge ' + (rl.read ? 'read' : 'unread')}>{rl.text}</span> : null}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="page" style={{ height: '100%' }}>
      <TopBar
        title={
          <>
            <span className="ellipsis" style={{ maxWidth: 180 }}>{title}</span>
            {group?.is_official ? <span className="badge-soft">官方</span> : null}
          </>
        }
        sub={loading ? '加载中…' : headerSub}
        onBack={back}
        right={
          <div className="flex gap8">
            {isGroup ? (
              <button className="icon-btn" onClick={() => setOnlineSheet(true)} style={{ width: 'auto', padding: '0 10px', fontSize: 12.5, fontWeight: 700 }} aria-label="在线">
                <span className="tag-online"><i />{onlineCount} 在线</span>
              </button>
            ) : null}
            <button
              className="icon-btn"
              onClick={() => (isGroup ? push('groupInfo', { groupId: Number(convId) }) : setMenuOpen(true))}
              aria-label="更多"
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none">
                <path d="M5 7h14M5 12h14M5 17h14" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        }
      />

      <div className="chat-scroll" ref={scrollRef}>
        {loading ? (
          <div className="empty"><Spinner size={22} /></div>
        ) : messages.length === 0 ? (
          <Empty icon="👋" text="还没有消息，打个招呼吧" />
        ) : (
          messages.map(renderMessage)
        )}
      </div>

      <div className="chat-input-wrap">
        <button className="icon-btn" onClick={() => setPanel(panel === 'emoji' ? null : 'emoji')} aria-label="表情">
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="9" cy="10" r="1.2" fill="currentColor" />
            <circle cx="15" cy="10" r="1.2" fill="currentColor" />
            <path d="M8.4 14.4c.9 1.3 2.1 2 3.6 2s2.7-.7 3.6-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <textarea
          className="chat-input"
          rows={1}
          placeholder={group?.is_official ? '说点什么… 输入 @ 呼叫 Jay AI' : '说点什么…'}
          value={text}
          onChange={onInputChange}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !mentionOpen) {
              e.preventDefault();
              sendText(text);
            }
          }}
        />
        <button className="icon-btn" onClick={() => setPanel(panel === 'plus' ? null : 'plus')} aria-label="更多">
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
          </svg>
        </button>
        <button className="btn btn-primary" style={{ padding: '11px 16px' }} onClick={() => sendText(text)} disabled={!text.trim()}>
          发送
        </button>
      </div>

      {mentionOpen ? (
        <div style={{ padding: '0 12px 10px' }}>
          <div className="glass pad" style={{ padding: 8 }}>
            <div className="menu-item" style={{ border: 'none', padding: '10px 8px' }} onClick={insertMention}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <span style={{ color: 'var(--ai)', fontWeight: 700 }}>Jay AI</span>
              <span className="chev" style={{ marginLeft: 'auto' }}>智能机器人</span>
            </div>
          </div>
        </div>
      ) : null}

      {/* 表情面板 */}
      <Sheet open={panel === 'emoji'} onClose={() => setPanel(null)}>
        <EmojiPanel
          onEmoji={(e) => setText((t) => t + e)}
          onSticker={(code) => {
            setPanel(null);
            sendText(code, 'sticker');
          }}
        />
      </Sheet>

      {/* + 面板 */}
      <Sheet open={panel === 'plus'} onClose={() => setPanel(null)} title="发送内容">
        <div className="grid2" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <MediaPicker onPick={pickFiles} accept="image/*">
            <div className="glass pad press-scale" style={{ textAlign: 'center', borderRadius: 16 }}>
              <div style={{ fontSize: 26 }}>🖼️</div>
              <div className="hint" style={{ marginTop: 6 }}>相册图片</div>
            </div>
          </MediaPicker>
          <MediaPicker onPick={pickFiles} accept="video/*">
            <div className="glass pad press-scale" style={{ textAlign: 'center', borderRadius: 16 }}>
              <div style={{ fontSize: 26 }}>🎬</div>
              <div className="hint" style={{ marginTop: 6 }}>相册视频</div>
            </div>
          </MediaPicker>
          <CameraPicker onPick={pickFiles} kind="image">
            <div className="glass pad press-scale" style={{ textAlign: 'center', borderRadius: 16 }}>
              <div style={{ fontSize: 26 }}>📷</div>
              <div className="hint" style={{ marginTop: 6 }}>拍摄照片</div>
            </div>
          </CameraPicker>
          <CameraPicker onPick={pickFiles} kind="video">
            <div className="glass pad press-scale" style={{ textAlign: 'center', borderRadius: 16 }}>
              <div style={{ fontSize: 26 }}>📹</div>
              <div className="hint" style={{ marginTop: 6 }}>拍摄视频</div>
            </div>
          </CameraPicker>
        </div>
      </Sheet>

      {/* 媒体确认 + 一次性 */}
      <Sheet open={panel === 'confirm'} onClose={() => setPanel(null)} title="发送预览">
        <div className="grid2" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {pendingFiles.map((p, i) => (
            <div key={i} className="pick-tile">
              {p.type === 'video' ? <video src={p.url} muted /> : <img src={p.url} alt="" />}
              <span className="x" onClick={() => setPendingFiles((l) => l.filter((_, k) => k !== i))}>×</span>
            </div>
          ))}
          <MediaPicker onPick={pickFiles} accept="image/*,video/*">
            <div className="add-tile">+</div>
          </MediaPicker>
        </div>
        <div className="glass pad mt" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>🔥 一次性查看</div>
            <div className="hint">勾选后对方只能查看一次，查看完在对方侧自动销毁（你这边保留）</div>
          </div>
          <div className={'switch' + (oneTime ? ' on' : '')} onClick={() => setOneTime((v) => !v)}><i /></div>
        </div>
        <button className="btn btn-primary btn-block mt" style={{ marginTop: 14 }} disabled={sending || !pendingFiles.length} onClick={doSendMedia}>
          {sending ? <Spinner size={18} /> : '发送'}
        </button>
      </Sheet>

      {/* 在线成员 */}
      <Sheet open={onlineSheet} onClose={() => setOnlineSheet(false)} title={`在线成员（${onlineCount}）`}>
        {onlineMembers.length === 0 ? (
          <Empty icon="🌙" text="当前没有人在线" />
        ) : (
          <div className="list">
            {onlineMembers.map((m) => (
              <div key={m.id} className="list-item" onClick={() => app.openUser({ ...m, online: true })}>
                <Avatar user={m} size={44} online />
                <div className="list-main">
                  <div className="list-title">{m.remark || m.username}</div>
                  <div className="list-desc">{m.role === 'owner' ? '群主' : m.role === 'admin' ? '管理员' : '成员'}</div>
                </div>
                <span className="tag-online"><i />在线</span>
              </div>
            ))}
          </div>
        )}
      </Sheet>

      {/* 私聊右上角菜单：查看资料 / 删除好友 / 拉黑 */}
      {!isGroup ? (
        <ActionSheet
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          title={peer?.remark || peer?.username || title}
          actions={[
            { icon: '🧑', label: '查看资料', onClick: () => push('friendInfo', { userId: peerId }) },
            peer?.is_friend === false
              ? { icon: '➕', label: '加为好友', onClick: () => push('friendInfo', { userId: peerId }) }
              : { icon: '🗑️', label: '删除好友', danger: true, onClick: () => setConfirmAct('delete') },
            { icon: '🚫', label: '拉黑', danger: true, onClick: () => setConfirmAct('block') },
          ]}
        />
      ) : null}

      <ActionSheet
        open={!!confirmAct}
        onClose={() => setConfirmAct(null)}
        title={
          confirmAct === 'block'
            ? `拉黑「${peer?.username || title}」？拉黑后将解除好友关系，双方互相收不到消息`
            : `删除好友「${peer?.username || title}」？`
        }
        actions={[
          {
            icon: confirmAct === 'block' ? '🚫' : '🗑️',
            label: confirmAct === 'block' ? '确定拉黑' : '删除好友',
            danger: true,
            onClick: confirmAct === 'block' ? doBlockPeer : doDeleteFriend,
          },
        ]}
      />

      {/* 消息操作 */}
      <ActionSheet
        open={!!actionMsg}
        onClose={() => setActionMsg(null)}
        title={actionMsg?.msg_type === 'text' || actionMsg?.msg_type === 'sticker' ? '消息操作' : '媒体操作'}
        actions={
          actionMsg
            ? [
                ...(canRecall(actionMsg) ? [{ icon: '↩️', label: '撤回（3 分钟内）', onClick: () => doRecall(actionMsg) }] : []),
                ...((actionMsg.msg_type === 'text' || actionMsg.msg_type === 'sticker') && !actionMsg.recalled
                  ? [{ icon: '📋', label: '复制', onClick: () => doCopy(actionMsg) }]
                  : []),
                { icon: '🗑️', label: '删除', danger: true, onClick: () => doDeleteLocal(actionMsg) },
              ]
            : []
        }
      />

      {/* 媒体查看 */}
      {viewer ? (
        <MediaViewer
          item={{ url: viewer.url, type: viewer.type }}
          oneTimeView={!!viewer.oneTime}
          onBurn={async () => {
            try {
              await api.post(`/api/messages/${viewer.messageId}/burn`, {});
            } catch {}
            setMessages((list) => list.filter((x) => x.id !== viewer.messageId));
          }}
          onClose={() => setViewer(null)}
        />
      ) : null}
    </div>
  );
}
