import React from 'react';

/* ============================================================================
 * Telegram 同款动画表情包
 * 全部为内联 SVG + CSS 逐帧动画（动画规则见 styles.css 的 .tgs-* 段落）
 * 零外部图片 / 字体依赖，可在离线环境与安卓 WebView 内直接播放
 * ========================================================================== */

const ART = {
  /* 心跳 */
  beat: (
    <g className="tg-core">
      <defs>
        <linearGradient id="tgsBeat" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff93b0" />
          <stop offset="1" stopColor="#e5245a" />
        </linearGradient>
      </defs>
      <path d="M50 84C24 64 14 47 21 34c6-11 20-13 29-3 9-10 23-8 29 3 7 13-3 30-29 50z" fill="url(#tgsBeat)" />
      <ellipse cx="35" cy="42" rx="8" ry="5.5" fill="#fff" opacity=".45" transform="rotate(-30 35 42)" />
      <g fill="#ffd36e">
        <path className="tg-spark" d="M20 26l2.4 4.8 4.8 2.4-4.8 2.4-2.4 4.8-2.4-4.8-4.8-2.4 4.8-2.4z" />
        <path className="tg-spark" style={{ animationDelay: '.45s' }} d="M82 34l1.8 3.6 3.6 1.8-3.6 1.8-1.8 3.6-1.8-3.6-3.6-1.8 3.6-1.8z" />
      </g>
    </g>
  ),

  /* 火焰 */
  fire: (
    <>
      <path d="M22 86h56a6 6 0 1 0 0-12H22a6 6 0 1 0 0 12z" fill="#8b5a32" />
      <g className="tg-fl2">
        <path d="M50 14c7 13 21 21 21 39 0 13-9 23-21 23s-21-10-21-23c0-18 14-26 21-39z" fill="#ff9126" />
      </g>
      <g className="tg-fl1">
        <path d="M50 30c4 9 13 15 13 27 0 9-6 16-13 16s-13-7-13-16c0-12 9-18 13-27z" fill="#ffdf3d" />
      </g>
    </>
  ),

  /* 撒花 */
  party: (
    <>
      <g className="tg-body">
        <path d="M20 82l5-30 28 8z" fill="#7a5cff" />
        <path d="M20 82l5-30 8 2-2 28z" fill="#9b86ff" />
        <circle cx="28" cy="72" r="3" fill="#fff" opacity=".35" />
      </g>
      <g className="tg-c1" style={{ '--tx': '10px', '--ty': '-30px' }}>
        <rect x="30" y="44" width="8" height="8" rx="2.4" fill="#ff5d8f" transform="rotate(20 34 48)" />
      </g>
      <g className="tg-c2" style={{ '--tx': '36px', '--ty': '-20px' }}>
        <circle cx="36" cy="50" r="4.4" fill="#35c6ff" />
      </g>
      <g className="tg-c3" style={{ '--tx': '20px', '--ty': '-46px' }}>
        <path d="M44 40l5 8h-10z" fill="#ffd36e" />
      </g>
      <g className="tg-c2" style={{ '--tx': '54px', '--ty': '-4px' }}>
        <circle cx="42" cy="56" r="3.6" fill="#3ddc84" />
      </g>
      <g className="tg-c1" style={{ '--tx': '-8px', '--ty': '-42px' }}>
        <path d="M34 58l3.4 6h-6.8z" fill="#ff9d00" />
      </g>
      <path d="M64 28l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" fill="#ffd36e" opacity=".9" />
      <path d="M78 54l1.6 3.2 3.2 1.6-3.2 1.6-1.6 3.2-1.6-3.2-3.2-1.6 3.2-1.6z" fill="#35c6ff" opacity=".9" />
    </>
  ),

  /* 点赞 */
  thumb: (
    <>
      <g className="tg-core">
        <defs>
          <linearGradient id="tgsThumb" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffd95e" />
            <stop offset="1" stopColor="#f5a623" />
          </linearGradient>
        </defs>
        <rect x="18" y="46" width="22" height="36" rx="10" fill="#f5a623" />
        <path d="M44 82V44c0-11 5-19 13-19 5 0 8 4 7.4 9l-3 12h16c6.5 0 10.5 5.4 8.6 11.6l-5 16.4c-1.6 5.4-6.4 9-12 9H52z" fill="url(#tgsThumb)" />
        <path d="M50 44c0-9 4-15 10-15-4 3-6 8-6 15z" fill="#fff" opacity=".35" />
      </g>
      <g fill="#ffd36e">
        <path className="tg-spark" d="M82 22l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" />
      </g>
    </>
  ),

  /* 大笑 */
  laugh: (
    <>
      <g className="tg-core">
        <circle cx="50" cy="52" r="34" fill="#ffce3a" />
        <path d="M24 45c5-7 13-7 17 0M59 45c5-7 13-7 17 0" fill="none" stroke="#3d2c00" strokeWidth="4.4" strokeLinecap="round" />
        <path d="M30 56a20 20 0 0 0 40 0z" fill="#3d2c00" />
        <path d="M37 59h26a13 13 0 0 1-26 0z" fill="#fff" opacity=".92" />
        <ellipse cx="50" cy="74" rx="7" ry="4.4" fill="#ff7aa2" />
      </g>
      <g fill="#5cc8ff">
        <path className="tg-tear" d="M20 48c0 0 6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" />
        <path className="tg-tear" style={{ animationDelay: '.5s' }} d="M80 48c0 0 6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z" />
      </g>
    </>
  ),

  /* 大哭 */
  cry: (
    <>
      <g className="tg-core">
        <circle cx="50" cy="52" r="34" fill="#4aa8ff" />
        <ellipse cx="38" cy="47" rx="5" ry="7.5" fill="#0c2a4d" />
        <ellipse cx="62" cy="47" rx="5" ry="7.5" fill="#0c2a4d" />
        <path d="M37 68a13 13 0 0 0 26 0z" fill="#0c2a4d" />
        <ellipse cx="50" cy="79" rx="7" ry="4" fill="#ff7aa2" />
      </g>
      <g fill="#bfe8ff">
        <path className="tg-tear" d="M38 54c0 0 6 8 6 12a6 6 0 0 1-12 0c0-4 6-12 6-12z" />
        <path className="tg-tear b" d="M62 54c0 0 6 8 6 12a6 6 0 0 1-12 0c0-4 6-12 6-12z" />
      </g>
    </>
  ),

  /* 亲亲 */
  kiss: (
    <>
      <g className="tg-core">
        <circle cx="46" cy="54" r="32" fill="#ffd34d" />
        <path d="M31 48c3-5 10-5 13 0" fill="none" stroke="#5a3d00" strokeWidth="4" strokeLinecap="round" />
        <circle cx="62" cy="48" r="4.6" fill="#5a3d00" />
        <ellipse cx="44" cy="68" rx="8" ry="5.6" fill="#e0537a" />
        <path d="M78 20c-4-6-13-4-13 3 0 7 13 15 13 15s13-8 13-15c0-7-9-9-13-3z" fill="#ff5d8f" />
      </g>
      <path d="M74 44l1.8 3.6 3.6 1.8-3.6 1.8-1.8 3.6-1.8-3.6-3.6-1.8 3.6-1.8z" fill="#ff8fb0" />
    </>
  ),

  /* 闪耀 */
  star: (
    <>
      <g className="tg-core">
        <defs>
          <linearGradient id="tgsStar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffe27a" />
            <stop offset="1" stopColor="#ffab00" />
          </linearGradient>
        </defs>
        <path d="M50 10l10 23 25 3-18 17 5 25-22-12-22 12 5-25-18-17 25-3z" fill="url(#tgsStar)" />
        <path d="M50 26l5 12 13 1.6-9.6 9 2.6 13-11-6.4-11 6.4 2.6-13-9.6-9 13-1.6z" fill="#fff" opacity=".28" />
      </g>
      <g fill="#fff">
        <path className="tg-glint" d="M22 30l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" />
        <path className="tg-glint" style={{ animationDelay: '.6s' }} d="M80 34l1.8 3.6 3.6 1.8-3.6 1.8-1.8 3.6-1.8-3.6-3.6-1.8 3.6-1.8z" />
      </g>
    </>
  ),

  /* 发射 */
  rocket: (
    <>
      <g className="tg-core">
        <path d="M32 60l-11 15h15z" fill="#ff5d5d" />
        <path d="M68 60l11 15H64z" fill="#ff5d5d" />
        <path d="M50 10c13 9 19 22 19 35v15H31V45c0-13 6-26 19-35z" fill="#f2f6ff" />
        <path d="M50 10c-8 6-13 15-16 24 5 9 11 14 16 14s11-5 16-14c-3-9-8-18-16-24z" fill="#ff5d5d" />
        <circle cx="50" cy="44" r="8" fill="#7fc4ff" />
        <circle cx="47" cy="41" r="2.6" fill="#fff" opacity=".8" />
      </g>
      <g className="tg-jet">
        <path d="M50 62c7 9 10 18 0 28-10-10-7-19 0-28z" fill="#ffb02e" />
        <path d="M50 66c4 6 5 12 0 18-5-6-4-12 0-18z" fill="#ffe27a" />
      </g>
      <g className="tg-smoke">
        <circle cx="38" cy="88" r="5.5" fill="#cfd8e6" opacity=".75" />
        <circle cx="63" cy="90" r="4" fill="#cfd8e6" opacity=".6" />
      </g>
    </>
  ),

  /* 蝴蝶 */
  butterfly: (
    <>
      <defs>
        <linearGradient id="tgsBfly" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8a7bff" />
          <stop offset=".5" stopColor="#ff7ac6" />
          <stop offset="1" stopColor="#35c6ff" />
        </linearGradient>
      </defs>
      <g className="tg-core">
        <g className="tg-wingL">
          <path d="M47 46c-5-16-23-23-31-15-8 8-2 26 12 30-10 5-13 17-5 23 8 6 22-2 25-15z" fill="url(#tgsBfly)" />
          <circle cx="26" cy="46" r="4" fill="#fff" opacity=".4" />
        </g>
        <g className="tg-wingR">
          <path d="M53 46c5-16 23-23 31-15 8 8 2 26-12 30 10 5 13 17 5 23-8 6-22-2-25-15z" fill="url(#tgsBfly)" />
          <circle cx="74" cy="46" r="4" fill="#fff" opacity=".4" />
        </g>
        <ellipse cx="50" cy="55" rx="5" ry="23" fill="#4a3d78" />
        <circle cx="50" cy="30" r="6" fill="#4a3d78" />
        <path d="M47 26l-8-11M53 26l8-11" fill="none" stroke="#4a3d78" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="41" cy="16" r="2.4" fill="#4a3d78" />
        <circle cx="59" cy="16" r="2.4" fill="#4a3d78" />
      </g>
    </>
  ),

  /* 彩虹 */
  rainbow: (
    <g className="tg-core">
      <g className="tg-band" fill="none" strokeLinecap="round">
        <path d="M14 78a36 36 0 0 1 72 0" stroke="#ff5d5d" strokeWidth="9" />
        <path d="M23 78a27 27 0 0 1 54 0" stroke="#ffb02e" strokeWidth="9" />
        <path d="M32 78a18 18 0 0 1 36 0" stroke="#3ddc84" strokeWidth="9" />
        <path d="M41 78a9 9 0 0 1 18 0" stroke="#4f7bff" strokeWidth="9" />
      </g>
      <g fill="#e7eefb">
        <ellipse cx="18" cy="80" rx="15" ry="9" />
        <ellipse cx="31" cy="78" rx="11" ry="7" />
        <ellipse cx="82" cy="80" rx="15" ry="9" />
        <ellipse cx="69" cy="78" rx="11" ry="7" />
      </g>
    </g>
  ),

  /* 音乐 */
  note: (
    <>
      <g className="tg-core" fill="#7a5cff">
        <ellipse cx="32" cy="72" rx="12" ry="9" transform="rotate(-20 32 72)" />
        <ellipse cx="68" cy="64" rx="12" ry="9" transform="rotate(-20 68 64)" />
        <path d="M42 70V24l34-7v40" fill="none" stroke="#7a5cff" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
      </g>
      <g fill="#35c6ff">
        <path className="tg-up" d="M80 22l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" />
        <path className="tg-up" style={{ animationDelay: '.6s' }} d="M20 28l1.8 3.6 3.6 1.8-3.6 1.8-1.8 3.6-1.8-3.6-3.6-1.8 3.6-1.8z" />
      </g>
    </>
  ),

  /* 骷髅 */
  skull: (
    <g className="tg-core">
      <path d="M50 14c-18 0-31 13-31 30 0 12 6 20 15 25v11a6 6 0 0 0 6 6h20a6 6 0 0 0 6-6V69c9-5 15-13 15-25 0-17-13-30-31-30z" fill="#f3f6ff" />
      <ellipse className="tg-eye" cx="39" cy="47" rx="7" ry="7.5" fill="#1e2547" />
      <ellipse className="tg-eye" cx="61" cy="47" rx="7" ry="7.5" fill="#1e2547" />
      <path d="M50 58l-4.5 8h9z" fill="#1e2547" />
      <path d="M44 82v7M50 82v8M56 82v7" fill="none" stroke="#d7def0" strokeWidth="3.2" strokeLinecap="round" />
    </g>
  ),

  /* 幽灵 */
  ghost: (
    <g className="tg-core">
      <path d="M50 12C34 12 21 25 21 42v40c0 4 3 6 6 4l7-5 8 5 9-5 8 5 7-4c3-2 6 0 6 4V42C72 25 66 12 50 12z" fill="#f2f6ff" />
      <ellipse cx="39" cy="46" rx="6" ry="8" fill="#26304d" />
      <ellipse cx="61" cy="46" rx="6" ry="8" fill="#26304d" />
      <ellipse cx="50" cy="63" rx="6" ry="7" fill="#26304d" />
    </g>
  ),

  /* 爆头 */
  mind: (
    <>
      <g className="tg-core">
        <circle cx="50" cy="56" r="27" fill="#ffce3a" />
        <path d="M38 50c2-4 8-4 10 0M62 50c2-4 8-4 10 0" fill="none" stroke="#3d2c00" strokeWidth="3.6" strokeLinecap="round" />
        <path d="M40 66a11 11 0 0 0 20 0z" fill="#3d2c00" />
      </g>
      <circle className="tg-b1" cx="34" cy="24" r="6" fill="#ffb02e" />
      <circle className="tg-b2" cx="66" cy="24" r="6" fill="#ff5d8f" />
      <circle className="tg-b3" cx="50" cy="14" r="6" fill="#35c6ff" />
    </>
  ),

  /* 满分 */
  100: (
    <>
      <defs>
        <linearGradient id="tgs100" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe27a" />
          <stop offset="1" stopColor="#ff9d00" />
        </linearGradient>
      </defs>
      <circle className="tg-ring" cx="50" cy="52" r="31" fill="none" stroke="#ffd36e" strokeWidth="4" />
      <g className="tg-core">
        <text x="50" y="66" textAnchor="middle" fontSize="38" fontWeight="900" fill="url(#tgs100)" fontFamily="system-ui, -apple-system, 'Segoe UI', sans-serif">100</text>
      </g>
      <path d="M50 6l3 6 6 1-4.5 4.4 1 6.2-5.5-3-5.5 3 1-6.2L41 13l6-1z" fill="#ffd36e" />
    </>
  ),

  /* 星星眼 */
  eyes: (
    <>
      <g className="tg-core">
        <circle cx="50" cy="52" r="34" fill="#ffd34d" />
        <path d="M36 44C32 37 24 40 24 46.5 24 53 36 59 36 59s12-6 12-12.5C48 40 40 37 36 44z" fill="#ff4d6d" />
        <path d="M64 44C60 37 52 40 52 46.5 52 53 64 59 64 59s12-6 12-12.5C76 40 68 37 64 44z" fill="#ff4d6d" />
        <path d="M38 68a12 12 0 0 0 24 0z" fill="#3d2c00" />
      </g>
      <g fill="#ff7aa2">
        <path className="tg-h" d="M12 30C9 25 2 26.6 2 32.3 2 37.5 12 43 12 43s10-5.5 10-10.7C22 26.6 15 25 12 30z" />
        <path className="tg-h" style={{ animationDelay: '.5s' }} d="M88 30c-3-5-10-3.4-10 2.3 0 5.2 10 10.7 10 10.7s10-5.5 10-10.7c0-5.7-7-7.3-10-2.3z" />
      </g>
    </>
  ),

  /* 猫咪 */
  cat: (
    <g className="tg-core">
      <path className="tg-tail" d="M24 70c-11 3-15 14-8 22 5 6 14 3 13-4" fill="none" stroke="#f0a63e" strokeWidth="8" strokeLinecap="round" />
      <path d="M29 37l-2-17 17 9z" fill="#f6b353" />
      <path d="M75 37l2-17-17 9z" fill="#f6b353" />
      <path d="M31 35l-1-11 11 6z" fill="#ffd7a1" />
      <path d="M73 35l1-11-11 6z" fill="#ffd7a1" />
      <circle cx="52" cy="56" r="28" fill="#f6b353" />
      <circle cx="42" cy="54" r="4.4" fill="#3a2a00" />
      <circle cx="62" cy="54" r="4.4" fill="#3a2a00" />
      <circle cx="43.5" cy="52.5" r="1.4" fill="#fff" />
      <circle cx="63.5" cy="52.5" r="1.4" fill="#fff" />
      <path d="M52 63l-3.2 3h6.4z" fill="#e0537a" />
      <path d="M52 66v4M52 70c-4 0-6.5-1.6-6.5-1.6M52 70c4 0 6.5-1.6 6.5-1.6" fill="none" stroke="#3a2a00" strokeWidth="2" strokeLinecap="round" />
      <path d="M36 58L20 59M36 64l-15 3M68 58l16 1M68 64l15 3" fill="none" stroke="#3a2a00" strokeWidth="1.8" strokeLinecap="round" />
    </g>
  ),

  /* 狗狗 */
  dog: (
    <g className="tg-core">
      <path className="tg-ear" d="M24 42c-11-7-18 4-13 17 4 10 14 13 20 6z" fill="#c98a4b" />
      <path className="tg-ear" d="M76 42c11-7 18 4 13 17-4 10-14 13-20 6z" fill="#c98a4b" />
      <circle cx="50" cy="54" r="28" fill="#e6a35c" />
      <ellipse cx="50" cy="69" rx="17" ry="13" fill="#fff3e0" />
      <circle cx="40" cy="49" r="4.6" fill="#3a2a00" />
      <circle cx="60" cy="49" r="4.6" fill="#3a2a00" />
      <circle cx="41.5" cy="47.5" r="1.5" fill="#fff" />
      <circle cx="61.5" cy="47.5" r="1.5" fill="#fff" />
      <ellipse cx="50" cy="62" rx="6.5" ry="5" fill="#3a2a00" />
      <path d="M50 67v5M50 72c-4.5 0-7-2-7-2M50 72c4.5 0 7-2 7-2" fill="none" stroke="#3a2a00" strokeWidth="2" strokeLinecap="round" />
      <path d="M50 77c-4 0-6-1.8-6-1.8" fill="none" stroke="#e0537a" strokeWidth="2.4" strokeLinecap="round" />
    </g>
  ),

  /* 独角兽 */
  unicorn: (
    <>
      <defs>
        <linearGradient id="tgsMane" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff7ac6" />
          <stop offset=".5" stopColor="#8a7bff" />
          <stop offset="1" stopColor="#35c6ff" />
        </linearGradient>
      </defs>
      <g className="tg-core">
        <path d="M27 48c0-15 10-26 23-26s23 11 23 26v26H27z" fill="#f6eeff" />
        <path className="tg-horn" d="M50 8l6.5 22h-13z" fill="url(#tgsMane)" />
        <g className="tg-shine">
          <path d="M30 34c-6 3-9 9-9 16 6-3 10-9 11-16z" fill="#ff7ac6" />
          <path d="M70 34c6 3 9 9 9 16-6-3-10-9-11-16z" fill="#35c6ff" />
        </g>
        <path d="M32 32l-2-14 12 6z" fill="#f6eeff" />
        <path d="M68 32l2-14-12 6z" fill="#f6eeff" />
        <circle cx="41" cy="50" r="4.4" fill="#5a3d8a" />
        <circle cx="59" cy="50" r="4.4" fill="#5a3d8a" />
        <circle cx="42.5" cy="48.5" r="1.4" fill="#fff" />
        <circle cx="60.5" cy="48.5" r="1.4" fill="#fff" />
        <ellipse cx="50" cy="68" rx="9" ry="6.5" fill="#d9a6ff" />
        <circle cx="47" cy="67" r="1.6" fill="#5a3d8a" />
        <circle cx="53" cy="67" r="1.6" fill="#5a3d8a" />
      </g>
    </>
  ),

  /* 闪粉 */
  glitter: (
    <>
      <defs>
        <linearGradient id="tgsGlit" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff3b0" />
          <stop offset="1" stopColor="#ffab00" />
        </linearGradient>
      </defs>
      <g className="tg-core">
        <path d="M50 16l8 20 20 8-20 8-8 20-8-20-20-8 20-8z" fill="url(#tgsGlit)" />
        <path d="M50 32l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#fff" opacity=".55" />
      </g>
      <g fill="#ffd36e">
        <path className="tg-g1" d="M22 26l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" />
        <path className="tg-g2" d="M78 30l2 4 4 2-4 2-2 4-2-4-4-2 4-2z" />
        <path className="tg-g3" d="M24 70l1.6 3.2 3.2 1.6-3.2 1.6-1.6 3.2-1.6-3.2-3.2-1.6 3.2-1.6z" />
        <path className="tg-g1" style={{ animationDelay: '.6s' }} d="M76 68l1.6 3.2 3.2 1.6-3.2 1.6-1.6 3.2-1.6-3.2-3.2-1.6 3.2-1.6z" />
      </g>
    </>
  ),
};

export const STICKER_ARTS = Object.keys(ART);

export function hasArt(art) {
  return !!ART[art];
}

/** 渲染一枚 Telegram 同款动画贴纸 */
export function TgsSticker({ art, size = 'md', className = '', style }) {
  const body = ART[art];
  if (!body) return null;
  return (
    <span className={`tgs tgs-${art} ${size}`.trim() + (className ? ' ' + className : '')} style={style} aria-hidden="true">
      <svg viewBox="0 0 100 100">{body}</svg>
    </span>
  );
}

export default TgsSticker;
