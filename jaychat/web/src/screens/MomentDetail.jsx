import React, { useEffect, useRef, useState } from 'react';
import { api, ws, mediaUrl } from '../api.js';
import { useApp } from '../App.jsx';
import { Avatar, ActionSheet, Empty, Loading, TopBar, toast, Sheet, MediaViewer, MediaPicker, CameraPicker, Spinner } from '../components/ui.jsx';
import { Icon, IconTile } from '../components/icons.jsx';
import EmojiPanel from '../components/EmojiPanel.jsx';
import { fullTime } from '../lib/time.js';
import MomentCard from '../components/MomentCard.jsx';

export default function MomentDetailScreen({ momentId }) {
  const { back, me, push, openUser } = useApp();
  const [moment, setMoment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState(null); // { user }
  const [actionComment, setActionComment] = useState(null);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [panel, setPanel] = useState(null); // emoji | plus
  const [viewer, setViewer] = useState(null); // { url, type }
  const inputRef = useRef(null);

  const load = async () => {
    try {
      const d = await api.get(`/api/moments/${momentId}`);
      setMoment(d.moment);
    } catch (e) {
      toast(e.message, 'error');
      back();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [momentId]);

  useEffect(() => {
    const offs = [
      ws.on('moment:update', (d) => d?.id === Number(momentId) && setMoment(d)),
      ws.on('moment:delete', (d) => d?.id === Number(momentId) && back()),
    ];
    return () => offs.forEach((o) => o());
  }, [momentId, back]);

  const like = async () => {
    try {
      const d = await api.post(`/api/moments/${momentId}/like`, {});
      setMoment(d.moment);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const busy = sending || uploading;

  /** 发送评论：文字 / 图片 / 视频 / 表情 / 动画表情包 */
  const sendComment = async ({ content = '', msgType = 'text', mediaUrl: mUrl = '', mediaThumb = '' } = {}) => {
    const c = String(content).trim();
    if (msgType === 'text' && !c) return;
    if (msgType !== 'text' && !mUrl) return;
    setSending(true);
    try {
      const d = await api.post(`/api/moments/${momentId}/comments`, {
        content: c, msg_type: msgType, media_url: mUrl, media_thumb: mediaThumb,
        replyToUserId: replyTo?.user?.id || 0,
      });
      setMoment(d.moment);
      setText('');
      setReplyTo(null);
      toast(msgType === 'text' ? '评论已发送' : '已发送');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSending(false);
    }
  };

  /** 表情面板发送动画表情包（url 直发 / blob 先上传） */
  const sendSticker = async ({ url, blob, label }) => {
    setPanel(null);
    try {
      let finalUrl = url;
      if (blob) {
        const up = await api.upload(new File([blob], 'sticker.png', { type: 'image/png' }), 'image');
        finalUrl = up.url;
      }
      if (!finalUrl) return;
      await sendComment({ content: text, msgType: 'sticker', mediaUrl: finalUrl, mediaThumb: '' });
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  /** 选择图片 / 视频后上传并发送 */
  const pickMedia = async (files, kind) => {
    const f = files?.[0];
    if (!f) return;
    setPanel(null);
    setUploading(true);
    try {
      const up = await api.upload(f, kind);
      await sendComment({
        content: text,
        msgType: up.kind === 'video' ? 'video' : 'image',
        mediaUrl: up.url,
        mediaThumb: up.thumb || '',
      });
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const deleteComment = async (c) => {
    try {
      const d = await api.del(`/api/moments/${momentId}/comments/${c.id}`);
      setMoment(d.moment);
      toast('评论已删除');
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const canDeleteComment = (c) => c.is_mine || moment?.is_mine;

  if (loading) {
    return (
      <div className="page" style={{ height: '100%' }}>
        <TopBar title="动态详情" onBack={back} />
        <Loading />
      </div>
    );
  }
  if (!moment) return null;

  return (
    <div className="page" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <TopBar title="动态详情" sub={moment.author?.username} onBack={back} />
      <div className="page-scroll" style={{ flex: 1 }}>
        <MomentCard moment={moment} onLike={like} onOpen={() => inputRef.current?.focus()} showCommentPreview={false} onDeleted={back} />

        <div className="section-head">点赞（{moment.likes?.length || 0}）</div>
        <div className="glass mx" style={{ padding: 12 }}>
          {moment.likes?.length ? (
            <div className="avatar-pick">
              {moment.likes.map((l, i) => (
                <div key={i} style={{ textAlign: 'center' }}>
                  <Avatar user={l.user} size={42} onClick={l.user?.id ? () => openUser(l.user) : undefined} />
                  <div className="hint" style={{ marginTop: 3 }}>{l.user?.username}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="hint">还没有人点赞</div>
          )}
        </div>

        <div className="section-head">评论（{moment.comments?.length || 0}）</div>
        <div className="glass mx" style={{ padding: 12 }}>
          {moment.comments?.length ? (
            moment.comments.map((c) => {
              const isSticker = c.msg_type === 'sticker' && c.media_url;
              const isImage = c.msg_type === 'image' && c.media_url;
              const isVideo = c.msg_type === 'video' && c.media_url;
              return (
                <div key={c.id} className="flex gap12" style={{ alignItems: 'flex-start', padding: '7px 0' }}>
                  <Avatar user={c.user} size={36} onClick={c.user?.id ? () => openUser(c.user) : undefined} />
                  <div className="grow">
                    <div className="comment-line" style={{ padding: 0 }}>
                      <b>{c.user?.username}</b>
                      {c.reply_to_user ? <span className="dim"> 回复 {c.reply_to_user.username}</span> : null}
                      {c.content ? <span>：{c.content}</span> : null}
                    </div>
                    {isSticker ? (
                      <img
                        className="comment-sticker press-scale"
                        src={mediaUrl(c.media_url)}
                        alt={c.content || '动画表情'}
                        loading="lazy"
                        onClick={() => setViewer({ url: c.media_url, type: 'image' })}
                      />
                    ) : null}
                    {isImage || isVideo ? (
                      <div className="comment-media press-scale" onClick={() => setViewer({ url: c.media_url, type: c.msg_type })}>
                        {isVideo ? (
                          <video src={mediaUrl(c.media_url)} muted playsInline preload="metadata" />
                        ) : (
                          <img src={mediaUrl(c.media_thumb || c.media_url)} alt="评论图片" loading="lazy" />
                        )}
                        {isVideo ? (
                          <span className="comment-media-tag"><Icon name="play" size={11} filled /> 视频</span>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="hint" style={{ marginTop: 3 }}>{fullTime(c.created_at)}</div>
                  </div>
                  <span className="hint press-scale" style={{ cursor: 'pointer' }} onClick={() => setActionComment(c)}>···</span>
                </div>
              );
            })
          ) : (
            <Empty icon="message" text="还没有评论，来说点什么吧" />
          )}
        </div>
        <div style={{ height: 12 }} />
      </div>

      {replyTo ? (
        <div className="mx" style={{ paddingBottom: 4 }}>
          <div className="hint">回复 <b>{replyTo.user?.username}</b> · 点击取消
            <span className="press-scale" style={{ marginLeft: 8, cursor: 'pointer' }} onClick={() => setReplyTo(null)}>取消</span>
          </div>
        </div>
      ) : null}
      <div className="chat-input-wrap">
        <button className="icon-btn" onClick={() => setPanel(panel === 'emoji' ? null : 'emoji')} aria-label="表情">
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="9" cy="10" r="1.2" fill="currentColor" />
            <circle cx="15" cy="10" r="1.2" fill="currentColor" />
            <path d="M8.4 14.4c.9 1.3 2.1 2 3.6 2s2.7-.7 3.6-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
        <input
          ref={inputRef}
          className="chat-input"
          placeholder="写评论…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendComment({ content: text, msgType: 'text' })}
        />
        <button className="icon-btn" onClick={() => setPanel(panel === 'plus' ? null : 'plus')} aria-label="更多">
          <svg viewBox="0 0 24 24" width="21" height="21" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" />
          </svg>
        </button>
        <button
          className="btn btn-primary"
          style={{ padding: '11px 16px' }}
          disabled={busy || !text.trim()}
          onClick={() => sendComment({ content: text, msgType: 'text' })}
        >
          {uploading ? <Spinner size={16} /> : '发送'}
        </button>
      </div>

      {/* 表情 / 动画表情包面板 */}
      <Sheet open={panel === 'emoji'} onClose={() => setPanel(null)}>
        <EmojiPanel onEmoji={(e) => setText((t) => t + e)} onSendSticker={sendSticker} />
      </Sheet>

      {/* + 面板：图片 / 视频 / 拍摄 */}
      <Sheet open={panel === 'plus'} onClose={() => setPanel(null)} title="评论内容">
        <div className="grid2" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
          <MediaPicker onPick={(f) => pickMedia(f, 'image')} accept="image/*" multiple={false}>
            <div className="glass pad press-scale" style={{ textAlign: 'center', borderRadius: 16 }}>
              <Icon name="image" size={26} strokeWidth={1.8} />
              <div className="hint" style={{ marginTop: 6 }}>相册图片</div>
            </div>
          </MediaPicker>
          <MediaPicker onPick={(f) => pickMedia(f, 'video')} accept="video/*" multiple={false}>
            <div className="glass pad press-scale" style={{ textAlign: 'center', borderRadius: 16 }}>
              <Icon name="video" size={26} strokeWidth={1.8} />
              <div className="hint" style={{ marginTop: 6 }}>相册视频</div>
            </div>
          </MediaPicker>
          <CameraPicker onPick={(f) => pickMedia(f, 'image')} kind="image">
            <div className="glass pad press-scale" style={{ textAlign: 'center', borderRadius: 16 }}>
              <Icon name="camera" size={26} strokeWidth={1.8} />
              <div className="hint" style={{ marginTop: 6 }}>拍摄照片</div>
            </div>
          </CameraPicker>
          <CameraPicker onPick={(f) => pickMedia(f, 'video')} kind="video">
            <div className="glass pad press-scale" style={{ textAlign: 'center', borderRadius: 16 }}>
              <Icon name="camera" size={26} strokeWidth={1.8} />
              <div className="hint" style={{ marginTop: 6 }}>拍摄视频</div>
            </div>
          </CameraPicker>
        </div>
        <div className="hint" style={{ marginTop: 10 }}>
          选中图片/视频后立即发送，输入框里的文字会作为文字说明一起发出；表情与动画表情包在「表情」面板中选择。
        </div>
      </Sheet>

      {/* 媒体查看 */}
      {viewer ? <MediaViewer item={{ url: viewer.url, type: viewer.type }} onClose={() => setViewer(null)} /> : null}

      <ActionSheet
        open={!!actionComment}
        onClose={() => setActionComment(null)}
        title={`评论 by ${actionComment?.user?.username || ''}`}
        actions={
          actionComment
            ? [
                { icon: <IconTile name="reply" tone="amber" box={34} size={18} />, label: '回复', onClick: () => { setReplyTo({ user: actionComment.user }); setTimeout(() => inputRef.current?.focus(), 50); } },
                ...(canDeleteComment(actionComment) ? [{ icon: <IconTile name="trash" tone="rose" box={34} size={18} />, label: '删除评论', danger: true, onClick: () => deleteComment(actionComment) }] : []),
                ...(actionComment.user?.id !== me.id && moment.author?.id !== me.id ? [{ icon: <IconTile name="user" tone="sky" box={34} size={18} />, label: '查看 TA 的动态', onClick: () => push('userMoments', { userId: actionComment.user?.id }) }] : []),
              ]
            : []
        }
      />
    </div>
  );
}
