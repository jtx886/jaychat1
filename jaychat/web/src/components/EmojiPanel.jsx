import React, { useEffect, useState } from 'react';
import { EMOJI_CATEGORIES, STICKER_PACKS, ANIM_CLASS, encodeSticker, parseSticker, fetchRemoteStickers } from '../lib/emoji.js';

/** 渲染贴纸（聊天消息里使用） */
export function StickerView({ text, small }) {
  const s = parseSticker(text);
  if (!s) return null;
  return (
    <span className={'sticker-view' + (small ? ' sm' : '') + ' ' + (ANIM_CLASS[s.anim] || 'anim-jelly')}>
      {s.emoji}
    </span>
  );
}

export default function EmojiPanel({ onEmoji, onSticker }) {
  const [tab, setTab] = useState('normal'); // normal | anim
  const [cat, setCat] = useState(EMOJI_CATEGORIES[0].key);
  const [pack, setPack] = useState(STICKER_PACKS[0].key);
  const [remote, setRemote] = useState([]);

  useEffect(() => {
    let alive = true;
    fetchRemoteStickers().then((list) => {
      if (alive) setRemote(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  const current = EMOJI_CATEGORIES.find((c) => c.key === cat) || EMOJI_CATEGORIES[0];
  const currentPack = STICKER_PACKS.find((p) => p.key === pack) || STICKER_PACKS[0];

  return (
    <div className="emoji-panel">
      <div className="emoji-tabs">
        <div className={'emoji-tab' + (tab === 'normal' ? ' active' : '')} onClick={() => setTab('normal')}>
          😀 普通表情
        </div>
        <div className={'emoji-tab' + (tab === 'anim' ? ' active' : '')} onClick={() => setTab('anim')}>
          🎬 动画表情包
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
                {c.icon} {c.name}
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
      ) : (
        <>
          <div className="emoji-tabs" style={{ overflowX: 'auto', paddingBottom: 2 }}>
            {STICKER_PACKS.map((p) => (
              <div
                key={p.key}
                className={'emoji-tab' + (pack === p.key ? ' active' : '')}
                onClick={() => setPack(p.key)}
                style={{ flex: '0 0 auto', padding: '6px 11px' }}
              >
                {p.icon} {p.name}
              </div>
            ))}
          </div>
          <div className="emoji-grid anim">
            {currentPack.items.map((s) => (
              <button key={s.id} className="sticker-cell" onClick={() => onSticker(encodeSticker(s))} title={s.label}>
                <span className={'sticker-view sm ' + (ANIM_CLASS[s.anim] || 'anim-jelly')} style={{ display: 'block', textAlign: 'center' }}>
                  {s.emoji}
                </span>
              </button>
            ))}
            {remote.map((s) => (
              <button key={s.id} className="sticker-cell" onClick={() => onSticker(`stu|${s.anim}|${s.emoji || '✨'}`)}>
                {s.url ? (
                  <img src={s.url} alt={s.label} />
                ) : (
                  <span className={'sticker-view sm ' + (ANIM_CLASS[s.anim] || 'anim-jelly')} style={{ display: 'block', textAlign: 'center' }}>
                    {s.emoji}
                  </span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
