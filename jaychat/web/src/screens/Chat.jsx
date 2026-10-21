import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api, ws, mediaUrl, getBase } from '../api.js';
import { useApp } from '../App.jsx';
import {
  Avatar, TopBar, Sheet, ActionSheet, toast, Spinner, MediaViewer, MediaPicker, CameraPicker, Empty, VideoPlayer,
} from '../components/ui.jsx';
import EmojiPanel, { StickerView } from '../components/EmojiPanel.jsx';
import { Icon, IconTile } from '../components/icons.jsx';
import { bubbleTime, fmtDuration, groupByInitial } from '../lib/time.js';
import { isVideoFile } from '../lib/media.js';

const RECALL_WINDOW = 3 * 60 * 1000;

/** 消息内容是否在呼叫 Jay AI（支持管理员自定义的 AI 名称） */
function mentionsAi(text, aiName) {
  const s = String(text || '');
  if (/@\s*jay\s*ai/i.test(s)) return true;
  return !!aiName && s.includes('@' + aiName);
}

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
  const [replyMsg, setReplyMsg] = useState(null);
  const [relatedSticker, setRelatedSticker] = useState(null); // {open, loading, keyword, items}
  const [favUrls, setFavUrls] = useState(() => new Set());
  const [mq, setMq] = useState(''); // @ 面板搜索词
  const [aiName, setAiName] = useState('Jay AI');
  const [aiAvatar, setAiAvatar] = useState('');
  // 本机发出的 @AI 提问：先本地插入「正在思考」，避免等轮询（3 秒）才看到反馈
  const [aiPending, setAiPending] = useState(null);
  const aiPendingTimer = useRef(null);
  const [onlineSheet, setOnlineSheet] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [oneTime, setOneTime] = useState(false);
  const [oneTimeSec, setOneTimeSec] = useState('5');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef(null);
  const textRef = useRef('');
  const inputRef = useRef(null);
  const rowRefs = useRef({});
  const convKey = `${convType}_${convId}`;
  const isGroup = convType === 'group';
  const isOfficialGroup = isGroup && (isOfficial || group?.is_official);
  const dissolved = isGroup && !!group?.dissolved; // 群已解散：只读，隐藏输入框
  const peerId = !isGroup ? Number(String(convId).split('_').find((x) => Number(x) !== me.id)) : 0;

  /* ---------- 初始化 ---------- */
  useEffect(() => {
    openConvRef.current = convKey;
    load();
    return () => {
      openConvRef.current = null;
      // 离开会话时把最新消息全部标记已读，避免返回首页仍残留红点
      api
        .get(`/api/messages?convType=${convType}&convId=${convId}&limit=200`)
        .then(() => refreshConversations())
        .catch(() => {});
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

  /* ---------- 我的添加（表情收藏） ---------- */
  const loadStickerFavs = async () => {
    try {
      const d = await api.get('/api/stickers/favs');
      setFavUrls(new Set((d.items || []).map((f) => f.url)));
    } catch {}
  };
  useEffect(() => {
    loadStickerFavs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- 群聊：读取 AI 展示名称/头像（管理员可自定义） ---------- */
  useEffect(() => {
    if (!isGroup) return;
    api.get('/api/ai/profile')
      .then((d) => {
        if (d?.profile?.name) setAiName(d.profile.name);
        setAiAvatar(d?.profile?.avatar || '');
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGroup]);

  /* ---------- 输入框文本镜像（供长按 @ 去重判断） ---------- */
  useEffect(() => {
    textRef.current = text;
  }, [text]);

  /** 文本中是否已 @ 过该用户名 */
  const mentionExists = (t, nm) => {
    const name = String(nm || '').trim();
    if (!name) return false;
    const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      return new RegExp('@' + esc + '(?![\\p{L}\\p{N}_])', 'u').test(String(t || ''));
    } catch {
      return String(t || '').includes('@' + name);
    }
  };

  /** 把结尾的「@搜索词」替换为 @用户名（无 @ 时直接追加） */
  const replaceTrailingMention = (t, nm) => {
    const mm = /(^|\s)@([^\s@]*)$/.exec(String(t || ''));
    if (!mm) return t ? `${t}@${nm} ` : `@${nm} `;
    return t.slice(0, mm.index) + mm[1] + `@${nm} `;
  };

  /** @ 面板：选中某人 */
  const chooseMention = (nm) => {
    if (!nm) return;
    setText((t) => replaceTrailingMention(t, nm));
    setMq('');
    requestAnimationFrame(() => inputRef.current?.focus?.());
  };

  /** 长按头像/右键头像：群聊中自动 @ 对方（已 @ 过则提示，不重复插入） */
  const avatarMentionHandlers = (user, enabled) => {
    if (!enabled) return {};
    const fire = (e) => {
      e?.preventDefault?.();
      const nm = user?.username;
      if (!nm) return;
      if (mentionExists(textRef.current, nm)) {
        toast(`你已@${nm}`);
        return;
      }
      setText((t) => replaceTrailingMention(t, nm));
    };
    return {
      onContextMenu: fire,
      onTouchStart: (e) => {
        e.currentTarget._atTimer = setTimeout(() => fire(), 480);
      },
      onTouchEnd: (e) => clearTimeout(e.currentTarget._atTimer),
      onTouchMove: (e) => clearTimeout(e.currentTarget._atTimer),
    };
  };

  /* ---------- @ 面板：AI 置顶 + 成员按 A→# 排序 + 搜索 ---------- */
  const mentionMatch = isGroup ? /(^|\s)@([^\s@]*)$/.exec(text) : null;
  const mentionOpen = !!mentionMatch;
  const mentionQuery = mentionMatch ? mentionMatch[2] : '';
  useEffect(() => {
    setMq(mentionOpen ? mentionQuery : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mentionOpen, mentionQuery]);

  const mentionGroups = useMemo(() => {
    if (!mentionOpen) return [];
    const q = mq.trim().toLowerCase();
    const hit = (n) => !q || String(n || '').toLowerCase().includes(q);
    const out = [];
    if (hit(aiName)) {
      out.push({ letter: 'AI', items: [{ id: 0, name: aiName, username: aiName, avatar: aiAvatar, isAi: true }] });
    }
    const list = (members || []).filter((m) => Number(m.id) !== Number(me?.id));
    groupByInitial(list, (x) => x.remark || x.username).forEach((g) => {
      const items = g.items
        .filter((m) => hit(m.remark || m.username))
        .map((m) => ({ id: m.id, name: m.remark || m.username, username: m.username, avatar: m.avatar, isAi: false }));
      if (items.length) out.push({ letter: g.letter, items });
    });
    return out;
  }, [mentionOpen, mq, members, me?.id, aiName, aiAvatar]);

  /* ---------- 「有人@我」：定位未在底部的 @ 消息 ---------- */
  const mentionMe = (m) => {
    if (!isGroup || !m || m.recalled || m.msg_type !== 'text' || m.sender_id === me.id) return false;
    const nm = String(me?.username || '').trim();
    if (!nm) return false;
    const esc = nm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      return new RegExp('@' + esc + '(?![\\p{L}\\p{N}_])', 'u').test(String(m.content || ''));
    } catch {
      return String(m.content || '').includes('@' + nm);
    }
  };
  const lastMentionId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (mentionMe(messages[i])) return messages[i].id;
    }
    return 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isGroup, me?.username]);
  /* 「有人@我」按钮的已处理标记：按会话持久化到本地。
     点击后即使离开再进入也不再显示，直到对方再次 @ 我（新消息 id 更大）才重新出现。 */
  const mentionAckKey = `jc_mention_ack_${convKey}`;
  const readMentionAck = () => {
    try {
      return Number(localStorage.getItem(mentionAckKey)) || 0;
    } catch {
      return 0;
    }
  };
  const [mentionAck, setMentionAck] = useState(readMentionAck);
  useEffect(() => {
    setMentionAck(readMentionAck());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convKey]);
  const lastMsgId = messages.length ? messages[messages.length - 1].id : 0;
  const showMentionBtn = !!lastMentionId && lastMentionId !== lastMsgId && lastMentionId > mentionAck;
  const scrollToMention = () => {
    const el = rowRefs.current[lastMentionId];
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    setMentionAck(lastMentionId);
    try {
      localStorage.setItem(mentionAckKey, String(lastMentionId));
    } catch {}
  };

  /** 消息预览文案（用于引用条 / 引用块） */
  const previewText = (m) => {
    if (!m) return '';
    if (m.recalled) return '该消息已撤回';
    if (m.msg_type === 'image') return '[图片]';
    if (m.msg_type === 'video') return '[视频]';
    if (m.msg_type === 'sticker') return '[动画表情]';
    return m.content || '';
  };
  const senderNameOf = (m) => (m?.sender_id === 0 ? m?.sender?.username || 'AI' : m?.sender?.username || '用户');

  /** 添加表情到「我的添加」 */
  const addStickerFav = async (url, label) => {
    try {
      const d = await api.post('/api/stickers/favs', { url, label: label || '' });
      setFavUrls(new Set((d.items || []).map((f) => f.url)));
      toast('已添加到「我的添加」');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  /** 打开相关表情 */
  const openRelated = async (url, label) => {
    setRelatedSticker({ open: true, loading: true, keyword: label || '', items: [] });
    try {
      const d = await api.get(`/api/stickers/related?url=${encodeURIComponent(url || '')}&label=${encodeURIComponent(label || '')}`);
      setRelatedSticker({ open: true, loading: false, keyword: d.keyword || '', items: d.items || [] });
    } catch (e) {
      setRelatedSticker({ open: true, loading: false, keyword: '', items: [] });
      toast(e.message, 'error');
    }
  };

  /** 删除已解散的群聊会话（不再显示在首页） */
  const deleteChat = async () => {
    try {
      await api.post(`/api/groups/${convId}/delete-chat`, {});
      toast('已删除群聊');
      await refreshConversations();
      back();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  /* ---------- @AI「正在思考」本地占位 ---------- */
  const clearAiPending = () => {
    if (aiPendingTimer.current) {
      clearTimeout(aiPendingTimer.current);
      aiPendingTimer.current = null;
    }
    setAiPending(null);
  };

  const startAiPending = (askerName) => {
    if (aiPendingTimer.current) clearTimeout(aiPendingTimer.current);
    setAiPending({
      id: `local-ai-${Date.now()}`,
      conv_type: convType,
      conv_id: String(convId),
      sender_id: 0,
      sender: { id: 0, username: aiName, avatar: aiAvatar },
      msg_type: 'text',
      content: `@${askerName} ${aiName} 正在思考中…`,
      extra: { ai: true, pending: true },
      created_at: Date.now(),
    });
    setTimeout(scrollToBottom, 60);
    // 兜底：90 秒后仍未拿到回复则收起占位
    aiPendingTimer.current = setTimeout(() => setAiPending(null), 90000);
  };

  /* ---------- 实时事件 ---------- */
  useEffect(() => {
    const offs = [];
    offs.push(
      ws.on('message', (m) => {
        if (`${m.conv_type}_${m.conv_id}` !== convKey) return;
        if (m.sender_id === 0 && m.extra?.pending) {
          // 服务端刚插入「思考中」占位：保留本地气泡不动，避免两个气泡来回替换闪烁
          setTimeout(scrollToBottom, 40);
          return;
        }
        setMessages((list) => (list.some((x) => x.id === m.id) ? list : [...list, m]));
        // AI 正式回复到达 → 在同一帧替换本地「正在思考」气泡
        if (m.sender_id === 0) clearAiPending();
        setTimeout(scrollToBottom, 40);
        // 我正停留在该会话页面，对方此时 @ 我：直接记为已处理，
        // 避免我随后发言（使 @ 消息不再是最后一条）后又弹出「有人@我」按钮
        if (mentionMe(m)) {
          setMentionAck(m.id);
          try {
            localStorage.setItem(mentionAckKey, String(m.id));
          } catch {}
        }
        if (m.sender_id !== me.id) {
          // 正在会话内查看：立即标记已读并刷新会话列表，避免返回首页仍显示红点
          api.post(`/api/messages/${m.id}/read`, {}).then(() => refreshConversations()).catch(() => {});
        }
      }),
    );
    offs.push(
      ws.on('message:update', (m) => {
        if (`${m.conv_type}_${m.conv_id}` !== convKey) return;
        if (m.sender_id === 0) {
          // 仍是服务端思考占位 → 忽略，继续用本地气泡，避免闪烁
          if (m.extra?.pending) return;
          // 思考占位被更新为正式回复：同一次渲染里移除本地气泡并插入回复
          clearAiPending();
          setMessages((list) => (list.some((x) => x.id === m.id)
            ? list.map((x) => (x.id === m.id ? { ...x, ...m } : x))
            : [...list, m]));
          setTimeout(scrollToBottom, 40);
          return;
        }
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
    offs.push(ws.on('group:dissolved', (d) => {
      if (d.groupId !== Number(convId)) return;
      toast('该群聊已被群主解散');
      reloadGroup();
    }));
    offs.push(ws.on('group:muted', (d) => d.groupId === Number(convId) && toast(d.mute_until ? `你已被禁言 ${fmtDuration(d.mute_until - Date.now())}` : '你已被解除禁言')));
    return () => {
      offs.forEach((o) => o());
      if (aiPendingTimer.current) clearTimeout(aiPendingTimer.current);
    };
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
  const sendText = async (content, msgType = 'text', reply = replyMsg) => {
    let body = String(content || '').trim();
    if (!body) return;
    // 群聊中回复引用他人消息时，自动 @ 对方（与微信/QQ 群回复一致）
    if (isGroup && reply && msgType === 'text' && reply.sender_id !== me.id) {
      const nm = reply.sender?.username;
      if (nm && !body.startsWith(`@${nm}`)) body = `@${nm} ${body}`;
    }
    try {
      const payload = { convType, convId, msg_type: msgType, content: body };
      if (reply?.id) payload.reply_to = reply.id;
      const d = await api.post('/api/messages', payload);
      setMessages((list) => (list.some((x) => x.id === d.message.id) ? list : [...list, d.message]));
      setText('');
      setReplyMsg(null);
      setTimeout(scrollToBottom, 40);
      // 群里 @ Jay AI 提问：立即本地显示「正在思考」，再异步触发机器人回复
      if (isGroup && msgType === 'text' && mentionsAi(body, aiName)) {
        startAiPending(me.username);
        api
          .post('/api/ai/ask', { groupId: Number(convId), question: body }, { timeout: 120000 })
          .catch(() => {
            clearAiPending();
            toast('AI 暂时没有回应，请稍后再试', 'error');
          });
      }
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  /** 发送表情（EmojiPanel 回调：url 直发 / blob 先上传） */
  const sendSticker = async ({ url, blob, label }) => {
    const reply = replyMsg;
    setPanel(null);
    try {
      let finalUrl = url;
      if (blob) {
        const up = await api.upload(new File([blob], 'sticker.png', { type: 'image/png' }), 'image');
        finalUrl = up.url;
      }
      if (!finalUrl) return;
      const payload = { convType, convId, msg_type: 'sticker', content: label || '', media_url: finalUrl };
      if (reply?.id) payload.reply_to = reply.id;
      const d = await api.post('/api/messages', payload);
      setMessages((list) => (list.some((x) => x.id === d.message.id) ? list : [...list, d.message]));
      setReplyMsg(null);
      setTimeout(scrollToBottom, 40);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const MAX_MEDIA_BYTES = 10 * 1024 * 1024;

  const pickFiles = (files) => {
    const list = Array.from(files || []);
    const ok = list.filter((f) => f.size <= MAX_MEDIA_BYTES);
    if (ok.length < list.length) {
      toast('文件超过 10MB：免费主机上传后会无法保存/播放，请先压缩再发送', 'error');
    }
    if (!ok.length) return;
    setPendingFiles(ok.map((f) => ({ file: f, url: URL.createObjectURL(f), type: isVideoFile(f) ? 'video' : 'image' })));
    setOneTime(false);
    setOneTimeSec('5');
    setPanel('confirm');
  };

  const doSendMedia = async () => {
    if (!pendingFiles.length) return;
    const burnSec = Math.min(Math.max(Number(oneTimeSec) || 5, 1), 300);
    setSending(true);
    setPanel(null);
    try {
      for (const item of pendingFiles) {
        const up = await api.upload(item.file, item.type);
        const d = await api.post('/api/messages', {
          convType, convId, msg_type: up.kind === 'video' ? 'video' : 'image',
          media_url: up.url, media_thumb: '', one_time: oneTime, burn_sec: burnSec,
        });
        setMessages((list) => (list.some((x) => x.id === d.message.id) ? list : [...list, d.message]));
      }
      setTimeout(scrollToBottom, 60);
      toast(oneTime ? `一次性消息已发送（对方查看后 ${burnSec} 秒自动销毁）` : '发送成功');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSending(false);
      setPendingFiles([]);
      setOneTime(false);
    }
  };

  /* ---------- @提及整体删除（像微信/QQ：先删空格，再整段删 @xxx） ---------- */
  const mentionTokens = useMemo(() => {
    const names = [aiName, ...(members || []).map((m) => m.username)].filter(Boolean);
    // 长名优先，避免「@ab」误匹配到「@abc」里的前缀
    return Array.from(new Set(names)).sort((a, b) => b.length - a.length);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiName, members]);

  /** 退格键：命中 @提及 时整体处理，返回是否已消费本次按键 */
  const handleMentionBackspace = (e) => {
    if (e.key !== 'Backspace') return false;
    const el = e.target;
    const pos = el.selectionStart;
    // 无选区、光标不在开头才处理；有选区时交给默认行为（删除选中内容）
    if (pos == null || pos !== el.selectionEnd || pos === 0) return false;
    const val = el.value;
    const before = val.slice(0, pos);
    // 1) 光标紧跟「@xxx + 空格」：先只删掉这个空格
    if (before.endsWith(' ')) {
      const head = before.slice(0, -1);
      if (mentionTokens.some((nm) => head.endsWith('@' + nm))) {
        e.preventDefault();
        setText(val.slice(0, pos - 1) + val.slice(pos));
        requestAnimationFrame(() => {
          el.selectionStart = el.selectionEnd = pos - 1;
        });
        return true;
      }
    }
    // 2) 光标紧跟「@xxx」：整段删除
    const hit = mentionTokens.find((nm) => before.endsWith('@' + nm));
    if (hit) {
      e.preventDefault();
      const start = pos - hit.length - 1;
      setText(val.slice(0, start) + val.slice(pos));
      requestAnimationFrame(() => {
        el.selectionStart = el.selectionEnd = start;
      });
      return true;
    }
    return false;
  };

  const onInputChange = (e) => {
    const v = e.target.value;
    setText(v);
    ws.typing(convType, convId);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
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
    const senderName = isAI ? m.sender?.username || 'Jay AI' : m.sender?.username || '用户';
    const sticker = m.msg_type === 'sticker' ? m.content : null;
    const quote = m.extra?.reply || null;
    const rl = readLabel(m);
    const canAt = isGroup && !mine && !!senderName;
    // 图片 / 视频 / 动画表情：不用气泡包裹（与微信一致，消息本体直接展示）
    const isMedia = m.msg_type === 'image' || m.msg_type === 'video' || m.msg_type === 'sticker';
    const plain = isMedia && !quote && !m.recalled && !m.burned;
    const bubbleClass =
      'bubble' + (isAI ? ' bubble-ai' : '') + (plain ? ' plain' : '') + (m.recalled ? ' recalled' : '');

    return (
      <div
        key={m.id}
        ref={(el) => {
          if (el) rowRefs.current[m.id] = el;
        }}
        className={'msg-row' + (mine ? ' mine' : '')}
      >
        <span
          className={canAt ? 'avatar-at' : undefined}
          title={canAt ? '长按可 @ 对方' : undefined}
          {...avatarMentionHandlers({ username: senderName, id: m.sender?.id }, canAt)}
        >
          <Avatar
            user={mine ? me : isAI ? { id: 0, username: senderName, avatar: m.sender?.avatar || '' } : m.sender}
            name={mine ? me.username : senderName}
            size={38}
            showOnline={!mine && !isAI}
            onClick={!mine && !isAI && m.sender?.id ? () => app.openUser(m.sender) : undefined}
          />
        </span>
        <div className="msg-body">
          {isGroup && !mine ? (
            <div className="sender-name" style={isAI ? { color: 'var(--ai)', fontWeight: 700 } : undefined}>
              {isAI ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <Icon name="robot" size={14} strokeWidth={1.9} /> {senderName}
                </span>
              ) : senderName}
            </div>
          ) : null}
          <div
            className={bubbleClass}
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
            {quote && !m.recalled ? (
              <div className="quote" onClick={(e) => e.stopPropagation()}>
                <span className="quote-name">{quote.name}</span>
                <span className="quote-text">{quote.text}</span>
              </div>
            ) : null}
            {m.recalled ? (
              <span>该消息已撤回</span>
            ) : m.burned ? (
              <span className="dim" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Icon name="flame" size={14} filled color="#ffb020" /> 已销毁
              </span>
            ) : m.msg_type === 'image' || m.msg_type === 'video' ? (
              <div className="bubble-media">
                {m.one_time && !mine ? (
                  <div
                    className="one-time-overlay"
                    style={{ position: 'relative', height: 150, width: 190, background: 'rgba(255,176,32,.08)' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setViewer({ url: m.media_url, type: m.msg_type, messageId: m.id, oneTime: true, burnSec: m.burn_sec });
                    }}
                  >
                    <Icon name="flame" size={32} filled color="#ff9d2e" />
                    <div style={{ fontSize: 12.5, fontWeight: 700 }}>一次性消息，点击查看</div>
                  </div>
                ) : m.msg_type === 'video' ? (
                  <VideoPlayer src={mediaUrl(m.media_url)} />
                ) : (
                  <img src={mediaUrl(m.media_url)} alt="" loading="lazy" />
                )}
              </div>
            ) : m.msg_type === 'sticker' && m.media_url ? (
              <img className="bubble-sticker" src={mediaUrl(m.media_url)} alt="" loading="lazy" />
            ) : sticker ? (
              <StickerView text={sticker} />
            ) : m.extra?.pending && Date.now() - m.created_at > 60000 ? (
              // 服务端占位消息长时间未更新（例如接口超时）→ 不再一直显示「正在思考」
              <span className="dim">{senderName} 暂时没有回应，请稍后再试</span>
            ) : (
              <span>{m.content}</span>
            )}
          </div>
          <div className="bubble-meta">
            {m.one_time && !m.recalled ? (
              <span className="one-time-tag" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Icon name="flame" size={11} filled /> 一次性
              </span>
            ) : null}
            <span className="mono-num">{bubbleTime(m.created_at)}</span>
            {rl ? <span className={'talk-badge ' + (rl.read ? 'read' : 'unread')}>{rl.text}</span> : null}
          </div>
        </div>
      </div>
    );
  };

  /* 本地「AI 正在思考」占位：思考期间隐藏服务端占位，只保留一个稳定的本地气泡 */
  const renderList = useMemo(() => {
    if (!aiPending) return messages;
    return [...messages.filter((m) => !m.extra?.pending), aiPending];
  }, [messages, aiPending]);

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
        ) : renderList.length === 0 ? (
          <Empty icon="message" text="还没有消息，打个招呼吧" />
        ) : (
          renderList.map(renderMessage)
        )}
      </div>

      {replyMsg && !dissolved ? (
        <div className="reply-bar">
          <div className="reply-bar-main">
            <div className="reply-bar-name">回复 {senderNameOf(replyMsg)}</div>
            <div className="reply-bar-text">{previewText(replyMsg)}</div>
          </div>
          <button className="reply-bar-x" onClick={() => setReplyMsg(null)} aria-label="取消回复">
            <Icon name="close" size={16} strokeWidth={2.1} />
          </button>
        </div>
      ) : null}

      {showMentionBtn && !dissolved ? (
        <div className="at-me-bar">
          <button className="at-me-btn" onClick={scrollToMention}>
            <Icon name="bell" size={14} strokeWidth={1.9} /> 有人@我
          </button>
        </div>
      ) : null}

      {dissolved ? (
        <div className="chat-dissolved-bar">
          <div className="chat-dissolved-text">
            <Icon name="bellOff" size={16} strokeWidth={1.9} /> 该群聊已解散
          </div>
          <button className="btn btn-sm btn-danger" onClick={deleteChat}>删除群聊</button>
        </div>
      ) : (
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
            ref={inputRef}
            className="chat-input"
            rows={1}
            placeholder={isOfficialGroup ? `说点什么… 输入 @ 呼叫 ${aiName}` : '说点什么…'}
            value={text}
            onChange={onInputChange}
            onKeyDown={(e) => {
              if (handleMentionBackspace(e)) return;
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
      )}

      {mentionOpen && !dissolved ? (
        <div className="at-panel">
          <div className="at-search">
            <Icon name="search" size={15} strokeWidth={1.9} />
            <input
              className="at-search-input"
              placeholder="搜索成员名称"
              value={mq}
              autoFocus
              onChange={(e) => setMq(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const first = mentionGroups[0]?.items?.[0];
                  if (first) chooseMention(first.isAi ? aiName : first.username);
                } else if (e.key === 'Escape') {
                  setText((t) => t.replace(/(^|\s)@[^\s@]*$/, '$1'));
                }
              }}
            />
            <button
              className="at-close"
              onClick={() => setText((t) => t.replace(/(^|\s)@[^\s@]*$/, '$1'))}
              aria-label="关闭"
            >
              <Icon name="close" size={15} strokeWidth={2.1} />
            </button>
          </div>
          <div className="at-list">
            {mentionGroups.length === 0 ? (
              <div className="hint center" style={{ padding: '16px 0' }}>没有匹配的成员</div>
            ) : (
              mentionGroups.map((g) => (
                <div key={g.letter}>
                  <div className="at-letter">{g.letter}</div>
                  {g.items.map((it) => (
                    <div
                      key={g.letter + '_' + (it.isAi ? 'ai' : it.id)}
                      className="at-row"
                      onClick={() => chooseMention(it.isAi ? aiName : it.username)}
                    >
                      {it.isAi ? (
                        <IconTile name="robot" tone="mint" box={32} size={17} />
                      ) : (
                        <Avatar user={{ id: it.id, username: it.name, avatar: it.avatar }} size={32} />
                      )}
                      <span className="at-name" style={it.isAi ? { color: 'var(--ai)', fontWeight: 700 } : undefined}>
                        {it.name}
                      </span>
                      {it.isAi ? <span className="hint" style={{ marginLeft: 'auto' }}>智能机器人</span> : null}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}

      {/* 表情面板 */}
      <Sheet open={panel === 'emoji'} onClose={() => setPanel(null)}>
        <EmojiPanel onEmoji={(e) => setText((t) => t + e)} onSendSticker={sendSticker} />
      </Sheet>

      {/* + 面板 */}
      <Sheet open={panel === 'plus'} onClose={() => setPanel(null)} title="发送内容">
        <div className="grid2" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <MediaPicker onPick={pickFiles} accept="image/*">
            <div className="glass pad press-scale" style={{ textAlign: 'center', borderRadius: 16 }}>
              <Icon name="image" size={26} strokeWidth={1.8} />
              <div className="hint" style={{ marginTop: 6 }}>相册图片</div>
            </div>
          </MediaPicker>
          <MediaPicker onPick={pickFiles} accept="video/*">
            <div className="glass pad press-scale" style={{ textAlign: 'center', borderRadius: 16 }}>
              <Icon name="video" size={26} strokeWidth={1.8} />
              <div className="hint" style={{ marginTop: 6 }}>相册视频</div>
            </div>
          </MediaPicker>
          <CameraPicker onPick={pickFiles} kind="image">
            <div className="glass pad press-scale" style={{ textAlign: 'center', borderRadius: 16 }}>
              <Icon name="camera" size={26} strokeWidth={1.8} />
              <div className="hint" style={{ marginTop: 6 }}>拍摄照片</div>
            </div>
          </CameraPicker>
          <CameraPicker onPick={pickFiles} kind="video">
            <div className="glass pad press-scale" style={{ textAlign: 'center', borderRadius: 16 }}>
              <Icon name="videoCam" size={26} strokeWidth={1.8} />
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
            <div style={{ fontWeight: 700, fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="flame" size={15} filled color="#ffb020" /> 一次性查看
            </div>
            <div className="hint">勾选后对方只能查看一次，查看完在对方侧自动销毁（你这边保留）</div>
          </div>
          <div className={'switch' + (oneTime ? ' on' : '')} onClick={() => setOneTime((v) => !v)}><i /></div>
        </div>
        {oneTime ? (
          <div className="glass pad mt">
            <div style={{ fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="clock" size={15} strokeWidth={1.9} /> 对方可观看时长
            </div>
            <div className="hint">自定义对方查看该内容后自动销毁的秒数（1–300 秒）</div>
            <div className="flex gap6 mt" style={{ flexWrap: 'wrap' }}>
              {[3, 5, 10, 30, 60].map((sec) => (
                <button
                  key={sec}
                  className={'chip' + (Number(oneTimeSec) === sec ? ' active' : '')}
                  onClick={() => setOneTimeSec(String(sec))}
                >
                  {sec} 秒
                </button>
              ))}
            </div>
            <div className="glass pad mt" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 14 }}>自定义秒数</span>
              <input
                className="input"
                type="number"
                min={1}
                max={300}
                value={oneTimeSec}
                onChange={(e) => setOneTimeSec(e.target.value.replace(/[^0-9]/g, ''))}
                onBlur={() => setOneTimeSec(String(Math.min(Math.max(Number(oneTimeSec) || 5, 1), 300)))}
                style={{ width: 96, textAlign: 'center' }}
              />
            </div>
          </div>
        ) : null}
        <button className="btn btn-primary btn-block mt" style={{ marginTop: 14 }} disabled={sending || !pendingFiles.length} onClick={doSendMedia}>
          {sending ? <Spinner size={18} /> : '发送'}
        </button>
      </Sheet>

      {/* 在线成员 */}
      <Sheet open={onlineSheet} onClose={() => setOnlineSheet(false)} title={`在线成员（${onlineCount}）`}>
        {onlineMembers.length === 0 ? (
          <Empty icon="moon" text="当前没有人在线" />
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
            { icon: <IconTile name="user" tone="sky" box={34} size={18} />, label: '查看资料', onClick: () => push('friendInfo', { userId: peerId }) },
            peer?.is_friend === false
              ? { icon: <IconTile name="userPlus" tone="mint" box={34} size={18} />, label: '加为好友', onClick: () => push('friendInfo', { userId: peerId }) }
              : { icon: <IconTile name="trash" tone="rose" box={34} size={18} />, label: '删除好友', danger: true, onClick: () => setConfirmAct('delete') },
            { icon: <IconTile name="ban" tone="rose" box={34} size={18} />, label: '拉黑', danger: true, onClick: () => setConfirmAct('block') },
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
            icon: confirmAct === 'block' ? <IconTile name="ban" tone="rose" box={34} size={18} /> : <IconTile name="trash" tone="rose" box={34} size={18} />,
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
                ...(!actionMsg.recalled
                  ? [{ icon: <IconTile name="reply" tone="mint" box={34} size={18} />, label: '回复', onClick: () => setReplyMsg(actionMsg) }]
                  : []),
                ...(canRecall(actionMsg) ? [{ icon: <IconTile name="clock" tone="amber" box={34} size={18} />, label: '撤回（3 分钟内）', onClick: () => doRecall(actionMsg) }] : []),
                ...((actionMsg.msg_type === 'text' || actionMsg.msg_type === 'sticker') && !actionMsg.recalled
                  ? [{ icon: <IconTile name="copy" tone="sky" box={34} size={18} />, label: '复制', onClick: () => doCopy(actionMsg) }]
                  : []),
                ...(actionMsg.msg_type === 'sticker' && actionMsg.media_url && !actionMsg.recalled
                  ? [
                      ...(favUrls.has(actionMsg.media_url)
                        ? []
                        : [{ icon: <IconTile name="star" tone="amber" box={34} size={18} />, label: '添加到「我的添加」', onClick: () => addStickerFav(actionMsg.media_url, actionMsg.content) }]),
                      { icon: <IconTile name="link" tone="cyan" box={34} size={18} />, label: '相关表情', onClick: () => openRelated(actionMsg.media_url, actionMsg.content) },
                    ]
                  : []),
                { icon: <IconTile name="trash" tone="rose" box={34} size={18} />, label: '删除', danger: true, onClick: () => doDeleteLocal(actionMsg) },
              ]
            : []
        }
      />

      {/* 相关表情 */}
      <Sheet
        open={!!relatedSticker?.open}
        onClose={() => setRelatedSticker(null)}
        title={`相关表情${relatedSticker?.keyword ? ' · ' + relatedSticker.keyword : ''}`}
      >
        {relatedSticker?.loading ? (
          <div className="center" style={{ padding: '30px 0' }}>
            <Spinner size={22} />
          </div>
        ) : relatedSticker?.items?.length ? (
          <div className="emoji-grid anim">
            {relatedSticker.items.map((it) => (
              <button
                key={it.id}
                className="sticker-cell"
                title={it.label || ''}
                onClick={() => {
                  setRelatedSticker(null);
                  sendSticker({ url: it.url, label: it.label });
                }}
              >
                <img src={mediaUrl(it.thumb || it.url)} alt={it.label || ''} loading="lazy" />
              </button>
            ))}
          </div>
        ) : (
          <div className="hint center" style={{ padding: '26px 0' }}>没有找到相关表情</div>
        )}
      </Sheet>

      {/* 媒体查看 */}
      {viewer ? (
        <MediaViewer
          item={{ url: viewer.url, type: viewer.type }}
          oneTimeView={!!viewer.oneTime}
          burnSec={viewer.burnSec}
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
