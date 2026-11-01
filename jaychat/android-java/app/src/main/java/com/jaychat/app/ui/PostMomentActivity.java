package com.jaychat.app.ui;

import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.view.ViewOutlineProvider;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.bumptech.glide.Glide;
import com.jaychat.app.Api;
import com.jaychat.app.MediaUtil;
import com.jaychat.app.Models;
import com.jaychat.app.R;
import com.jaychat.app.Ui;

import org.json.JSONObject;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class PostMomentActivity extends AppCompatActivity {

    private EditText etText;
    private LinearLayout mediaBox;
    private TextView tvVisibility, tvHint;
    private TextView btnPost;

    private final List<Uri> picks = new ArrayList<>();
    private String visibility = "public";
    private boolean busy;
    private final List<Models.User> friends = new ArrayList<>();
    private final Set<Integer> picked = new HashSet<>();

    private ActivityResultLauncher<String> picker;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_post_moment);

        etText = findViewById(R.id.etText);
        mediaBox = findViewById(R.id.mediaBox);
        tvVisibility = findViewById(R.id.tvVisibility);
        tvHint = findViewById(R.id.tvHint);
        btnPost = findViewById(R.id.btnPost);

        picker = registerForActivityResult(new ActivityResultContracts.GetMultipleContents(),
                uris -> {
                    if (uris == null) return;
                    for (Uri u : uris) {
                        if (picks.size() >= 9) break;
                        picks.add(u);
                    }
                    renderPicks();
                });

        findViewById(R.id.btnCancel).setOnClickListener(v -> finish());
        findViewById(R.id.btnPick).setOnClickListener(v -> picker.launch("*/*"));
        findViewById(R.id.rowVisibility).setOnClickListener(v -> chooseVisibility());
        btnPost.setOnClickListener(v -> publish());

        tvVisibility.setText("公开");
        Ui.runIo(() -> {
            List<Models.User> list;
            try {
                list = Api.api().friends();
            } catch (Exception e) {
                return;
            }
            Ui.runMain(() -> {
                friends.clear();
                friends.addAll(list);
            });
        });
    }

    private void chooseVisibility() {
        final String[] labels = {"公开", "好友可见", "仅自己可见", "部分好友可见", "部分好友不可见"};
        final String[] values = {"public", "friends", "private", "custom", "exclude"};
        int checked = 0;
        for (int i = 0; i < values.length; i++) if (values[i].equals(visibility)) checked = i;
        new AlertDialog.Builder(this)
                .setTitle("谁可以看")
                .setSingleChoiceItems(labels, checked, (d, which) -> {
                    d.dismiss();
                    String v = values[which];
                    if ("custom".equals(v) || "exclude".equals(v)) {
                        pickFriends(v);
                    } else {
                        visibility = v;
                        picked.clear();
                        tvVisibility.setText(labels[which]);
                    }
                })
                .show();
    }

    private void pickFriends(final String v) {
        if (friends.isEmpty()) {
            Ui.toast(this, "还没有好友");
            return;
        }
        String[] names = new String[friends.size()];
        final boolean[] checked = new boolean[friends.size()];
        for (int i = 0; i < friends.size(); i++) {
            names[i] = friends.get(i).displayName();
            checked[i] = picked.contains(friends.get(i).id);
        }
        new AlertDialog.Builder(this)
                .setTitle("custom".equals(v) ? "选择可见好友" : "选择不可见好友")
                .setMultiChoiceItems(names, checked, (d, which, isChecked) -> checked[which] = isChecked)
                .setNegativeButton("取消", null)
                .setPositiveButton("确定", (d, w) -> {
                    picked.clear();
                    for (int i = 0; i < checked.length; i++) {
                        if (checked[i]) picked.add(friends.get(i).id);
                    }
                    if (picked.isEmpty()) {
                        visibility = "public";
                        tvVisibility.setText("公开");
                        return;
                    }
                    visibility = v;
                    tvVisibility.setText(("custom".equals(v) ? "部分好友可见" : "部分好友不可见")
                            + "（" + picked.size() + "）");
                })
                .show();
    }

    private void renderPicks() {
        mediaBox.removeAllViews();
        if (picks.isEmpty()) {
            mediaBox.setVisibility(View.GONE);
            return;
        }
        mediaBox.setVisibility(View.VISIBLE);
        int cell = (getResources().getDisplayMetrics().widthPixels - Ui.dp(this, 68)) / 3;
        int gap = Ui.dp(this, 4);
        for (int i = 0; i < picks.size(); i += 3) {
            LinearLayout row = new LinearLayout(this);
            row.setOrientation(LinearLayout.HORIZONTAL);
            LinearLayout.LayoutParams rlp = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            rlp.topMargin = gap;
            row.setLayoutParams(rlp);
            for (int j = i; j < Math.min(i + 3, picks.size()); j++) {
                final int index = j;
                FrameLayout cellView = new FrameLayout(this);
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(cell, cell);
                lp.rightMargin = gap;
                cellView.setLayoutParams(lp);
                cellView.setBackgroundResource(R.drawable.card_glass_sm);
                cellView.setClipToOutline(true);
                cellView.setOutlineProvider(ViewOutlineProvider.BACKGROUND);

                ImageView iv = new ImageView(this);
                iv.setScaleType(ImageView.ScaleType.CENTER_CROP);
                cellView.addView(iv, new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
                Glide.with(this).load(picks.get(j)).centerCrop().into(iv);

                TextView del = new TextView(this);
                del.setText("✕");
                del.setTextColor(0xFFFFFFFF);
                del.setTextSize(12);
                del.setGravity(android.view.Gravity.CENTER);
                del.setBackgroundColor(0x99000000);
                FrameLayout.LayoutParams dlp = new FrameLayout.LayoutParams(
                        Ui.dp(this, 22), Ui.dp(this, 22), android.view.Gravity.TOP | android.view.Gravity.END);
                dlp.topMargin = Ui.dp(this, 4);
                dlp.rightMargin = Ui.dp(this, 4);
                cellView.addView(del, dlp);
                del.setOnClickListener(v -> {
                    picks.remove(index);
                    renderPicks();
                });

                row.addView(cellView);
            }
            mediaBox.addView(row);
        }
    }

    private void publish() {
        if (busy) return;
        String text = etText.getText().toString().trim();
        if (text.isEmpty() && picks.isEmpty()) {
            Ui.toast(this, "写点什么或选张图片吧");
            return;
        }
        if (("custom".equals(visibility) || "exclude".equals(visibility)) && picked.isEmpty()) {
            Ui.toast(this, "请选择好友");
            return;
        }
        busy = true;
        btnPost.setEnabled(false);
        btnPost.setText("发布中…");
        tvHint.setVisibility(View.VISIBLE);

        final List<Uri> uris = new ArrayList<>(picks);
        final String vis = visibility;
        Ui.runIo(() -> {
            List<Models.MomentMedia> media = new ArrayList<>();
            try {
                for (int i = 0; i < uris.size(); i++) {
                    final int idx = i + 1;
                    final int total = uris.size();
                    Ui.runMain(() -> tvHint.setText("上传中 " + idx + "/" + total + "…"));
                    Uri u = uris.get(i);
                    JSONObject up;
                    String type = "image";
                    if (MediaUtil.isVideoUri(this, u)) {
                        type = "video";
                        InputStream in = MediaUtil.openStream(this, u);
                        if (in == null) throw new Api.ApiException(500, "无法读取该视频");
                        long size = MediaUtil.querySize(this, u);
                        up = Api.api().uploadStream(in, size,
                                MediaUtil.queryDisplayName(this, u, "video.mp4"));
                    } else {
                        byte[] bytes = MediaUtil.compressImage(this, u);
                        if (bytes == null) throw new Api.ApiException(500, "无法读取该图片");
                        up = Api.api().uploadBytes(bytes,
                                MediaUtil.queryDisplayName(this, u, "image.jpg"), "image/jpeg");
                    }
                    String url = up.optString("url", "");
                    if (url.isEmpty()) throw new Api.ApiException(500, "上传失败");
                    Models.MomentMedia mm = new Models.MomentMedia();
                    mm.url = url;
                    mm.type = type;
                    mm.thumb = url;
                    media.add(mm);
                }
                List<Integer> ids = new ArrayList<>(picked);
                Api.api().createMoment(text, media, vis,
                        "custom".equals(vis) ? ids : new ArrayList<>(),
                        "exclude".equals(vis) ? ids : new ArrayList<>());
                Ui.runMain(() -> {
                    busy = false;
                    btnPost.setText("发布");
                    Ui.toast(this, "发布成功");
                    finish();
                });
            } catch (Exception e) {
                Ui.runMain(() -> {
                    busy = false;
                    btnPost.setEnabled(true);
                    btnPost.setText("发布");
                    tvHint.setVisibility(View.GONE);
                    Ui.toast(this, e.getMessage() == null ? "发布失败" : e.getMessage());
                });
            }
        });
    }
}
