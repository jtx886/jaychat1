import React, { useEffect, useMemo, useRef, useState } from 'react';
import { mediaUrl, directMediaUrl } from '../api.js';
import { avatarSrc } from '../lib/avatar.js';
import { Icon } from './icons.jsx';

/* ============================ Logo ============================ */
/** Jay Chat 品牌标识（骷髅图标） */
export function LogoSvg({ size = 40, bubble = true }) {
  return (
    <svg viewBox="0 0 512 512" width={size} height={size} aria-hidden="true">
      {bubble ? <rect width="512" height="512" rx="115" fill="#20264f" /> : null}
      <rect x="116" y="86" width="280" height="290" rx="142" fill="#f8f9fc" />
      <rect x="178" y="300" width="156" height="126" rx="56" fill="#f8f9fc" />
      <circle cx="196" cy="240" r="40" fill="#4d7cff" />
      <circle cx="316" cy="240" r="40" fill="#4d7cff" />
    </svg>
  );
}

export function LogoMark({ size = 92, className = 'logo-mark' }) {
  return (
    <div className={className} style={{ width: size, height: size, borderRadius: Math.round(size * 0.3) }}>
      <LogoSvg size={Math.round(size * 0.86)} bubble={false} />
    </div>
  );
}

/* ============================ 头像 ============================ */
const PALETTE = [
  ['#5b9dff', '#3b6dff'], ['#7a5cff', '#5236e8'], ['#ff7a8a', '#e8435f'],
  ['#2fd07b', '#12a05c'], ['#ffb020', '#f08a00'], ['#3ad0e0', '#1a9dbf'],
  ['#ff8fd0', '#e0559f'], ['#8f9bff', '#5f6ae0'],
];
export function colorFor(seed = 0) {
  const p = PALETTE[Math.abs(Number(seed) || 0) % PALETTE.length];
  return `linear-gradient(135deg, ${p[0]}, ${p[1]})`;
}

export function OfficialBadge({ size = 17, inline }) {
  return (
    <span className={'verify-badge' + (inline ? ' inline' : '')} style={{ width: size, height: size }}>
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M5 13l4.2 4.2L19 7" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Avatar({ user, name, src, size = 48, online, showOnline = true, radius, style, children, onClick }) {
  const label = name || user?.username || '';
  const img = avatarSrc(src ?? user?.avatar ?? '');
  const official = user?.is_official;
  const isOn = online ?? user?.online;
  const r = radius ?? Math.round(size * 0.32);
  const initial = label ? String(label).trim().charAt(0) : '?';
  return (
    <div
      className={'avatar avatar-ring' + (onClick ? ' avatar-tap' : '')}
      onClick={onClick}
      style={{ width: size, height: size, borderRadius: r, background: img ? '#0b1226' : colorFor(user?.id || label.charCodeAt(0) || 1), fontSize: Math.round(size * 0.42), cursor: onClick ? 'pointer' : undefined, ...style }}
    >
      {img ? <img src={mediaUrl(img)} alt={label} /> : initial}
      {official ? <OfficialBadge size={Math.max(14, size * 0.34)} /> : null}
      {isOn && !official ? (
        <span className="dot-online" style={{ width: Math.max(9, size * 0.22), height: Math.max(9, size * 0.22) }} />
      ) : null}
      {children}
    </div>
  );
}

/* ============================ 顶栏 ============================ */
export function TopBar({ title, sub, onBack, right, left, sticky = true }) {
  return (
    <div className="topbar" style={{ position: sticky ? 'sticky' : 'relative' }}>
      {onBack ? (
        <button className="icon-btn" onClick={onBack} aria-label="返回">
          <svg viewBox="0 0 24 24" width="19" height="19" fill="none">
            <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      ) : (
        left
      )}
      <div className="list-main">
        <div className="topbar-title">{title}</div>
        {sub ? <div className="topbar-sub">{sub}</div> : null}
      </div>
      <div className="spacer" />
      {right}
    </div>
  );
}

/* ============================ 底部弹层 ============================ */
export function Sheet({ open, onClose, title, children, maxHeight }) {
  if (!open) return null;
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" style={maxHeight ? { maxHeight } : undefined} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-grabber" />
        {title ? <div className="sheet-title">{title}</div> : null}
        {children}
      </div>
    </>
  );
}

export function ActionSheet({ open, onClose, title, actions, dangerIndex }) {
  return (
    <Sheet open={open} onClose={onClose}>
      {title ? <div className="sheet-title">{title}</div> : null}
      <div className="menu-list">
        {actions.map((a, i) => (
          <div
            key={i}
            className={'menu-item' + (i === dangerIndex || a.danger ? ' danger' : '')}
            onClick={() => {
              onClose?.();
              a.onClick?.();
            }}
          >
            {a.icon}
            <span>{a.label}</span>
            {a.chev ? <span className="chev">›</span> : null}
          </div>
        ))}
      </div>
      <button className="btn btn-block btn-ghost mt" onClick={onClose} style={{ marginTop: 12 }}>
        取消
      </button>
    </Sheet>
  );
}

export function CenterModal({ open, onClose, children }) {
  if (!open) return null;
  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="center-modal" onClick={onClose}>
        <div className="center-card" onClick={(e) => e.stopPropagation()}>
          {children}
        </div>
      </div>
    </>
  );
}

/* ============================ Toast ============================ */
const toastListeners = new Set();
export function toast(message, type = 'info') {
  toastListeners.forEach((fn) => fn({ message, type, id: Math.random() }));
}
export function ToastHost() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const fn = (t) => {
      setItems((s) => [...s, t]);
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== t.id)), 2600);
    };
    toastListeners.add(fn);
    return () => toastListeners.delete(fn);
  }, []);
  return (
    <div className="toast-host">
      {items.map((t) => (
        <div key={t.id} className={'toast' + (t.type === 'error' ? ' error' : '')}>
          {t.message}
        </div>
      ))}
    </div>
  );
}

/* ============================ 其它小组件 ============================ */
export function Switch({ on, onChange }) {
  return <div className={'switch' + (on ? ' on' : '')} onClick={() => onChange(!on)}><i /></div>;
}

export function Empty({ icon = 'message', text = '暂无内容' }) {
  return (
    <div className="empty">
      <div className="empty-icon"><Icon name={icon} size={30} strokeWidth={1.7} /></div>
      {text}
    </div>
  );
}

export function Spinner({ size = 20 }) {
  return <div className="spinner" style={{ width: size, height: size }} />;
}

export function Loading({ text = '加载中…' }) {
  return (
    <div className="empty">
      <Spinner size={24} />
      <div style={{ marginTop: 10 }}>{text}</div>
    </div>
  );
}

/* ============================ 图片（自动降级 + 失败提示） ============================ */
/** 统一图片组件：
 *  - 默认走 /api/media（正确的 Content-Type，绕过主机对扩展名的拦截）
 *  - 加载失败时自动改用 /uploads 直链再试一次
 *  - 仍失败则显示「图片加载失败」，不再留一块空白
 */
export function SmartImage({ src, alt = '', className, style, ...rest }) {
  const primary = mediaUrl(src);
  const fallback = directMediaUrl(src);
  const [cur, setCur] = useState(primary);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setCur(primary);
    setFailed(false);
  }, [primary, fallback]);
  if (!src) return null;
  if (failed) {
    return (
      <div className={'video-fail' + (className ? ' ' + className : '')} style={style}>
        <Icon name="image" size={22} strokeWidth={1.8} />
        <span>图片加载失败</span>
      </div>
    );
  }
  return (
    <img
      src={cur}
      alt={alt}
      loading="lazy"
      className={className}
      style={style}
      onError={() => {
        if (fallback && cur !== fallback) setCur(fallback);
        else setFailed(true);
      }}
      {...rest}
    />
  );
}

/* ============================ 视频播放器 ============================ */
/** 根据媒体地址推断视频容器类型；服务端把 MOV/M4V 也统一按 video/mp4 输出 */
function videoMimeOf(u) {
  const s = String(u || '').split('?')[0].split('#')[0].toLowerCase();
  const name = s.endsWith('.dat') ? s.slice(0, -4) : s;
  if (name.endsWith('.webm')) return 'video/webm';
  if (name.endsWith('.ogv')) return 'video/ogg';
  if (name.endsWith('.mkv')) return 'video/x-matroska';
  if (name.endsWith('.3gp')) return 'video/3gpp';
  if (name.endsWith('.avi')) return 'video/x-msvideo';
  if (name.endsWith('.flv')) return 'video/x-flv';
  if (name.endsWith('.wmv')) return 'video/x-ms-wmv';
  if (name.endsWith('.mpeg') || name.endsWith('.mpg')) return 'video/mpeg';
  return 'video/mp4';
}

/** 视频播放（内置播放器，不依赖浏览器自带控制条）：
 *  - 统一走 /api/media（正确的 Content-Type + Range 支持）
 *  - 用 <source type> 显式声明容器类型：部分系统浏览器只看 URL 后缀，
 *    视频落盘名以 .dat 结尾会被判为未知格式直接拒绝播放
 *  - /api/media 失效时自动降级 /uploads 直链重试（直链由 .htaccess 强制成视频类型）
 *  - 自带播放/暂停、进度条、时间显示，避免系统浏览器控制条不渲染导致「只有黑块」
 *  - 解码失败（典型是 HEVC/H.265 编码）时明确提示，并提供下载入口
 */
function clipTime(sec) {
  const n = Math.max(0, Math.floor(Number(sec) || 0));
  const m = Math.floor(n / 60);
  const s = n % 60;
  return m + ':' + (s < 10 ? '0' + s : String(s));
}

export function VideoPlayer({ src, className, style, autoPlay = false, onClick }) {
  // null=正常；'network'=下载/网络问题；'decode'=编码或格式不被当前浏览器支持
  const [err, setErr] = useState(null);
  const [nonce, setNonce] = useState(0);
  const [useDirect, setUseDirect] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [dur, setDur] = useState(0);
  const [cur, setCur] = useState(0);
  const videoRef = useRef(null);
  const failRef = useRef(() => {});
  const primary = mediaUrl(src);
  useEffect(() => {
    setErr(null);
    setNonce(0);
    setUseDirect(false);
    setPlaying(false);
    setDur(0);
    setCur(0);
  }, [primary]);
  // 从 /api/media?f=xxx 反解出 /uploads/xxx 直链，作为降级地址
  const direct = (() => {
    const s = String(primary || '');
    const marker = '/api/media?f=';
    const i = s.indexOf(marker);
    if (i < 0) return '';
    try {
      return s.slice(0, i) + '/uploads/' + decodeURIComponent(s.slice(i + marker.length).split('#')[0]);
    } catch {
      return '';
    }
  })();
  const base = useDirect && direct ? direct : primary;
  const url = nonce ? base + (base.includes('?') ? '&' : '?') + 'r=' + nonce : base;
  const openUrl = (() => {
    const u = direct || primary;
    if (!u) return '';
    try {
      return new URL(u, typeof window !== 'undefined' ? window.location.href : 'http://localhost').href;
    } catch {
      return u;
    }
  })();
  failRef.current = (kind) => {
    if (!useDirect && direct) {
      setUseDirect(true);
      setNonce(Date.now());
      return;
    }
    if (kind === 'decode' && url) {
      // 确认文件确实能取到：取不到就是网络/文件问题，而不是编码问题，避免误导
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), 8000) : null;
      fetch(url, { headers: { Range: 'bytes=0-1' }, cache: 'no-store', signal: ctrl?.signal })
        .then((r) => setErr(r.ok || r.status === 206 ? 'decode' : 'network'))
        .catch(() => setErr('network'))
        .finally(() => {
          if (timer) clearTimeout(timer);
        });
      return;
    }
    setErr(kind);
  };
  // 兜底：30 秒仍无任何元数据、且已不在下载状态（主机会话被丢弃）才判定失败
  useEffect(() => {
    const t = setTimeout(() => {
      const v = videoRef.current;
      // networkState=2 表示仍在下载（非 faststart 的视频可能要下完才拿到元数据），不能误判
      if (v && !v.error && v.readyState === 0 && v.networkState !== 2) failRef.current('network');
    }, 30000);
    return () => clearTimeout(t);
  }, [url]);
  if (err) {
    return (
      <div
        className={'video-fail' + (className ? ' ' + className : '')}
        style={style}
        onClick={(e) => e.stopPropagation()}
      >
        <Icon name="video" size={22} strokeWidth={1.8} />
        <span>{err === 'decode' ? '当前浏览器不支持该视频编码' : '视频加载失败'}</span>
        <span className="video-fail-hint">
          {err === 'decode'
            ? '视频可能是 HEVC/H.265 编码，网页播放器无法解码；可下载后在本机相册播放'
            : '请检查网络后重试'}
        </span>
        <div className="video-fail-actions">
          {openUrl && (
            <a className="btn btn-sm" href={openUrl} download>
              下载视频
            </a>
          )}
          <button
            className="btn btn-sm"
            onClick={() => {
              setErr(null);
              setNonce(Date.now());
            }}
          >
            重试
          </button>
        </div>
      </div>
    );
  }
  const onMediaError = (e) => {
    // MediaError: 3=解码失败 4=格式/编码不支持 → 换播放器也无法解码，给出明确提示
    const code = e?.currentTarget?.error?.code;
    failRef.current(code === 3 || code === 4 ? 'decode' : 'network');
  };
  const toggle = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      const p = v.play();
      if (p && p.catch) p.catch(() => {});
    } else {
      v.pause();
    }
  };
  const seek = (e) => {
    const v = videoRef.current;
    const t = Number(e.target.value) || 0;
    setCur(t);
    if (v) {
      try {
        v.currentTime = t;
      } catch {}
    }
  };
  return (
    <div
      className={'vp' + (className ? ' ' + className : '')}
      style={style}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.(e);
      }}
    >
      <video
        key={url}
        ref={videoRef}
        className="vp-video"
        autoPlay={autoPlay}
        playsInline
        webkit-playsinline="true"
        x5-playsinline="true"
        preload="metadata"
        controls={false}
        onClick={toggle}
        onError={onMediaError}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setCur(0);
        }}
        onDurationChange={(e) => setDur(Number(e.currentTarget.duration) || 0)}
        onLoadedMetadata={(e) => setDur(Number(e.currentTarget.duration) || 0)}
        onTimeUpdate={(e) => setCur(Number(e.currentTarget.currentTime) || 0)}
      >
        <source src={url} type={videoMimeOf(url)} onError={onMediaError} />
      </video>
      {!playing ? (
        <button type="button" className="vp-big" aria-label="播放" onClick={toggle}>
          <Icon name="play" size={24} filled />
        </button>
      ) : null}
      <div className="vp-ctrl" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="vp-btn" aria-label={playing ? '暂停' : '播放'} onClick={toggle}>
          <Icon name={playing ? 'pause' : 'play'} size={13} filled />
        </button>
        <span className="vp-time">{clipTime(cur)}</span>
        <input
          type="range"
          className="vp-range"
          min="0"
          max={dur || 0}
          step="0.1"
          value={Math.min(cur, dur || 0)}
          onChange={seek}
        />
        <span className="vp-time">{clipTime(dur)}</span>
      </div>
    </div>
  );
}

/* ============================ 媒体查看器 ============================ */
export function MediaViewer({ item, onClose, onFirstView, oneTimeView, onBurn, burnSec }) {
  const [revealed, setRevealed] = useState(!oneTimeView);
  const closeTimer = useRef(null);
  useEffect(() => {
    return () => clearTimeout(closeTimer.current);
  }, []);
  if (!item) return null;
  const isVideo = item.type === 'video' || item.msg_type === 'video';
  const url = mediaUrl(item.url || item.media_url);
  const secs = Math.min(Math.max(Number(burnSec) || 5, 1), 300);

  const reveal = () => {
    setRevealed(true);
    onFirstView?.();
    // 一次性消息：按发送方设定的时长自动销毁并关闭
    closeTimer.current = setTimeout(() => {
      onBurn?.();
      onClose?.();
    }, secs * 1000);
  };

  return (
    <div className="media-viewer" onClick={onClose}>
      {revealed ? (
        isVideo ? (
          <VideoPlayer src={url} autoPlay onClick={(e) => e.stopPropagation()} />
        ) : (
          <SmartImage src={item.url || item.media_url} alt="" onClick={(e) => e.stopPropagation()} />
        )
      ) : (
        <div className="one-time-overlay" onClick={(e) => e.stopPropagation()}>
          <div className="empty-icon"><Icon name="flame" size={34} strokeWidth={1.8} /></div>
          <div style={{ fontWeight: 700 }}>一次性消息</div>
          <div className="hint">查看后 {secs} 秒自动销毁，且对方无法再次查看</div>
          <button className="btn btn-primary" onClick={reveal}>点击查看</button>
        </div>
      )}
      {revealed && oneTimeView ? (
        <div style={{ position: 'absolute', top: 20, left: 0, right: 0, textAlign: 'center', fontWeight: 700, color: '#ffd479' }}>
          一次性消息 · {secs} 秒后自动销毁
        </div>
      ) : null}
    </div>
  );
}

/* ============================ 媒体选择（相册 / 拍摄） ============================ */
export function MediaPicker({ onPick, children, accept = 'image/*,video/*', multiple = true }) {
  const ref = useRef(null);
  return (
    <>
      <div onClick={() => ref.current?.click()} style={{ display: 'contents' }}>
        {children}
      </div>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = [...(e.target.files || [])];
          e.target.value = '';
          if (files.length) onPick(files);
        }}
      />
    </>
  );
}

export function CameraPicker({ onPick, children, kind = 'image' }) {
  const ref = useRef(null);
  return (
    <>
      <div onClick={() => ref.current?.click()} style={{ display: 'contents' }}>
        {children}
      </div>
      <input
        ref={ref}
        type="file"
        accept={kind === 'video' ? 'video/*' : 'image/*'}
        capture="environment"
        style={{ display: 'none' }}
        onChange={(e) => {
          const files = [...(e.target.files || [])];
          e.target.value = '';
          if (files.length) onPick(files);
        }}
      />
    </>
  );
}

/* ============================ 名称首字母分组列表 ============================ */
export function InitialIndex({ letters, onJump }) {
  return (
    <div style={{ position: 'absolute', right: 4, top: 60, bottom: 90, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 1, zIndex: 20 }}>
      {letters.map((l) => (
        <div
          key={l}
          onClick={() => onJump(l)}
          style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 700, textAlign: 'center', width: 18, lineHeight: '12px', cursor: 'pointer' }}
        >
          {l}
        </div>
      ))}
    </div>
  );
}

export function useAutoScroll(dep) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [dep]);
  return ref;
}
