/* ============ 预设头像：纯 SVG 矢量绘制 + 渐变色（离线可用，无 emoji 依赖） ============ */
const GRADS = [
  ['#5b9dff', '#3b6dff'], ['#7a5cff', '#5236e8'], ['#ff7a8a', '#e8435f'],
  ['#2fd07b', '#12a05c'], ['#ffb020', '#f08a00'], ['#3ad0e0', '#1a9dbf'],
  ['#ff8fd0', '#e0559f'], ['#8f9bff', '#5f6ae0'],
];

/* 每个字形都在 100×100 视窗内居中绘制（白色描边 / 填充） */
const GLYPHS = {
  star: '<path d="M50 18l9 20.6 22.3 2.7-16.2 15.1 4.4 22.1L50 68.1 30.5 78.5l4.4-22.1-16.2-15.1L41 38.6z"/>',
  moon: '<path d="M63 20a31 31 0 1 0 16 42 26 26 0 0 1-16-42z"/>',
  flame: '<path d="M50 18c10 12 17 20 17 30a17 17 0 0 1-34 0c0-8 6-15 11-20 1 4 3 6 6 7 0-6-1-12 0-17z"/>',
  heart: '<path d="M50 80C27 63 19 49 25 38c5-10 18-11 25-2 7-9 20-8 25 2 6 11-2 25-25 42z"/>',
  bolt: '<path d="M57 14L25 57h21l-7 29 33-44H51z"/>',
  clover: '<circle cx="50" cy="34" r="13"/><circle cx="33" cy="52" r="13"/><circle cx="67" cy="52" r="13"/><circle cx="50" cy="54" r="11"/><path d="M48.5 60h3v24h-3z"/>',
  gem: '<path d="M50 18l21 15 12 17-33 34-33-34 12-17z"/><path d="M50 18l21 15H29z" fill="#000" opacity=".18"/><path d="M50 50l20-17 13 17-33 34z" fill="#000" opacity=".14"/>',
  flower: '<circle cx="50" cy="28" r="12"/><circle cx="71" cy="44" r="12"/><circle cx="63" cy="68" r="12"/><circle cx="37" cy="68" r="12"/><circle cx="29" cy="44" r="12"/><circle cx="50" cy="50" r="8" fill="#ffe9a8"/>',
  butterfly: '<path d="M50 46C44 30 26 22 18 30s-2 26 12 30c-10 5-13 17-5 23 8 6 22-2 25-15z"/><path d="M50 46c6-16 24-24 32-16s2 26-12 30c10 5 13 17 5 23-8 6-22-2-25-15z"/><ellipse cx="50" cy="54" rx="4.5" ry="24"/>',
  rocket: '<path d="M34 58l-11 15h11z"/><path d="M66 58l11 15H66z"/><path d="M50 16c11 8 16 19 16 30v13H34V46c0-11 5-22 16-30z"/><circle cx="50" cy="44" r="7" fill="#000" opacity=".22"/>',
  cat: '<path d="M32 42l-3-17 15 9z"/><path d="M68 42l3-17-15 9z"/><circle cx="50" cy="56" r="24"/><circle cx="42" cy="54" r="3.4" fill="#000" opacity=".3"/><circle cx="58" cy="54" r="3.4" fill="#000" opacity=".3"/><path d="M50 62l-3.4 3.4h6.8z" fill="#000" opacity=".3"/>',
  dog: '<ellipse cx="33" cy="48" rx="9" ry="17" transform="rotate(-18 33 48)"/><ellipse cx="67" cy="48" rx="9" ry="17" transform="rotate(18 67 48)"/><circle cx="50" cy="54" r="22"/><ellipse cx="50" cy="65" rx="12" ry="9" fill="#000" opacity=".2"/>',
};

const PRESET_DEFS = [
  ['cat', 0], ['dog', 1], ['star', 4], ['moon', 1],
  ['flame', 2], ['heart', 2], ['bolt', 4], ['clover', 3],
  ['gem', 5], ['flower', 6], ['butterfly', 7], ['rocket', 0],
];

export function makeVectorAvatar(glyph, idx = 0) {
  const [a, b] = GRADS[idx % GRADS.length];
  const body = GLYPHS[glyph] || GLYPHS.star;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/></linearGradient></defs><rect width="256" height="256" rx="72" fill="url(#g)"/><g transform="translate(20 20) scale(2.16)" fill="#ffffff" fill-opacity="0.95">${body}</g></svg>`;
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
}

export const PRESET_AVATARS = PRESET_DEFS.map(([glyph, grad]) => ({
  id: glyph,
  glyph,
  url: makeVectorAvatar(glyph, grad),
}));

/** 根据头像 URL 返回预设索引（用于高亮） */
export function presetIndex(url) {
  return PRESET_AVATARS.findIndex((p) => p.url === url);
}
