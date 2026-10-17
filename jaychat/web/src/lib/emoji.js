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

/* ============ 动画表情包：微信 / QQ 同款大数据表情包（多套分组） ============ */
const PACK_DEFS = [
  {
    key: 'wechat',
    name: '微信经典',
    icon: '💬',
    faces: [
      ['😊', '微笑', 'bounce'], ['😍', '色', 'pulse'], ['😏', '得意', 'swing'],
      ['😢', '流泪', 'float'], ['😁', '呲牙', 'pop'], ['😭', '大哭', 'shake'],
      ['😡', '发怒', 'shakeY'], ['😎', '酷', 'wobble'], ['🤭', '偷笑', 'jelly'],
      ['🤔', '疑问', 'zoom'], ['😱', '惊恐', 'shakeY'], ['😴', '睡', 'float'],
      ['😪', '困', 'jelly'], ['😰', '冷汗', 'shake'], ['🤤', '饥饿', 'beat'],
      ['😅', '尴尬', 'bounce'], ['💀', '骷髅', 'spin'], ['👏', '鼓掌', 'pop'],
      ['🙏', '抱拳', 'wobble'], ['👍', '强', 'bounce'], ['👎', '弱', 'shakeY'],
      ['💪', '奋斗', 'beat'], ['🤝', '握手', 'bounce'], ['🍺', '啤酒', 'swing'],
    ],
  },
  {
    key: 'qq',
    name: 'QQ 表情',
    icon: '🐧',
    faces: [
      ['😜', '调皮', 'swing'], ['😝', '吐舌', 'jelly'], ['🙄', '白眼', 'spin'],
      ['😤', '傲慢', 'shakeY'], ['🤬', '咒骂', 'shake'], ['😈', '阴险', 'pulse'],
      ['😘', '亲亲', 'beat'], ['🥺', '委屈', 'float'], ['😖', '折磨', 'shake'],
      ['😨', '吓', 'zoom'], ['😞', '衰', 'float'], ['🔨', '敲打', 'swing'],
      ['🍉', '西瓜', 'bounce'], ['🏀', '篮球', 'bounce'], ['⚽', '足球', 'spin'],
      ['🐷', '猪头', 'jelly'], ['🌹', '玫瑰', 'pulse'], ['🎁', '礼物', 'pop'],
      ['❤️', '爱心', 'beat'], ['💔', '心碎', 'shake'], ['⚡', '闪电', 'zoom'],
      ['🤗', '拥抱', 'jelly'], ['✌️', '胜利', 'swing'], ['👊', '拳头', 'bounce'],
    ],
  },
  {
    key: 'fun',
    name: '搞怪',
    icon: '🤪',
    faces: [
      ['💩', '便便', 'jelly'], ['🤡', '小丑', 'spin'], ['👻', '鬼魂', 'float'],
      ['👽', '外星人', 'pulse'], ['🤖', '机器人', 'jelly'], ['🐔', '小鸡', 'swing'],
      ['🦄', '独角兽', 'rainbow'], ['🐸', '青蛙', 'bounce'], ['🙈', '捂眼', 'shakeY'],
      ['🤪', '疯狂', 'swing'], ['🤠', '牛仔', 'wobble'], ['🥳', '派对', 'pop'],
      ['🎉', '撒花', 'swing'], ['🎆', '烟花', 'rainbow'], ['💣', '炸弹', 'zoom'],
      ['🚀', '火箭', 'float'], ['🍄', '蘑菇', 'pop'], ['🧁', '纸杯蛋糕', 'beat'],
    ],
  },
  {
    key: 'animal',
    name: '萌宠',
    icon: '🐼',
    faces: [
      ['🐼', '熊猫', 'jelly'], ['🐨', '考拉', 'float'], ['🦊', '狐狸', 'swing'],
      ['🐯', '老虎', 'shakeY'], ['🐵', '猴子', 'bounce'], ['🐰', '兔子', 'pop'],
      ['🐻', '熊', 'wobble'], ['🦁', '狮子', 'shake'], ['🐮', '奶牛', 'pulse'],
      ['🐙', '章鱼', 'jelly'], ['🦀', '螃蟹', 'swing'], ['🐢', '乌龟', 'float'],
      ['🦋', '蝴蝶', 'swing'], ['🐝', '蜜蜂', 'zoom'], ['🐬', '海豚', 'bounce'],
      ['🐶', '小狗', 'bounce'], ['🐱', '猫咪', 'pulse'], ['🐧', '企鹅', 'wobble'],
    ],
  },
  {
    key: 'daily',
    name: '日常',
    icon: '☕',
    faces: [
      ['☕', '咖啡', 'swing'], ['🍜', '面条', 'jelly'], ['🍔', '汉堡', 'bounce'],
      ['🍕', '披萨', 'pop'], ['🍰', '蛋糕', 'beat'], ['🍦', '冰淇淋', 'pulse'],
      ['🎮', '游戏', 'shake'], ['🎧', '耳机', 'swing'], ['📱', '手机', 'wobble'],
      ['💰', '搞钱', 'rainbow'], ['💸', '飞钱', 'bounce'], ['🎯', '靶心', 'zoom'],
      ['🏆', '奖杯', 'pop'], ['🔥', '火苗', 'pulse'], ['✨', '闪光', 'rainbow'],
      ['🎵', '音符', 'swing'], ['🌈', '彩虹', 'rainbow'], ['🍀', '幸运草', 'swing'],
    ],
  },
];

export const STICKER_PACKS = PACK_DEFS.map((p) => ({
  key: p.key,
  name: p.name,
  icon: p.icon,
  items: p.faces.map(([emoji, label, anim], i) => ({ id: `${p.key}-${i}`, emoji, label, anim })),
}));

/** 全量动画贴纸（供聊天消息渲染 / 汇总展示） */
export const STICKERS = STICKER_PACKS.flatMap((p) => p.items);

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
