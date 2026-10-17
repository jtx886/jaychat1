import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, tokenStore, ws, setBase, getBase } from './api.js';
import { ToastHost, toast, Spinner, LogoSvg } from './components/ui.jsx';
import UserSheet from './components/UserSheet.jsx';
import { ensureNotificationPermission, pushNotification, createChannel } from './lib/notify.js';
import { loginIM, logoutIM } from './lib/im.js';

import AuthScreen from './screens/Auth.jsx';
import MainShell from './screens/MainShell.jsx';
import ChatScreen from './screens/Chat.jsx';
import GroupInfoScreen from './screens/GroupInfo.jsx';
import FriendInfoScreen from './screens/FriendInfo.jsx';
import NotificationsScreen from './screens/Notifications.jsx';
import AddFriendScreen from './screens/AddFriend.jsx';
import CreateGroupScreen from './screens/CreateGroup.jsx';
import MomentsScreen from './screens/Moments.jsx';
import MomentDetailScreen from './screens/MomentDetail.jsx';
import PostMomentScreen from './screens/PostMoment.jsx';
import EditProfileScreen from './screens/EditProfile.jsx';
import ServerSettingsScreen from './screens/ServerSettings.jsx';
import UserMomentsScreen from './screens/UserMoments.jsx';
import BlacklistScreen from './screens/Blacklist.jsx';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export default function App() {
  const [me, setMe] = useState(tokenStore.user());
  const [booted, setBooted] = useState(false);
  const [stack, setStack] = useState([]);
  const [presence, setPresence] = useState({});
  const [conversations, setConversations] = useState([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [officialGroupId, setOfficialGroupId] = useState(0);
  const [notifyUnread, setNotifyUnread] = useState(0);
  const [reqCount, setReqCount] = useState(0);
  const [wsStatus, setWsStatus] = useState('idle');
  const [imStatus, setImStatus] = useState('idle');
  const [sheetUser, setSheetUser] = useState(null);
  const openConvRef = useRef(null);
  const bootingRef = useRef(false);
  const seenMsgRef = useRef(new Set());

  /* ---------------- 启动 ---------------- */
  useEffect(() => {
    (async () => {
      if (bootingRef.current) return;
      bootingRef.current = true;
      const token = tokenStore.get();
      if (token) {
        try {
          const { user } = await api.get('/api/auth/me');
          setMe(user);
          tokenStore.setUser(user);
        } catch (e) {
          if (e.status === 401) tokenStore.clear();
        }
      }
      setBooted(true);
      createChannel();
      // 登录腾讯云 IM，建立跨网络实时接收通道
      if (tokenStore.get()) loginIM().catch((e) => console.warn('[im] 登录失败', e?.message || e));
    })();
  }, []);

  /* ---------------- 数据刷新 ---------------- */
  const refreshConversations = useCallback(async () => {
    if (!tokenStore.get()) return;
    try {
      const d = await api.get('/api/conversations');
      setConversations(d.conversations || []);
      setTotalUnread(d.total_unread || 0);
      setOfficialGroupId(d.official_group_id || 0);
    } catch {}
  }, []);

  const refreshBadges = useCallback(async () => {
    if (!tokenStore.get()) return;
    try {
      const [n, r] = await Promise.all([
        api.get('/api/notifications/unread').catch(() => ({ unread: 0 })),
        api.get('/api/friends/requests').catch(() => ({ requests: [] })),
      ]);
      setNotifyUnread(n.unread || 0);
      setReqCount((r.requests || []).length);
    } catch {}
  }, []);

  useEffect(() => {
    if (!tokenStore.get()) return;
    ws.connect();
    refreshConversations();
    refreshBadges();
    // 在线状态兜底轮询（30s）
    const t = setInterval(() => {
      const ids = conversations.filter((c) => c.peer).map((c) => c.peer.id);
      if (ids.length) {
        api
          .get('/api/presence?ids=' + ids.join(','))
          .then((d) => {
            const m = {};
            (d.presence || []).forEach((p) => (m[p.userId] = p.online));
            setPresence((s) => ({ ...s, ...m }));
          })
          .catch(() => {});
      }
      refreshConversations();
    }, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id]);

  /* ---------------- WebSocket 事件 ---------------- */
  useEffect(() => {
    const offs = [];
    offs.push(ws.on('__status', (s) => setWsStatus(s)));
    offs.push(ws.on('__imstatus', (s) => setImStatus(s)));
    offs.push(
      ws.on('presence', (d) => setPresence((p) => ({ ...p, [d.userId]: d.online }))),
    );
    offs.push(
      ws.on('presence:all', (d) => {
        const m = {};
        (d.userIds || []).forEach((id) => (m[id] = true));
        setPresence((p) => ({ ...p, ...m }));
      }),
    );
    const onRefresh = () => {
      refreshConversations();
      refreshBadges();
    };
    ['group:new', 'group:update', 'group:members', 'group:removed', 'friend:new', 'friend:accept', 'friend:remove', 'friend:request'].forEach((t) =>
      offs.push(ws.on(t, onRefresh)),
    );

    offs.push(
      ws.on('message', (m) => {
        // 同一条消息可能同时经本地 WebSocket 与腾讯云 IM 到达，做一次去重
        const seen = seenMsgRef.current;
        if (m && seen.has(m.id)) return;
        if (m) {
          seen.add(m.id);
          if (seen.size > 800) seen.clear();
        }
        refreshConversations();
        const key = `${m.conv_type}_${m.conv_id}`;
        const isOpen = openConvRef.current === key;
        if (isOpen) return;
        if (m.extra?.ai) {
          pushNotification({ title: 'Jay AI', body: `${m.content || ''}`.slice(0, 80), tag: 'ai' });
          return;
        }
        const conv = conversations.find((c) => `${c.conv_type}_${c.conv_id}` === key);
        if (conv?.dnd) return;
        const senderName = m.sender?.username || '新消息';
        const body =
          m.msg_type === 'image' ? '[图片]' : m.msg_type === 'video' ? '[视频]' : m.msg_type === 'sticker' ? '[动画表情]' : m.content;
        pushNotification({
          title: m.conv_type === 'group' ? conv?.name || '群聊' : senderName,
          body: m.conv_type === 'group' ? `${senderName}：${body}` : body,
          tag: key,
        });
      }),
    );

    offs.push(
      ws.on('message:update', (m) => {
        refreshConversations();
        if (m.extra?.ai && openConvRef.current !== `${m.conv_type}_${m.conv_id}`) {
          pushNotification({ title: 'Jay AI', body: String(m.content || '').slice(0, 90), tag: 'ai' });
        }
      }),
    );

    offs.push(
      ws.on('notification', (n) => {
        setNotifyUnread((c) => c + 1);
        pushNotification({ title: 'Jay Chat', body: n.text || '你有新的通知', tag: 'notif' });
        toast(n.text || '新通知');
        refreshBadges();
      }),
    );

    return () => offs.forEach((off) => off());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversations]);

  useEffect(() => {
    ensureNotificationPermission();
  }, []);

  /* ---------------- 路由 ---------------- */
  const direction = useRef('forward');
  const push = useCallback((name, params = {}) => {
    direction.current = 'forward';
    setStack((s) => [...s, { name, params, key: Math.random().toString(36).slice(2) }]);
  }, []);
  const back = useCallback(() => {
    direction.current = 'back';
    setStack((s) => (s.length ? s.slice(0, -1) : s));
  }, []);
  const reset = useCallback(() => setStack([]), []);
  /** 打开用户卡片（点击头像时调用） */
  const openUser = useCallback((user) => {
    if (!user || !user.id) return;
    setSheetUser(typeof user === 'object' ? user : { id: user });
  }, []);

  // 安卓物理返回键 & 浏览器返回
  useEffect(() => {
    const onPop = () => back();
    window.addEventListener('popstate', onPop);
    const capApp = window.Capacitor?.Plugins?.App;
    let handle;
    if (capApp) {
      capApp.addListener('backButton', () => {
        if (stack.length) back();
        else capApp.exitApp?.();
      }).then((h) => (handle = h));
    }
    return () => {
      window.removeEventListener('popstate', onPop);
      handle?.remove?.();
    };
  }, [stack.length, back]);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout', {});
    } catch {}
    logoutIM().catch(() => {});
    tokenStore.clear();
    ws.close();
    seenMsgRef.current.clear();
    setMe(null);
    setConversations([]);
    setStack([]);
    setPresence({});
    setNotifyUnread(0);
    setReqCount(0);
  }, []);

  const login = useCallback(
    async (token, user) => {
      tokenStore.set(token);
      tokenStore.setUser(user);
      setMe(user);
      seenMsgRef.current.clear();
      ws.connect();
      loginIM().catch((e) => console.warn('[im] 登录失败', e?.message || e));
      await refreshConversations();
      await refreshBadges();
    },
    [refreshConversations, refreshBadges],
  );

  const setUser = useCallback((u) => {
    tokenStore.setUser(u);
    setMe(u);
  }, []);

  const ctx = useMemo(
    () => ({
      me, setMe: setUser, login, logout, booted,
      presence, setPresence,
      conversations, refreshConversations, totalUnread, officialGroupId,
      notifyUnread, setNotifyUnread, reqCount, refreshBadges,
      wsStatus, imStatus, openConvRef, setBase, getBase,
      route: stack[stack.length - 1], stack, push, back, reset, openUser,
    }),
    [me, booted, presence, conversations, totalUnread, officialGroupId, notifyUnread, reqCount, wsStatus, imStatus, stack, push, back, reset, openUser, login, logout, setUser, refreshConversations, refreshBadges],
  );

  if (!booted) {
    return (
      <div className="aurora grain">
        <div className="splash">
          <div className="logo-mark"><LogoSvg size={68} bubble={false} /></div>
          <div className="splash-name">Jay Chat</div>
          <Spinner size={22} />
        </div>
      </div>
    );
  }

  if (!me) {
    return (
      <AppCtx.Provider value={ctx}>
        <div className="aurora grain"><i /><i /><i /><i /></div>
        <AuthScreen />
        <ToastHost />
      </AppCtx.Provider>
    );
  }

  const renderRoute = () => {
    const r = stack[stack.length - 1];
    if (!r) return <MainShell />;
    switch (r.name) {
      case 'chat':
        return <ChatScreen {...r.params} />;
      case 'groupInfo':
        return <GroupInfoScreen {...r.params} />;
      case 'friendInfo':
        return <FriendInfoScreen {...r.params} />;
      case 'notifications':
        return <NotificationsScreen />;
      case 'addFriend':
        return <AddFriendScreen />;
      case 'createGroup':
        return <CreateGroupScreen />;
      case 'moments':
        return <MomentsScreen {...r.params} />;
      case 'momentDetail':
        return <MomentDetailScreen {...r.params} />;
      case 'postMoment':
        return <PostMomentScreen {...r.params} />;
      case 'editProfile':
        return <EditProfileScreen />;
      case 'serverSettings':
        return <ServerSettingsScreen />;
      case 'userMoments':
        return <UserMomentsScreen {...r.params} />;
      case 'blacklist':
        return <BlacklistScreen />;
      default:
        return <MainShell />;
    }
  };

  return (
    <AppCtx.Provider value={ctx}>
      <div className="aurora grain"><i /><i /><i /><i /></div>
      <div className="app-shell">
        <div
          key={stack[stack.length - 1]?.key || 'root'}
          className={'page ' + (direction.current === 'back' ? 'page-enter-back' : 'page-enter')}
        >
          {renderRoute()}
        </div>
      </div>
      <UserSheet user={sheetUser} onClose={() => setSheetUser(null)} />
      <ToastHost />
    </AppCtx.Provider>
  );
}
