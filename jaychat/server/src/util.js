// 统一时间戳格式化：全部场景使用 YYYY-MM-DD HH:mm:ss（24 小时制）
export function formatTime(ts) {
  const d = new Date(Number(ts) || Date.now());
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

// 该昵称第一个字的首字母（ASCII 直接大写；中文用拼音首字母表近似）
export function initialOf(name) {
  if (!name) return '#';
  const ch = String(name).trim().charAt(0);
  if (/[a-zA-Z]/.test(ch)) return ch.toUpperCase();
  if (/[0-9]/.test(ch)) return '#';
  return PY_FIRST[ch] ? PY_FIRST[ch].toUpperCase() : '#';
}

// 常用汉字拼音首字母表（服务端仅用于兜底，前端使用 pinyin-pro 更准确）
const PY_FIRST = {
  阿: 'a', 爱: 'a', 安: 'a', 白: 'b', 百: 'b', 包: 'b', 宝: 'b', 北: 'b', 贝: 'b', 边: 'b',
  冰: 'b', 波: 'b', 陈: 'c', 程: 'c', 赤: 'c', 春: 'c', 崔: 'c', 大: 'd', 代: 'd', 戴: 'd',
  丹: 'd', 丁: 'd', 东: 'd', 冬: 'd', 董: 'd', 杜: 'd', 段: 'd', 方: 'f', 房: 'f', 飞: 'f',
  冯: 'f', 付: 'f', 傅: 'f', 高: 'g', 甘: 'g', 刚: 'g', 郭: 'g', 韩: 'h', 郝: 'h', 何: 'h',
  和: 'h', 洪: 'h', 侯: 'h', 胡: 'h', 花: 'h', 华: 'h', 黄: 'h', 慧: 'h', 红: 'h', 江: 'j',
  姜: 'j', 蒋: 'j', 焦: 'j', 金: 'j', 靳: 'j', 景: 'j', 孔: 'k', 康: 'k', 柯: 'k', 赖: 'l',
  蓝: 'l', 郎: 'l', 雷: 'l', 冷: 'l', 黎: 'l', 李: 'l', 梁: 'l', 林: 'l', 凌: 'l', 刘: 'l',
  柳: 'l', 龙: 'l', 卢: 'l', 陆: 'l', 吕: 'l', 罗: 'l', 马: 'm', 麦: 'm', 毛: 'm', 孟: 'm',
  苗: 'm', 莫: 'm', 苗: 'm', 倪: 'n', 牛: 'n', 欧: 'o', 潘: 'p', 庞: 'p', 彭: 'p', 平: 'p',
  齐: 'q', 钱: 'q', 乔: 'q', 秦: 'q', 邱: 'q', 秋: 'q', 曲: 'q', 任: 'r', 荣: 'r', 阮: 'r',
  沙: 's', 商: 's', 邵: 's', 沈: 's', 盛: 's', 石: 's', 史: 's', 舒: 's', 宋: 's', 苏: 's',
  孙: 's', 唐: 't', 陶: 't', 田: 't', 童: 't', 涂: 't', 汪: 'w', 王: 'w', 韦: 'w', 卫: 'w',
  魏: 'w', 温: 'w', 文: 'w', 翁: 'w', 吴: 'w', 伍: 'w', 武: 'w', 席: 'x', 夏: 'x', 向: 'x',
  肖: 'x', 谢: 'x', 辛: 'x', 邢: 'x', 熊: 'x', 徐: 'x', 许: 'x', 薛: 'x', 严: 'y', 言: 'y',
  颜: 'y', 杨: 'y', 姚: 'y', 叶: 'y', 易: 'y', 殷: 'y', 尹: 'y', 应: 'y', 于: 'y', 余: 'y',
  俞: 'y', 袁: 'y', 曾: 'z', 翟: 'z', 张: 'z', 章: 'z', 赵: 'z', 郑: 'z', 钟: 'z', 周: 'z',
  朱: 'z', 祝: 'z', 庄: 'z', 卓: 'z', 邹: 'z', 左: 'z', 杰: 'j', 同: 't', 学: 'x', 小: 'x',
  明: 'm', 亮: 'l', 阳: 'y', 月: 'y', 星: 'x', 云: 'y', 风: 'f', 雨: 'y', 雪: 'x', 林: 'l',
};
