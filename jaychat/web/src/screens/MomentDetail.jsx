import React, { useEffect, useRef, useState } from 'react';
import { api, ws } from '../api.js';
import { useApp } from '../App.jsx';
import { Avatar, ActionSheet, Empty, Loading, TopBar, toast } from '../components/ui.jsx';
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

  const sendComment = async () => {
    const content = text.trim();
    if (!content) return;
    setSending(true);
    try {
      const d = await api.post(`/api/moments/${momentId}/comments`, { content, replyToUserId: replyTo?.user?.id || 0 });
      setMoment(d.moment);
      setText('');
      setReplyTo(null);
      toast('评论已发送');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSending(false);
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
        <MomentCard moment={moment} onLike={like} onOpen={() => inputRef.current?.focus()} showCommentPreview={false} />

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
            moment.comments.map((c) => (
              <div key={c.id} className="flex gap12" style={{ alignItems: 'flex-start', padding: '7px 0' }}>
                <Avatar user={c.user} size={36} onClick={c.user?.id ? () => openUser(c.user) : undefined} />
                <div className="grow">
                  <div className="comment-line" style={{ padding: 0 }}>
                    <b>{c.user?.username}</b>
                    {c.reply_to_user ? <span className="dim"> 回复 {c.reply_to_user.username}</span> : null}
                    <span>：{c.content}</span>
                  </div>
                  <div className="hint" style={{ marginTop: 3 }}>{fullTime(c.created_at)}</div>
                </div>
                <span className="hint press-scale" style={{ cursor: 'pointer' }} onClick={() => setActionComment(c)}>···</span>
              </div>
            ))
          ) : (
            <Empty icon="💬" text="还没有评论，来说点什么吧" />
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
        <input
          ref={inputRef}
          className="chat-input"
          placeholder="写评论…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendComment()}
        />
        <button className="btn btn-primary" style={{ padding: '11px 16px' }} disabled={sending || !text.trim()} onClick={sendComment}>发送</button>
      </div>

      <ActionSheet
        open={!!actionComment}
        onClose={() => setActionComment(null)}
        title={`评论 by ${actionComment?.user?.username || ''}`}
        actions={
          actionComment
            ? [
                { icon: '↩️', label: '回复', onClick: () => { setReplyTo({ user: actionComment.user }); setTimeout(() => inputRef.current?.focus(), 50); } },
                ...(canDeleteComment(actionComment) ? [{ icon: '🗑️', label: '删除评论', danger: true, onClick: () => deleteComment(actionComment) }] : []),
                ...(actionComment.user?.id !== me.id && moment.author?.id !== me.id ? [{ icon: '👤', label: '查看 TA 的动态', onClick: () => push('userMoments', { userId: actionComment.user?.id }) }] : []),
              ]
            : []
        }
      />
    </div>
  );
}
