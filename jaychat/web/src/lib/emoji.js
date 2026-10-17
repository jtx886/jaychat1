/* ============ 表情数据：普通 emoji（分类）+ 动画表情（大数据表情包接入） ============ */

export const EMOJI_CATEGORIES = [
  {
    key: 'common',
    name: '常用',
    icon: '⭐',
    emojis: '😀 😂 🤣 😊 😍 🥰 😎 🤔 😅 😭 😡 🥺 😴 🤯 👍 👏 🙏 ❤️ 🔥 🎉 💪 🤝 ✌️ 👌 🫶 💯 ✨ 🌹 🍀 ☕ 🍺 😜 😇 🤗 🫡 🤩 🥳 😏 😐 😬'.split(' '),
  },
  {
    key: 'face',
    name: '表情',
    icon: '😊',
    emojis: '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😜 😝 😛 🤑 🤗 🤭 🫢 🫣 🤔 🤐 🤨 😐 😑 😶 😏 😒 🙄 😬 😮‍💨 🤥 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 🤯 🤠 🥳 🥺 🥹 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 💀 💩 🤡 👻 👽 🤖 🎃'.split(' '),
  },
  {
    key: 'hand',
    name: '手势',
    icon: '👍',
    emojis: '👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝 🙏 ✍️ 💪 🦾 🖖 🫱 🫲 🫳 🫴'.split(' '),
  },
  {
    key: 'animal',
    name: '动物',
    icon: '🐶',
    emojis: '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐒 🐔 🐧 🐦 🐤 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🪱 🐛 🦋 🐌 🐞 🐜 🪰 🐢 🐍 🦎 🦂 🦀 🦑 🐙 🦐 🐡 🐠 🐟 🐬 🐳 🦈 🐊 🐅 🐆 🦓 🦍 🦧 🐘 🦛 🦏 🐪 🐫 🦒 🦘 🐃 🐂 🐄 🐎 🐖 🐏 🐑 🦙 🐐 🦌 🐕 🐩 🦮 🐈 🐈‍⬛ 🪶 🐓 🦃 🦚 🦜 🦢 🕊️ 🐇 🦝 🦨 🦡 🦫 🦦 🦥 🐁 🐀 🐿️ 🦔'.split(' '),
  },
  {
    key: 'food',
    name: '食物',
    icon: '🍔',
    emojis: '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🥒 🌶️ 🫑 🌽 🥕 🫒 🧄 🧅 🥔 🍠 🥐 🥯 🍞 🥖 🥨 🧂 🥞 🧈 🧇 🥓 🥩 🍗 🍖 🦴 🌭 🍔 🍟 🍕 🥪 🥙 🧆 🌮 🌯 🫔 🥗 🥘 🫕 🥫 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🦪 🍤 🍙 🍚 🍘 🍥 🥠 🥮 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🌰 🥜 🍯 🥛 🍼 🫖 ☕ 🍵 🧃 🥤 🧋 🍶 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🧉 🍾'.split(' '),
  },
  {
    key: 'activity',
    name: '活动',
    icon: '⚽',
    emojis: '⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🪀 🏓 🏸 🏒 🏑 🥍 🏏 🪃 🥅 ⛳ 🪁 🏹 🎣 🤿 🥊 🥋 🎽 🛹 🛼 🛷 ⛸️ 🥌 🎿 ⛷️ 🏂 🪂 🏋️ 🤼 🤸 ⛹️ 🤺 🤾 🏌️ 🏇 🧘 🏄 🏊 🤽 🚣 🧗 🚵 🚴 🏆 🥇 🥈 🥉 🏅 🎖️ 🏵️ 🎗️ 🎫 🎟️ 🎪 🤹 🎭 🩰 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🎷 🎺 🎸 🪕 🎻 🎲 ♟️ 🎯 🎳 🎮 🎰 🧩'.split(' '),
  },
  {
    key: 'travel',
    name: '旅行',
    icon: '✈️',
    emojis: '🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🦯 🦽 🦼 🛴 🚲 🛵 🏍️ 🛺 🚨 🚔 🚍 🚘 🚖 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🛩️ 💺 🛰️ 🚀 🛸 🚁 🛶 ⛵ 🚤 🛥️ 🛳️ ⛴️ 🚢 ⚓ ⛽ 🚧 🚦 🚥 🚏 🗺️ 🗿 🗽 🗼 🏰 🏯 🏟️ 🎡 🎢 🎠 ⛲ ⛱️ 🏖️ 🏝️ 🏜️ 🌋 🏔️ ⛰️ 🏕️ 🏡 🏠 🏘️ 🏚️ 🏗️ 🏭 🏢 🏬 🏣 🏤 🏥 🏦 🏨 🏪 🏫 🏩 💒 🏛️ ⛪ 🕌 🕍 🛕 🕋 ⛩️ 🛤️ 🛣️ 🗾 🎑 🏞️ 🌅 🌄 🌠 🎇 🎆 🌇 🌆 🏙️ 🌃 🌌 🌉 🌁'.split(' '),
  },
  {
    key: 'object',
    name: '物品',
    icon: '💡',
    emojis: '⌚ 📱 💻 ⌨️ 🖥️ 🖨️ 🖱️ 🖲️ 🕹️ 🗜️ 💽 💾 💿 📀 📼 📷 📸 📹 🎥 📽️ 🎞️ 📞 ☎️ 📟 📠 📺 📻 🎙️ 🎚️ 🎛️ 🧭 ⏱️ ⏲️ ⏰ 🕰️ ⌛ ⏳ 📡 🔋 🔌 💡 🔦 🕯️ 🪔 🧯 🛢️ 💸 💵 💴 💶 💷 🪙 💰 💳 💎 ⚖️ 🪜 🧰 🛠️ ⚒️ 🔧 🔨 ⚙️ 🧱 ⛏️ 🔩 🪛 🔗 ⛓️ 🧲 🔫 💣 🧨 🪓 🔪 🗡️ ⚔️ 🛡️ 🚬 ⚰️ 🪦 🏺 🔮 📿 🧿 💈 ⚗️ 🔭 🔬 🕳️ 🩹 🩺 💊 💉 🩸 🧬 🦠 🧫 🧪 🌡️ 🧹 🧺 🧻 🚽 🚰 🚿 🛁 🛀 🧼 🪥 🪒 🧽 🪣 🧴 🛎️ 🔑 🗝️ 🚪 🪑 🛋️ 🛏️ 🛌 🧸 🪆 🖼️ 🪞 🪟 🛍️ 🛒 🎁 🎈 🎏 🎀 🪄 🪅 🎊 🎉 🎎 🏮 🎐 🧧 ✉️ 📩 📨 📧 💌 📥 📤 📦 🏷️ 🪧 📪 📫 📬 📭 📮 📯 📜 📃 📄 📑 🧾 📊 📈 📉 🗒️ 🗓️ 📆 📅 🗑️ 📇 🗃️ 🗳️ 🗄️ 📋 📁 📂 🗂️ 🗞️ 📰 📓 📔 📒 📕 📗 📘 📙 📚 📖 🔖 🧷 🔗 📎 🖇️ 📐 📏 🧮 📌 📍 ✂️ 🖊️ 🖋️ ✒️ 🖌️ 🖍️ 📝 ✏️ 🔍 🔎 🔏 🔐 🔒 🔓'.split(' '),
  },
  {
    key: 'symbol',
    name: '符号',
    icon: '❤️',
    emojis: '❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ♥️ ♦️ ♣️ ♠️ 🃏 🎴 🀄 🕐 🕑 🕒 🕓 🕔 🕕 🕖 🕗 🕘 🕙 🕚 🕛 🔴 🟠 🟡 🟢 🔵 🟣 🟤 ⚫ ⚪ 🟥 🟧 🟨 🟩 🟦 🟪 🟫 ⬛ ⬜ ◼️ ◻️ ▪️ ▫️ 🔶 🔷 🔸 🔹 🔺 🔻 💠 🔘 🔳 🔲 ✅ ☑️ ✔️ ❌ ❎ ➕ ➖ ➗ ✖️ 🟰 ♾️ 💲 💱 ™️ ©️ ®️ 〰️ ➰ ➿ 🔚 🔙 🔛 🔝 🔜 🔃 🔄 🔙 ⏩ ⏪ ⏫ ⏬ 🔀 🔁 🔂 ▶️ ⏸️ ⏹️ ⏺️ ⏭️ ⏮️ ⏯️ 🔅 🔆 📶 🎦 🎯 ⚡ 🔥 💥 💫 💦 💨 🕳️ 💬 💭 🗯️ ♨️ 💤 💢 💢 🔕 🔔 🔔 🎵 🎶 🎼 ☢️ ☣️ ⚠️ 🚸 🔱 ⚜️ 🔰 ♻️ ✅ 🈂️ 🈷️ 🈶 🈯 🉐 🈹 🈚 🈲 🉑 🈸 🈴 🈳 ㊗️ ㊙️ 🈺 🈵 🔴 🟠 🟡 🟢'.split(' '),
  },
];

/** 动画表情包（内置动画贴纸；同时支持从远端数据源扩充） */
export const STICKERS = [
  { id: 's1', emoji: '😂', anim: 'bounce', label: '笑哭' },
  { id: 's2', emoji: '🤣', anim: 'spin', label: '打滚' },
  { id: 's3', emoji: '😭', anim: 'shake', label: '大哭' },
  { id: 's4', emoji: '🥰', anim: 'pulse', label: '心心' },
  { id: 's5', emoji: '😡', anim: 'shakeY', label: '生气' },
  { id: 's6', emoji: '👍', anim: 'pop', label: '点赞' },
  { id: 's7', emoji: '🎉', anim: 'swing', label: '庆祝' },
  { id: 's8', emoji: '❤️', anim: 'beat', label: '爱心' },
  { id: 's9', emoji: '🤯', anim: 'zoom', label: '震惊' },
  { id: 's10', emoji: '😴', anim: 'float', label: '睡了' },
  { id: 's11', emoji: '🙏', anim: 'wobble', label: '拜托' },
  { id: 's12', emoji: '🐶', anim: 'jelly', label: '小狗' },
  { id: 's13', emoji: '🍺', anim: 'swing', label: '干杯' },
  { id: 's14', emoji: '🤝', anim: 'bounce', label: '握手' },
  { id: 's15', emoji: '💰', anim: 'rainbow', label: '搞钱' },
  { id: 's16', emoji: '🤖', anim: 'jelly', label: '机器人' },
];

export const ANIM_CLASS = {
  bounce: 'anim-bounce',
  spin: 'anim-spin',
  shake: 'anim-shake',
  pulse: 'anim-pulse',
  shakeY: 'anim-shakeY',
  pop: 'anim-pop',
  swing: 'anim-swing',
  beat: 'anim-beat',
  zoom: 'anim-zoom',
  float: 'anim-float',
  wobble: 'anim-wobble',
  jelly: 'anim-jelly',
  rainbow: 'anim-rainbow',
};

/** 贴纸消息编码：stu|<anim>|<emoji> */
export const encodeSticker = (s) => `stu|${s.anim}|${s.emoji}`;
export function parseSticker(text) {
  if (typeof text !== 'string' || !text.startsWith('stu|')) return null;
  const [, anim, emoji] = text.split('|');
  return { anim, emoji };
}

/** 远端动画表情包数据源（可选接入，失败自动回退内置） */
export async function fetchRemoteStickers() {
  const feed = import.meta.env.VITE_STICKER_FEED;
  if (!feed) return [];
  try {
    const res = await fetch(feed);
    const data = await res.json();
    const arr = Array.isArray(data) ? data : data.stickers || [];
    return arr
      .filter((x) => x && (x.url || x.emoji))
      .slice(0, 60)
      .map((x, i) => ({
        id: 'r' + i,
        url: x.url || '',
        emoji: x.emoji || '',
        anim: x.anim || 'jelly',
        label: x.label || '',
      }));
  } catch {
    return [];
  }
}
