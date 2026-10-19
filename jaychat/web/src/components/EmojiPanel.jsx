import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../api.js';
import { EMOJI_CATEGORIES, STICKER_HOT_KEYWORDS, parseSticker } from '../lib/emoji.js';
import { Icon } from './icons.jsx';
import { Sheet, ActionSheet, Spinner, toast } from './ui.jsx';
import { TgsSticker, hasArt } from './Sticker.jsx';

/** 渲染聊天消息里的历史贴纸（兼容旧版内联动画） */
export function StickerView({ text, small }) {
  const s = parseSticker(text);
  if (!s) return null;
  if (s.art && hasArt(s.art)) return <TgsSticker art={s.art} size={small ? 'md' : 'lg'} />;
  if (s.emoji) {
    return <span style={{ fontSize: small ? 34 : 56, lineHeight: 1.1 }}>{s.emoji}</span>;
  }
  return null;
}

/* ============================ 「合成」模板 ============================
 * 参考微信：用搜索词合成一张表情。这里用 canvas 本地生成，
 * 不占用服务端资源，发送/收藏时再上传。 */
const COMPOSE_TEMPLATES = [
  { emoji: '😂', from: '#ffd76e', to: '#ff8a3d' },
  { emoji: '👍', from: '#9be7ff', to: '#4aa8ff' },
  { emoji: '❤️', from: '#ffb3c8', to: '#ff5d8f' },
  { emoji: '🐶', from: '#ffe0a3', to: '#f5a623' },
  { emoji: '😭', from: '#c9d6ff', to: '#7a5cff' },
  { emoji: '🙏', from: '#c8f7d4', to: '#12a05c' },
  { emoji: '🎉', from: '#ffe6a3', to: '#ffab00' },
  { emoji: '🤔', from: '#d9c7ff', to: '#8a7bff' },
  { emoji: '😎', from: '#b7e4ff', to: '#1a9dbf' },
  { emoji: '🥰', from: '#ffd0e4', to: '#e0559f' },
  { emoji: '😡', from: '#ffbfa3', to: '#e8435f' },
  { emoji: '🐱', from: '#ffe6c2', to: '#f0a63e' },
];

function composeItemsFor(keyword) {
  const kw = String(keyword || '').slice(0, 8) || '表情';
  return COMPOSE_TEMPLATES.map((t, i) => ({
    kind: 'compose',
    id: 'c' + i,
    label: kw,
    emoji: t.emoji,
    from: t.from,
    to: t.to,
  }));
}

/** 把合成项绘制成 PNG Blob */
function composeBlob(item) {
  const size = 480;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, size, size);
  g.addColorStop(0, item.from);
  g.addColorStop(1, item.to);
  ctx.fillStyle = g;
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(0, 0, size, size, 72);
  } else {
    ctx.rect(0, 0, size, size);
  }
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '210px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",system-ui,sans-serif';
  ctx.fillText(item.emoji, size / 2, size * 0.4);
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.font = '800 46px system-ui,-apple-system,"PingFang SC",sans-serif';
  ctx.fillText(item.label, size / 2, size * 0.74);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

/* ============================ 长按/点击贴纸 ============================ */
function StickerTile({ item, isFav, inMine, onSend, onMenu }) {
  const timer = useRef(null);
  const longFired = useRef(false);
  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };
  const start = () => {
    longFired.current = false;
    clear();
    timer.current = setTimeout(() => {
      longFired.current = true;
      onMenu(item);
    }, 460);
  };
  const end = () => {
    clear();
  };
  const tap = () => {
    if (longFired.current) {
      longFired.current = false;
      return;
    }
    onSend(item);
  };
  return (
    <button
      className="sticker-cell"
      title={item.label || ''}
      onClick={tap}
      onContextMenu={(e) => {
        e.preventDefault();
        clear();
        longFired.current = true;
        onMenu(item);
      }}
      onTouchStart={start}
      onTouchEnd={end}
      onTouchMove={end}
      onMouseDown={start}
      onMouseUp={end}
      onMouseLeave={end}
    >
      {item.kind === 'compose' ? (
        <div
          className="compose-preview"
          style={{ background: `linear-gradient(135deg, ${item.from}, ${item.to})` }}
        >
          <span className="compose-emoji">{item.emoji}</span>
          <span className="compose-text">{item.label}</span>
        </div>
      ) : (
        <img src={item.thumb || item.url} alt={item.label || ''} loading="lazy" />
      )}
      {isFav ? <span className="sticker-fav-dot" /> : null}
      {inMine ? null : null}
    </button>
  );
}

/* ============================ 主面板 ============================ */
export default function EmojiPanel({ onEmoji, onSendSticker }) {
  const [tab, setTab] = useState('normal'); // normal | anim | mine
  const [cat, setCat] = useState(EMOJI_CATEGORIES[0].key);

  const [query, setQuery] = useState(''); // 已提交的搜索词
  const [input, setInput] = useState(''); // 输入框
  const [sub, setSub] = useState('result'); // result | compose
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [favs, setFavs] = useState([]);
  const [menu, setMenu] = useState(null);
  const [related, setRelated] = useState(null); // {open, loading, keyword, items}

  const favUrls = useMemo(() => new Set(favs.map((f) => f.url)), [favs]);
  const current = EMOJI_CATEGORIES.find((c) => c.key === cat) || EMOJI_CATEGORIES[0];
  const composeItems = useMemo(() => composeItemsFor(query), [query]);

  const loadFavs = useCallback(async () => {
    try {
      const d = await api.get('/api/stickers/favs');
      setFavs(d.items || []);
    } catch {}
  }, []);

  useEffect(() => {
    loadFavs();
  }, [loadFavs]);

  /* ---------- 搜索 ---------- */
  const doSearch = async (kw) => {
    const q = String(kw ?? input ?? '').trim();
    if (!q) {
      toast('请输入搜索关键词');
      return;
    }
    setQuery(q);
    setInput(q);
    setSub('result');
    setLoading(true);
    try {
      const d = await api.get(`/api/stickers/search?q=${encodeURIComponent(q)}`);
      setResults(d.items || []);
    } catch (e) {
      toast(e.message, 'error');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  /* ---------- 发送 ---------- */
  const sendItem = async (item) => {
    try {
      if (item.kind === 'compose') {
        const blob = await composeBlob(item);
        onSendSticker({ blob, label: item.label });
      } else {
        onSendSticker({ url: item.url, label: item.label });
      }
    } catch (e) {
      toast('表情发送失败', 'error');
    }
  };

  /* ---------- 收藏 ---------- */
  const addFav = async (item) => {
    try {
      let url = item.url;
      if (item.kind === 'compose') {
        const blob = await composeBlob(item);
        const up = await api.upload(new File([blob], 'sticker.png', { type: 'image/png' }), 'image');
        url = up.url;
      }
      if (!url) return;
      const d = await api.post('/api/stickers/favs', { url, label: item.label || '' });
      setFavs(d.items || []);
      toast('已添加到「我的添加」');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const removeFav = async (item) => {
    try {
      const d = await api.post('/api/stickers/favs/remove', { url: item.url });
      setFavs(d.items || []);
      toast('已从「我的添加」移除');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  /* ---------- 相关表情 ---------- */
  const openRelated = async (item) => {
    setRelated({ open: true, loading: true, keyword: item.label || '', items: [] });
    try {
      const d = await api.get(
        `/api/stickers/related?url=${encodeURIComponent(item.url || '')}&label=${encodeURIComponent(item.label || '')}`,
      );
      setRelated({ open: true, loading: false, keyword: d.keyword || '', items: d.items || [] });
    } catch (e) {
      setRelated({ open: true, loading: false, keyword: '', items: [] });
      toast(e.message, 'error');
    }
  };

  const menuActions = () => {
    if (!menu) return [];
    const acts = [
      {
        icon: <Icon name="send" size={18} />,
        label: '发送该表情',
        onClick: () => sendItem(menu),
      },
    ];
    const isFav = menu.url ? favUrls.has(menu.url) : false;
    if (tab === 'mine') {
      acts.push({ icon: <Icon name="trash" size={18} />, label: '从「我的添加」移除', danger: true, onClick: () => removeFav(menu) });
    } else if (!isFav) {
      acts.push({ icon: <Icon name="star" size={18} />, label: '添加到「我的添加」', onClick: () => addFav(menu) });
    }
    acts.push({ icon: <Icon name="link" size={18} />, label: '相关表情', onClick: () => openRelated(menu) });
    return acts;
  };

  const renderGrid = (items, opts = {}) => {
    if (!items.length) {
      return <div className="hint center" style={{ padding: '26px 0' }}>没有找到相关表情</div>;
    }
    return (
      <div className="emoji-grid anim">
        {items.map((it) => (
          <StickerTile
            key={it.id}
            item={it}
            isFav={it.url ? favUrls.has(it.url) : false}
            inMine={!!opts.inMine}
            onSend={sendItem}
            onMenu={setMenu}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="emoji-panel">
      <div className="emoji-tabs">
        <div className={'emoji-tab' + (tab === 'normal' ? ' active' : '')} onClick={() => setTab('normal')}>
          <Icon name="smile" size={15} strokeWidth={1.9} /> 普通表情
        </div>
        <div className={'emoji-tab' + (tab === 'anim' ? ' active' : '')} onClick={() => setTab('anim')}>
          <Icon name="sparkle" size={15} strokeWidth={1.9} /> 动画表情包
        </div>
        <div className={'emoji-tab' + (tab === 'mine' ? ' active' : '')} onClick={() => setTab('mine')}>
          <Icon name="star" size={15} strokeWidth={1.9} /> 我的添加
        </div>
      </div>

      {tab === 'normal' ? (
        <>
          <div className="emoji-tabs" style={{ overflowX: 'auto', paddingBottom: 2 }}>
            {EMOJI_CATEGORIES.map((c) => (
              <div
                key={c.key}
                className={'emoji-tab' + (cat === c.key ? ' active' : '')}
                onClick={() => setCat(c.key)}
                style={{ flex: '0 0 auto', padding: '6px 11px' }}
              >
                <Icon name={c.icon} size={14} strokeWidth={1.9} /> {c.name}
              </div>
            ))}
          </div>
          <div className="emoji-grid">
            {current.emojis.map((e, i) => (
              <button key={e + i} className="emoji-cell" onClick={() => onEmoji(e)}>
                {e}
              </button>
            ))}
          </div>
        </>
      ) : null}

      {tab === 'anim' ? (
        <>
          <div className="sticker-search">
            <Icon name="search" size={16} strokeWidth={1.9} className="sticker-search-icon" />
            <input
              className="sticker-search-input"
              placeholder="搜索表情包，搜什么出什么"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') doSearch();
              }}
            />
            <button className="btn btn-primary" style={{ padding: '8px 14px' }} onClick={() => doSearch()}>
              搜索
            </button>
          </div>

          {query ? (
            <div className="emoji-tabs">
              <div className={'emoji-tab' + (sub === 'result' ? ' active' : '')} onClick={() => setSub('result')}>
                结果
              </div>
              <div className={'emoji-tab' + (sub === 'compose' ? ' active' : '')} onClick={() => setSub('compose')}>
                合成
              </div>
              <span className="hint" style={{ marginLeft: 'auto' }}>“{query}”</span>
            </div>
          ) : (
            <div className="chip-row" style={{ paddingTop: 2 }}>
              {STICKER_HOT_KEYWORDS.map((k) => (
                <span key={k} className="chip" onClick={() => doSearch(k)}>
                  {k}
                </span>
              ))}
            </div>
          )}

          {loading ? (
            <div className="center" style={{ padding: '30px 0' }}>
              <Spinner size={22} />
            </div>
          ) : !query ? (
            <div className="hint center" style={{ padding: '18px 0' }}>
              输入关键词搜索，即可看到「结果」与「合成」两类表情
            </div>
          ) : sub === 'result' ? (
            renderGrid(results)
          ) : (
            <>
              <div className="hint" style={{ fontSize: 12 }}>把「{query}」合成成表情（参考微信），点击即可发送</div>
              {renderGrid(composeItems)}
            </>
          )}
        </>
      ) : null}

      {tab === 'mine' ? (
        favs.length ? (
          renderGrid(favs, { inMine: true })
        ) : (
          <div className="hint center" style={{ padding: '26px 0' }}>
            还没有添加表情{'\n'}在表情上长按即可「添加到我的添加」
          </div>
        )
      ) : null}

      {/* 长按菜单 */}
      <ActionSheet open={!!menu} onClose={() => setMenu(null)} title="表情操作" actions={menuActions()} />

      {/* 相关表情 */}
      <Sheet open={!!related?.open} onClose={() => setRelated(null)} title={`相关表情${related?.keyword ? ' · ' + related.keyword : ''}`}>
        {related?.loading ? (
          <div className="center" style={{ padding: '30px 0' }}>
            <Spinner size={22} />
          </div>
        ) : (
          renderGrid(related?.items || [])
        )}
      </Sheet>
    </div>
  );
}
