import React, { useState } from 'react';
import { EMOJI_CATEGORIES, STICKER_PACKS, encodeSticker, parseSticker } from '../lib/emoji.js';
import { Icon } from './icons.jsx';
import { TgsSticker, hasArt } from './Sticker.jsx';

/** 渲染聊天消息里的贴纸 */
export function StickerView({ text, small }) {
  const s = parseSticker(text);
  if (!s) return null;
  if (s.art && hasArt(s.art)) return <TgsSticker art={s.art} size={small ? 'md' : 'lg'} />;
  if (s.emoji) {
    return <span style={{ fontSize: small ? 34 : 56, lineHeight: 1.1 }}>{s.emoji}</span>;
  }
  return null;
}

export default function EmojiPanel({ onEmoji, onSticker }) {
  const [tab, setTab] = useState('normal'); // normal | anim
  const [cat, setCat] = useState(EMOJI_CATEGORIES[0].key);
  const [pack, setPack] = useState(STICKER_PACKS[0].key);

  const current = EMOJI_CATEGORIES.find((c) => c.key === cat) || EMOJI_CATEGORIES[0];
  const currentPack = STICKER_PACKS.find((p) => p.key === pack) || STICKER_PACKS[0];

  return (
    <div className="emoji-panel">
      <div className="emoji-tabs">
        <div className={'emoji-tab' + (tab === 'normal' ? ' active' : '')} onClick={() => setTab('normal')}>
          <Icon name="smile" size={15} strokeWidth={1.9} /> 普通表情
        </div>
        <div className={'emoji-tab' + (tab === 'anim' ? ' active' : '')} onClick={() => setTab('anim')}>
          <Icon name="sparkle" size={15} strokeWidth={1.9} /> 动画表情包
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
                <Icon name={p.icon} size={14} strokeWidth={1.9} /> {p.name}
              </div>
            ))}
          </div>
          <div className="emoji-grid anim">
            {currentPack.items.map((s) => (
              <button key={s.id} className="sticker-cell" onClick={() => onSticker(encodeSticker(s))} title={s.label}>
                <TgsSticker art={s.art} size="fill" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
