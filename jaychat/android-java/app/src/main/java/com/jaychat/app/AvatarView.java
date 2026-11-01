package com.jaychat.app;

import android.content.Context;
import android.graphics.Color;
import android.graphics.drawable.GradientDrawable;
import android.util.AttributeSet;
import android.view.Gravity;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.TextView;

import com.bumptech.glide.Glide;
import com.bumptech.glide.load.engine.DiskCacheStrategy;
import com.bumptech.glide.request.RequestOptions;

/** 圆形头像：有图加载图，无图显示首字母；支持服务端预设头像（preset:N） */
public class AvatarView extends FrameLayout {

    private static final String[] PRESET_EMOJI = {
            "🐱", "🐶", "⭐", "🌙", "🔥", "❤️", "⚡", "🍀", "💎", "🌸", "🦋", "🚀"
    };
    private static final int[][] PRESET_GRAD = {
            {0xFF5B9DFF, 0xFF3B6DFF}, {0xFF7A5CFF, 0xFF5236E8}, {0xFFFF7A8A, 0xFFE8435F},
            {0xFF2FD07B, 0xFF12A05C}, {0xFFFFB020, 0xFFF08A00}, {0xFF3AD0E0, 0xFF1A9DBF},
            {0xFFFF8FD0, 0xFFE0559F}, {0xFF8F9BFF, 0xFF5F6AE0}, {0xFF5B9DFF, 0xFF3B6DFF},
            {0xFF7A5CFF, 0xFF5236E8}, {0xFFFF7A8A, 0xFFE8435F}, {0xFF2FD07B, 0xFF12A05C}
    };

    private final ImageView image;
    private final TextView letter;
    private final View dot;

    public AvatarView(Context ctx) {
        this(ctx, null);
    }

    public AvatarView(Context ctx, AttributeSet attrs) {
        super(ctx, attrs);
        image = new ImageView(ctx);
        image.setScaleType(ImageView.ScaleType.CENTER_CROP);
        image.setClipToOutline(true);
        addView(image, new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT));

        letter = new TextView(ctx);
        letter.setTextColor(Color.WHITE);
        letter.setGravity(Gravity.CENTER);
        letter.setBackgroundResource(R.drawable.circle_letter);
        letter.setTextSize(15);
        letter.setVisibility(View.GONE);
        addView(letter, new LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT));

        dot = new View(ctx);
        dot.setBackgroundResource(R.drawable.bg_online);
        dot.setVisibility(View.GONE);
        int s = Ui.dp(ctx, 11);
        LayoutParams lp = new LayoutParams(s, s, Gravity.BOTTOM | Gravity.END);
        lp.setMargins(0, 0, Ui.dp(ctx, 1), Ui.dp(ctx, 1));
        addView(dot, lp);
    }

    public void setOnline(Boolean online) {
        dot.setVisibility(online != null && online ? View.VISIBLE : View.GONE);
    }

    public void bind(String name, String avatarRaw) {
        bind(name, avatarRaw, null);
    }

    public void bind(String name, String avatarRaw, Boolean online) {
        setOnline(online);
        String raw = avatarRaw == null ? "" : avatarRaw.trim();
        if (raw.startsWith("preset:")) {
            int idx;
            try {
                idx = Integer.parseInt(raw.substring(7));
            } catch (Exception e) {
                idx = 0;
            }
            applyPreset(letter, idx);
            image.setVisibility(View.GONE);
            letter.setVisibility(View.VISIBLE);
            return;
        }
        letter.setTextSize(15);
        letter.setBackgroundResource(R.drawable.circle_letter);
        String url = MediaUtil.avatarUrl(raw);
        String ch = "?";
        if (name != null && !name.trim().isEmpty()) ch = name.trim().substring(0, 1).toUpperCase();
        letter.setText(ch);
        if (url.isEmpty()) {
            image.setVisibility(View.GONE);
            letter.setVisibility(View.VISIBLE);
        } else {
            Glide.with(getContext()).load(url)
                    .apply(new RequestOptions().circleCrop()
                            .placeholder(R.drawable.circle_letter)
                            .error(R.drawable.circle_letter)
                            .diskCacheStrategy(DiskCacheStrategy.ALL))
                    .into(image);
            image.setVisibility(View.VISIBLE);
            letter.setVisibility(View.GONE);
        }
    }

    /** 预设头像：渐变圆底 + 字形 emoji（与服务端 preset:N 对应） */
    public static void applyPreset(TextView tv, int index) {
        int i = ((index % PRESET_EMOJI.length) + PRESET_EMOJI.length) % PRESET_EMOJI.length;
        GradientDrawable d = new GradientDrawable(GradientDrawable.Orientation.TL_BR, PRESET_GRAD[i]);
        d.setShape(GradientDrawable.OVAL);
        tv.setBackground(d);
        tv.setText(PRESET_EMOJI[i]);
        tv.setTextSize(18);
    }

    public static String presetEmoji(int index) {
        int i = ((index % PRESET_EMOJI.length) + PRESET_EMOJI.length) % PRESET_EMOJI.length;
        return PRESET_EMOJI[i];
    }

    public void setSizeDp(int dp) {
        int s = Ui.dp(getContext(), dp);
        setLayoutParams(new FrameLayout.LayoutParams(s, s));
        letter.setTextSize(Math.max(11, dp / 3));
    }

    public static GradientDrawable circle(int color, int sizePx) {
        GradientDrawable d = new GradientDrawable();
        d.setShape(GradientDrawable.OVAL);
        d.setColor(color);
        d.setSize(sizePx, sizePx);
        return d;
    }
}
