import React from 'react';
import { mediaUrl } from '../api.js';
import { Avatar } from '../components/ui.jsx';
import { fullTime } from '../lib/time.js';
import { useApp } from '../App.jsx';

/** 动态卡片：动态流 / 好友动态 / 个人动态共用 */
export default function MomentCard({ moment, onOpen, onLike, showCommentPreview = true }) {
  const { openUser } = useApp();
  const m = moment;
  const media = (m.media || []).filter((x) => x.url);
  const nCls = media.length === 1 ? 'n1' : media.length === 2 || media.length === 4 ? 'n2' : 'n3';
  const visLabel = { public: '公开', friends: '好友可见', private: '私密', custom: '指定可见', exclude: '部分不可见' }[m.visibility];

  return (
    <div className="moment-card glass glass-strong">
      <div className="moment-head">
        <Avatar user={m.author} size={44} onClick={m.author?.id ? () => openUser(m.author) : undefined} />
        <div className="grow">
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>
            {m.author?.username}
            {m.author?.is_official ? <span className="badge-soft" style={{ marginLeft: 6 }}>官方</span> : null}
            {m.is_mine ? <span className="badge-soft" style={{ marginLeft: 6 }}>我</span> : null}
          </div>
          <div className="hint" style={{ marginTop: 2 }}>{fullTime(m.created_at)}</div>
        </div>
        {m.visibility !== 'public' ? <span className="badge-soft">{visLabel}</span> : null}
      </div>

      {m.text ? <div className="moment-text">{m.text}</div> : null}

      {media.length ? (
        <div className={'moment-media ' + nCls}>
          {media.slice(0, 9).map((item, i) => (
            <div key={i} onClick={() => onOpen?.('detail')} style={{ position: 'relative', cursor: 'pointer' }}>
              {item.type === 'video' ? (
                <video src={mediaUrl(item.url)} muted playsInline preload="metadata" />
              ) : (
                <img src={mediaUrl(item.url)} alt="" loading="lazy" />
              )}
              {item.type === 'video' ? (
                <span style={{ position: 'absolute', right: 6, bottom: 6, fontSize: 12, background: 'rgba(0,0,0,.5)', borderRadius: 8, padding: '1px 6px' }}>▶ 视频</span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="moment-actions">
        <div className={'moment-act' + (m.liked ? ' liked' : '')} onClick={() => onLike?.(m)}>
          <span>{m.liked ? '❤️' : '🤍'}</span>
          <span>{m.likes?.length ? `${m.likes.length} 赞` : '赞'}</span>
        </div>
        <div className="moment-act" onClick={() => onOpen?.('detail')}>
          <span>💬</span>
          <span>{m.comments?.length ? `${m.comments.length} 评论` : '评论'}</span>
        </div>
        <div className="moment-act" onClick={() => onOpen?.('detail')}>
          <span>📄</span>
          <span>详情</span>
        </div>
      </div>

      {showCommentPreview && m.comments?.length ? (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,.07)' }}>
          {m.comments.slice(-2).map((c) => (
            <div key={c.id} className="comment-line">
              <b>{c.user?.username}</b>
              {c.reply_to_user ? <span className="dim"> 回复 {c.reply_to_user.username}</span> : null}
              <span>：{c.content}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
