/* ============ 预设头像：用 emoji 生成渐变 SVG DataURL（离线可用） ============ */
const GRADS = [
  ['#5b9dff', '#3b6dff'], ['#7a5cff', '#5236e8'], ['#ff7a8a', '#e8435f'],
  ['#2fd07b', '#12a05c'], ['#ffb020', '#f08a00'], ['#3ad0e0', '#1a9dbf'],
  ['#ff8fd0', '#e0559f'], ['#8f9bff', '#5f6ae0'],
];

export function makeEmojiAvatar(emoji, idx = 0) {
  const [a, b] = GRADS[idx % GRADS.length];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/></linearGradient></defs><rect width="256" height="256" rx="72" fill="url(#g)"/><text x="128" y="172" font-size="128" text-anchor="middle">${emoji}</text></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

export const PRESET_EMOJIS = ['😎', '🐱', '🐶', '🦊', '🐼', '🐯', '🦁', '🐸', '🐵', '🦄', '🐬', '🐳', '🦋', '🌙', '⭐', '🔥', '🍀', '🎧', '🎮', '🚀', '💎', '🌸', '🍕', '⚡'];

export const PRESET_AVATARS = PRESET_EMOJIS.map((e, i) => ({ emoji: e, url: makeEmojiAvatar(e, i) }));

/** 根据 emoji 是否在列表中返回索引（用于高亮） */
export function presetIndex(url) {
  return PRESET_AVATARS.findIndex((p) => p.url === url);
}
