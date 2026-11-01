package com.jaychat.app.ui;

import android.graphics.drawable.Drawable;
import android.graphics.drawable.GradientDrawable;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewOutlineProvider;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.bumptech.glide.Glide;
import com.bumptech.glide.load.engine.DiskCacheStrategy;
import com.jaychat.app.AvatarView;
import com.jaychat.app.MediaUtil;
import com.jaychat.app.Models;
import com.jaychat.app.R;
import com.jaychat.app.Ui;

import java.util.ArrayList;
import java.util.List;

public class MomentAdapter extends RecyclerView.Adapter<MomentAdapter.VH> {

    interface Listener {
        void onLike(Models.Moment m);

        void onComment(Models.Moment m);

        void onMore(Models.Moment m, View anchor);

        void onMedia(Models.MomentMedia mm);

        void onCommentLong(Models.Moment m, Models.MomentComment c);

        void onOpen(Models.Moment m);
    }

    private final List<Models.Moment> data = new ArrayList<>();
    private final Listener listener;

    public MomentAdapter(Listener listener) {
        this.listener = listener;
    }

    public void setData(List<Models.Moment> list) {
        data.clear();
        data.addAll(list);
        notifyDataSetChanged();
    }

    public void replace(Models.Moment m) {
        for (int i = 0; i < data.size(); i++) {
            if (data.get(i).id == m.id) {
                data.set(i, m);
                notifyItemChanged(i);
                return;
            }
        }
    }

    public void remove(long id) {
        for (int i = 0; i < data.size(); i++) {
            if (data.get(i).id == id) {
                data.remove(i);
                notifyItemRemoved(i);
                return;
            }
        }
    }

    @NonNull
    @Override
    public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        return new VH(LayoutInflater.from(parent.getContext())
                .inflate(R.layout.item_moment, parent, false));
    }

    @Override
    public void onBindViewHolder(@NonNull VH h, int position) {
        bind(h, data.get(position), listener);
    }

    /** 动态详情页复用同一套卡片渲染 */
    public static View createCard(ViewGroup parent, Models.Moment m, Listener listener) {
        LayoutInflater inf = LayoutInflater.from(parent.getContext());
        VH h = new VH(inf.inflate(R.layout.item_moment, parent, false));
        bind(h, m, listener);
        return h.itemView;
    }

    static void bind(VH h, Models.Moment m, Listener listener) {
        String name = m.author == null ? "未知用户" : m.author.displayName();
        h.avatar.bind(name, m.author == null ? "" : m.author.avatar, null);
        h.name.setText(name);
        h.time.setText(Ui.relative(m.createdAt) + " · " + Models.momentVisibilityLabel(m.visibility));

        if (m.text == null || m.text.trim().isEmpty()) {
            h.text.setVisibility(View.GONE);
        } else {
            h.text.setVisibility(View.VISIBLE);
            h.text.setText(m.text);
        }

        buildMedia(h, m, listener);

        h.likeCount.setText(String.valueOf(m.likes.size()));
        h.commentCount.setText(String.valueOf(m.comments.size()));
        h.ivLike.setColorFilter(m.liked ? 0xFFFF5F7A : 0xFFAEB6CC);

        if (!m.likes.isEmpty()) {
            StringBuilder sb = new StringBuilder();
            for (Models.MomentLike l : m.likes) {
                if (sb.length() > 0) sb.append("、");
                sb.append(l.user == null ? "某人" : l.user.displayName());
            }
            sb.append(" 赞过");
            h.likes.setVisibility(View.VISIBLE);
            h.likes.setText(sb.toString());
        } else {
            h.likes.setVisibility(View.GONE);
        }

        h.commentsBox.removeAllViews();
        if (m.comments.isEmpty()) {
            h.commentsBox.setVisibility(View.GONE);
        } else {
            h.commentsBox.setVisibility(View.VISIBLE);
            for (Models.MomentComment c : m.comments) {
                TextView tv = new TextView(h.itemView.getContext());
                String cname = c.user == null ? "某人" : c.user.displayName();
                String body = "text".equals(c.msgType) ? c.content : "[图片]";
                if (c.replyToUser != null) {
                    tv.setText(cname + " 回复 " + c.replyToUser.displayName() + "：" + body);
                } else {
                    tv.setText(cname + "：" + body);
                }
                tv.setTextColor(0xFFAEB6CC);
                tv.setTextSize(12);
                tv.setPadding(0, Ui.dp(h.itemView.getContext(), 3), 0, Ui.dp(h.itemView.getContext(), 3));
                tv.setOnLongClickListener(v -> {
                    listener.onCommentLong(m, c);
                    return true;
                });
                h.commentsBox.addView(tv);
            }
        }

        h.itemView.setOnClickListener(v -> listener.onOpen(m));
        h.btnLike.setOnClickListener(v -> listener.onLike(m));
        h.btnComment.setOnClickListener(v -> listener.onComment(m));
        h.btnMore.setOnClickListener(v -> listener.onMore(m, v));
        h.btnMore.setVisibility(m.isMine ? View.VISIBLE : View.GONE);
    }

    private static void buildMedia(VH h, Models.Moment m, Listener listener) {
        h.mediaBox.removeAllViews();
        if (m.media.isEmpty()) {
            h.mediaBox.setVisibility(View.GONE);
            return;
        }
        h.mediaBox.setVisibility(View.VISIBLE);
        int cell = (h.itemView.getResources().getDisplayMetrics().widthPixels
                - Ui.dp(h.itemView.getContext(), 62)) / 3;
        int gap = Ui.dp(h.itemView.getContext(), 3);
        for (int i = 0; i < m.media.size(); i += 3) {
            LinearLayout row = new LinearLayout(h.itemView.getContext());
            row.setOrientation(LinearLayout.HORIZONTAL);
            LinearLayout.LayoutParams rlp = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            rlp.topMargin = gap;
            row.setLayoutParams(rlp);
            for (int j = i; j < Math.min(i + 3, m.media.size()); j++) {
                Models.MomentMedia mm = m.media.get(j);
                FrameLayout cellView = new FrameLayout(h.itemView.getContext());
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(cell, cell);
                lp.rightMargin = gap;
                cellView.setLayoutParams(lp);
                GradientDrawable bg = new GradientDrawable();
                bg.setColor(0x1AFFFFFF);
                bg.setCornerRadius(Ui.dp(h.itemView.getContext(), 10));
                cellView.setBackground(bg);
                cellView.setClipToOutline(true);
                cellView.setOutlineProvider(ViewOutlineProvider.BACKGROUND);

                ImageView iv = new ImageView(h.itemView.getContext());
                iv.setScaleType(ImageView.ScaleType.CENTER_CROP);
                cellView.addView(iv, new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                Glide.with(iv).load(MediaUtil.mediaUrl(mm.preview()))
                        .diskCacheStrategy(DiskCacheStrategy.ALL)
                        .into(iv);

                if (mm.isVideo()) {
                    ImageView play = new ImageView(h.itemView.getContext());
                    play.setImageResource(R.drawable.ic_play);
                    play.setColorFilter(0xFFFFFFFF);
                    GradientDrawable circle = new GradientDrawable();
                    circle.setShape(GradientDrawable.OVAL);
                    circle.setColor(0x66000000);
                    play.setBackground(circle);
                    play.setPadding(Ui.dp(h.itemView.getContext(), 6),
                            Ui.dp(h.itemView.getContext(), 6),
                            Ui.dp(h.itemView.getContext(), 6),
                            Ui.dp(h.itemView.getContext(), 6));
                    FrameLayout.LayoutParams plp = new FrameLayout.LayoutParams(
                            Ui.dp(h.itemView.getContext(), 34), Ui.dp(h.itemView.getContext(), 34),
                            Gravity.CENTER);
                    cellView.addView(play, plp);
                }
                cellView.setOnClickListener(v -> listener.onMedia(mm));
                row.addView(cellView);
            }
            // 占位，保持三列对齐
            int remain = 3 - Math.min(3, m.media.size() - i);
            for (int k = 0; k < remain; k++) {
                View spacer = new View(h.itemView.getContext());
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(cell, cell);
                lp.rightMargin = gap;
                spacer.setLayoutParams(lp);
                row.addView(spacer);
            }
            h.mediaBox.addView(row);
        }
    }

    @Override
    public int getItemCount() {
        return data.size();
    }

    static class VH extends RecyclerView.ViewHolder {
        AvatarView avatar;
        TextView name, time, text, likeCount, commentCount, likes;
        ImageView btnMore, ivLike;
        LinearLayout mediaBox, commentsBox, btnLike, btnComment;

        VH(@NonNull View v) {
            super(v);
            avatar = v.findViewById(R.id.avatar);
            name = v.findViewById(R.id.tvName);
            time = v.findViewById(R.id.tvTime);
            text = v.findViewById(R.id.tvText);
            likeCount = v.findViewById(R.id.tvLikeCount);
            commentCount = v.findViewById(R.id.tvCommentCount);
            likes = v.findViewById(R.id.tvLikes);
            btnMore = v.findViewById(R.id.btnMore);
            ivLike = v.findViewById(R.id.ivLike);
            mediaBox = v.findViewById(R.id.mediaBox);
            commentsBox = v.findViewById(R.id.commentsBox);
            btnLike = v.findViewById(R.id.btnLike);
            btnComment = v.findViewById(R.id.btnComment);
        }
    }
}
