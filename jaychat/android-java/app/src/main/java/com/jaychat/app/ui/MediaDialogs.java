package com.jaychat.app.ui;

import android.app.Dialog;
import android.content.Context;
import android.graphics.Color;
import android.graphics.drawable.ColorDrawable;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.MediaController;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.VideoView;

import com.bumptech.glide.Glide;
import com.bumptech.glide.load.engine.DiskCacheStrategy;
import com.jaychat.app.MediaUtil;
import com.jaychat.app.R;
import com.jaychat.app.Ui;

/** 应用内图片预览 / 视频播放（绝不跳系统播放器） */
public final class MediaDialogs {

    private MediaDialogs() {
    }

    public static void showImage(Context ctx, String url) {
        if (url == null || url.isEmpty()) return;
        Dialog d = new Dialog(ctx, android.R.style.Theme_Black_NoTitleBar_Fullscreen);
        FrameLayout root = new FrameLayout(ctx);
        root.setBackgroundColor(Color.BLACK);

        ImageView iv = new ImageView(ctx);
        iv.setScaleType(ImageView.ScaleType.FIT_CENTER);
        root.addView(iv, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        ProgressBar pb = new ProgressBar(ctx);
        FrameLayout.LayoutParams plp = new FrameLayout.LayoutParams(Ui.dp(ctx, 36), Ui.dp(ctx, 36),
                Gravity.CENTER);
        root.addView(pb, plp);

        TextView close = new TextView(ctx);
        close.setText("关闭");
        close.setTextColor(Color.WHITE);
        close.setTextSize(14);
        close.setPadding(Ui.dp(ctx, 14), Ui.dp(ctx, 10), Ui.dp(ctx, 14), Ui.dp(ctx, 10));
        FrameLayout.LayoutParams clp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.TOP | Gravity.END);
        clp.topMargin = Ui.dp(ctx, 18);
        clp.rightMargin = Ui.dp(ctx, 12);
        root.addView(close, clp);
        close.setOnClickListener(v -> d.dismiss());
        iv.setOnClickListener(v -> d.dismiss());

        d.setContentView(root);
        d.setOnShowListener(x -> Glide.with(ctx).load(MediaUtil.mediaUrl(url))
                .diskCacheStrategy(DiskCacheStrategy.ALL)
                .listener(new com.bumptech.glide.request.RequestListener<android.graphics.drawable.Drawable>() {
                    @Override
                    public boolean onLoadFailed(com.bumptech.glide.load.engine.GlideException e,
                                                Object model,
                                                com.bumptech.glide.request.target.Target<android.graphics.drawable.Drawable> target,
                                                boolean isFirstResource) {
                        Ui.runMain(() -> pb.setVisibility(View.GONE));
                        return false;
                    }

                    @Override
                    public boolean onResourceReady(android.graphics.drawable.Drawable resource,
                                                   Object model,
                                                   com.bumptech.glide.request.target.Target<android.graphics.drawable.Drawable> target,
                                                   com.bumptech.glide.load.DataSource dataSource,
                                                   boolean isFirstResource) {
                        Ui.runMain(() -> pb.setVisibility(View.GONE));
                        return false;
                    }
                })
                .into(iv));
        Window w = d.getWindow();
        if (w != null) {
            w.setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT);
            w.setBackgroundDrawable(new ColorDrawable(Color.BLACK));
        }
        d.show();
    }

    public static void showVideo(Context ctx, String url) {
        if (url == null || url.isEmpty()) return;
        Dialog d = new Dialog(ctx, android.R.style.Theme_Black_NoTitleBar_Fullscreen);
        FrameLayout root = new FrameLayout(ctx);
        root.setBackgroundColor(Color.BLACK);

        VideoView vv = new VideoView(ctx);
        root.addView(vv, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        ProgressBar pb = new ProgressBar(ctx);
        FrameLayout.LayoutParams plp = new FrameLayout.LayoutParams(Ui.dp(ctx, 36), Ui.dp(ctx, 36),
                Gravity.CENTER);
        root.addView(pb, plp);

        TextView close = new TextView(ctx);
        close.setText("关闭");
        close.setTextColor(Color.WHITE);
        close.setTextSize(14);
        close.setPadding(Ui.dp(ctx, 14), Ui.dp(ctx, 10), Ui.dp(ctx, 14), Ui.dp(ctx, 10));
        FrameLayout.LayoutParams clp = new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT,
                Gravity.TOP | Gravity.END);
        clp.topMargin = Ui.dp(ctx, 18);
        clp.rightMargin = Ui.dp(ctx, 12);
        root.addView(close, clp);
        close.setOnClickListener(v -> d.dismiss());

        d.setContentView(root);
        d.setOnShowListener(x -> {
            vv.setMediaController(new MediaController(ctx));
            vv.setOnPreparedListener(mp -> {
                pb.setVisibility(View.GONE);
                mp.setLooping(false);
                vv.start();
            });
            vv.setOnErrorListener((mp, what, extra) -> {
                Ui.toast(ctx, "该视频无法播放（编码不被设备支持）");
                d.dismiss();
                return true;
            });
            vv.setVideoURI(android.net.Uri.parse(MediaUtil.mediaUrl(url)));
            vv.requestFocus();
        });
        d.setOnDismissListener(x -> {
            try {
                vv.stopPlayback();
            } catch (Exception ignored) {
            }
        });
        Window w = d.getWindow();
        if (w != null) {
            w.setLayout(WindowManager.LayoutParams.MATCH_PARENT, WindowManager.LayoutParams.MATCH_PARENT);
            w.setBackgroundDrawable(new ColorDrawable(Color.BLACK));
        }
        d.show();
    }
}
