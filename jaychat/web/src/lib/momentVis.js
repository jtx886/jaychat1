/* 动态可见范围选项（发布动态 / 修改可见范围共用） */
export const VIS_OPTIONS = [
  { key: 'public', icon: 'globe', tone: 'sky', label: '公开', desc: '全站所有用户可见' },
  { key: 'friends', icon: 'users', tone: 'mint', label: '好友可见', desc: '仅已添加的好友可见' },
  { key: 'private', icon: 'lock', tone: 'slate', label: '私密', desc: '仅自己可见' },
  { key: 'custom', icon: 'checkCircle', tone: 'brand', label: '指定好友可见', desc: '只让选中的好友看到' },
  { key: 'exclude', icon: 'ban', tone: 'rose', label: '不给谁看', desc: '选中好友不可见' },
];

export const visMeta = (key) => VIS_OPTIONS.find((v) => v.key === key) || VIS_OPTIONS[0];
