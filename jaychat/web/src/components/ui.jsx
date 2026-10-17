import React, { useEffect, useMemo, useRef, useState } from 'react';
import { mediaUrl } from '../api.js';
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
  const img = src ?? user?.avatar ?? '';
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
          <video src={url} controls autoPlay playsInline onClick={(e) => e.stopPropagation()} />
        ) : (
          <img src={url} alt="" onClick={(e) => e.stopPropagation()} />
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
