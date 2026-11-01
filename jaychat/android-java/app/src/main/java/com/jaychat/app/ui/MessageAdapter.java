package com.jaychat.app.ui;

import android.graphics.drawable.Drawable;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.bumptech.glide.Glide;
import com.bumptech.glide.load.engine.DiskCacheStrategy;
import com.bumptech.glide.load.resource.bitmap.RoundedCorners;
import com.bumptech.glide.request.RequestOptions;
import com.jaychat.app.AvatarView;
import com.jaychat.app.MediaUtil;
import com.jaychat.app.Models;
import com.jaychat.app.R;
import com.jaychat.app.Ui;

import java.util.ArrayList;
import java.util.List;

public class MessageAdapter extends RecyclerView.Adapter<MessageAdapter.VH> {

    interface Listener {
        void onLongPress(Models.Message m, View anchor);

        void onMedia(Models.Message m);
    }

    private final List<Models.Message> data = new ArrayList<>();
    private final Listener listener;
    private final int myId;
    private final boolean group;

    public MessageAdapter(int myId, boolean group, Listener listener) {
        this.myId = myId;
        this.group = group;
        this.listener = listener;
    }

    public void setData(List<Models.Message> list) {
        data.clear();
        data.addAll(list);
        notifyDataSetChanged();
    }

    public void append(Models.Message m) {
        for (int i = 0; i < data.size(); i++) {
            if (data.get(i).id == m.id) {
                data.set(i, m);
                notifyItemChanged(i);
                return;
            }
        }
        data.add(m);
        notifyItemInserted(data.size() - 1);
    }

    public void recall(long id) {
        for (int i = 0; i < data.size(); i++) {
            if (data.get(i).id == id) {
                data.get(i).recalled = true;
                data.get(i).content = "";
                data.get(i).mediaUrl = "";
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
                .inflate(R.layout.item_message, parent, false));
    }

    @Override
    public void onBindViewHolder(@NonNull VH h, int position) {
        Models.Message m = data.get(position);
        boolean mine = m.senderId == myId;
        int width = h.itemView.getResources().getDisplayMetrics().widthPixels;
        h.tvText.setMaxWidth(width * 7 / 10);
        h.tvStickerText.setMaxWidth(width * 7 / 10);

        h.bubbleRow.setGravity(mine ? (Gravity.END | Gravity.BOTTOM) : (Gravity.START | Gravity.BOTTOM));
        h.avatar.setVisibility(mine ? View.GONE : View.VISIBLE);
        if (!mine) h.avatar.bind(m.senderName, m.senderAvatar, null);

        h.tvTime.setText(Ui.timeText(m.createdAt));
        h.tvTime.setGravity(mine ? Gravity.END : Gravity.START);

        h.tvRecall.setVisibility(m.recalled ? View.VISIBLE : View.GONE);
        h.bubbleRow.setVisibility(m.recalled ? View.GONE : View.VISIBLE);

        h.tvSender.setVisibility(!mine && group && !TextUtils.isEmpty(m.senderName)
                ? View.VISIBLE : View.GONE);
        h.tvSender.setText(m.senderName);

        h.tvText.setVisibility(View.GONE);
        h.ivImage.setVisibility(View.GONE);
        h.videoBox.setVisibility(View.GONE);
        h.ivSticker.setVisibility(View.GONE);
        h.tvStickerText.setVisibility(View.GONE);

        if (m.recalled) {
            h.bubbleRow.setOnLongClickListener(null);
            return;
        }

        String type = m.type == null ? "text" : m.type;
        switch (type) {
            case "image":
                h.ivImage.setVisibility(View.VISIBLE);
                Glide.with(h.ivImage).load(MediaUtil.mediaUrl(m.mediaUrl))
                        .apply(new RequestOptions()
                                .transform(new RoundedCorners(Ui.dp(h.itemView.getContext(), 14)))
                                .diskCacheStrategy(DiskCacheStrategy.ALL).placeholder(R.drawable.card_glass_sm))
                        .into(h.ivImage);
                h.ivImage.setOnClickListener(v -> listener.onMedia(m));
                break;
            case "video":
                h.videoBox.setVisibility(View.VISIBLE);
                h.tvVideoLabel.setText("点击播放视频");
                h.ivVideoThumb.setImageResource(R.drawable.card_glass_sm);
                h.videoBox.setOnClickListener(v -> listener.onMedia(m));
                break;
            case "sticker":
                if (!TextUtils.isEmpty(m.mediaUrl)) {
                    h.ivSticker.setVisibility(View.VISIBLE);
                    Glide.with(h.ivSticker).load(MediaUtil.mediaUrl(m.mediaUrl))
                            .diskCacheStrategy(DiskCacheStrategy.ALL)
                            .into(h.ivSticker);
                    h.ivSticker.setOnClickListener(v -> listener.onMedia(m));
                } else {
                    h.tvStickerText.setVisibility(View.VISIBLE);
                    h.tvStickerText.setText(m.content);
                    h.tvStickerText.setBackgroundResource(mine ? R.drawable.bubble_me : R.drawable.bubble_other);
                }
                break;
            default:
                h.tvText.setVisibility(View.VISIBLE);
                h.tvText.setText(m.content);
                h.tvText.setBackgroundResource(mine ? R.drawable.bubble_me : R.drawable.bubble_other);
                break;
        }

        View anchor = type.equals("text") ? h.tvText
                : type.equals("sticker") && TextUtils.isEmpty(m.mediaUrl) ? h.tvStickerText : h.bubbleCol;
        h.bubbleCol.setOnLongClickListener(v -> {
            listener.onLongPress(m, anchor);
            return true;
        });
    }

    @Override
    public int getItemCount() {
        return data.size();
    }

    static class VH extends RecyclerView.ViewHolder {
        LinearLayout bubbleRow, bubbleCol;
        AvatarView avatar;
        TextView tvSender, tvText, tvTime, tvRecall, tvVideoLabel, tvStickerText;
        ImageView ivImage, ivVideoThumb, ivSticker;
        FrameLayout videoBox;

        VH(@NonNull View v) {
            super(v);
            bubbleRow = v.findViewById(R.id.bubbleRow);
            bubbleCol = v.findViewById(R.id.bubbleCol);
            avatar = v.findViewById(R.id.avatar);
            tvSender = v.findViewById(R.id.tvSender);
            tvText = v.findViewById(R.id.tvText);
            tvTime = v.findViewById(R.id.tvTime);
            tvRecall = v.findViewById(R.id.tvRecall);
            tvVideoLabel = v.findViewById(R.id.tvVideoLabel);
            tvStickerText = v.findViewById(R.id.tvStickerText);
            ivImage = v.findViewById(R.id.ivImage);
            ivVideoThumb = v.findViewById(R.id.ivVideoThumb);
            ivSticker = v.findViewById(R.id.ivSticker);
            videoBox = v.findViewById(R.id.videoBox);
        }
    }
}
