package com.jaychat.app.ui;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewOutlineProvider;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.PopupMenu;
import android.widget.TextView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.bumptech.glide.Glide;
import com.bumptech.glide.load.engine.DiskCacheStrategy;
import com.jaychat.app.Api;
import com.jaychat.app.AvatarView;
import com.jaychat.app.MediaUtil;
import com.jaychat.app.Models;
import com.jaychat.app.R;
import com.jaychat.app.Store;
import com.jaychat.app.Ui;

import org.json.JSONObject;

import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;

/** 动态详情：点赞、评论（文字/表情/图片/视频）、回复、删除、修改可见范围 */
public class MomentDetailActivity extends AppCompatActivity {

    private static final String EXT_ID = "moment_id";

    public static void start(Activity a, long momentId) {
        Intent i = new Intent(a, MomentDetailActivity.class);
        i.putExtra(EXT_ID, momentId);
        a.startActivity(i);
    }

    private long momentId;
    private int myId;
    private Models.Moment moment;
    private Models.User replyTo;
    private boolean uploading;

    private LinearLayout momentBox, likesBox, commentsBox;
    private TextView tvSub, tvLikeTitle, tvCommentTitle, tvNoComment, tvReplyHint;
    private EditText etComment;

    private ActivityResultLauncher<String> imagePicker;
    private ActivityResultLauncher<String> videoPicker;

    private final MomentAdapter.Listener cardListener = new MomentAdapter.Listener() {
        @Override
        public void onLike(Models.Moment m) {
            like();
        }

        @Override
        public void onComment(Models.Moment m) {
            focusInput();
        }

        @Override
        public void onMore(Models.Moment m, View anchor) {
            more(m, anchor);
        }

        @Override
        public void onMedia(Models.MomentMedia mm) {
            if (mm.isVideo()) MediaDialogs.showVideo(MomentDetailActivity.this, mm.url);
            else MediaDialogs.showImage(MomentDetailActivity.this, mm.url);
        }

        @Override
        public void onCommentLong(Models.Moment m, Models.MomentComment c) {
            commentActions(c, null);
        }

        @Override
        public void onOpen(Models.Moment m) {
            focusInput();
        }
    };

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_moment_detail);
        momentId = getIntent().getLongExtra(EXT_ID, 0L);
        myId = myId();

        momentBox = findViewById(R.id.momentBox);
        likesBox = findViewById(R.id.likesBox);
        commentsBox = findViewById(R.id.commentsBox);
        tvSub = findViewById(R.id.tvSub);
        tvLikeTitle = findViewById(R.id.tvLikeTitle);
        tvCommentTitle = findViewById(R.id.tvCommentTitle);
        tvNoComment = findViewById(R.id.tvNoComment);
        tvReplyHint = findViewById(R.id.tvReplyHint);
        etComment = findViewById(R.id.etComment);

        findViewById(R.id.btnBack).setOnClickListener(v -> finish());
        findViewById(R.id.btnSendComment).setOnClickListener(v -> sendText());
        findViewById(R.id.btnCommentEmoji).setOnClickListener(v -> openEmoji());
        findViewById(R.id.btnCommentAdd).setOnClickListener(v -> chooseMediaKind());
        tvReplyHint.setOnClickListener(v -> clearReply());

        imagePicker = registerForActivityResult(new ActivityResultContracts.GetContent(),
                uri -> {
                    if (uri != null) sendMedia(uri, false);
                });
        videoPicker = registerForActivityResult(new ActivityResultContracts.GetContent(),
                uri -> {
                    if (uri != null) sendMedia(uri, true);
                });

        load();
    }

    private static int myId() {
        try {
            return new JSONObject(Store.userJson()).optInt("id", 0);
        } catch (Exception e) {
            return 0;
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (moment != null) load();
    }

    private void load() {
        Ui.runIo(() -> {
            Models.Moment m = null;
            try {
                m = Api.api().moment(momentId);
            } catch (Exception e) {
                Ui.runMain(() -> {
                    Ui.toast(this, e.getMessage() == null ? "加载失败" : e.getMessage());
                    finish();
                });
                return;
            }
            final Models.Moment got = m;
            Ui.runMain(() -> {
                if (isFinishing()) return;
                moment = got;
                render();
            });
        });
    }

    private void render() {
        String author = moment.author == null ? "" : moment.author.displayName();
        tvSub.setText(author);

        momentBox.removeAllViews();
        momentBox.addView(MomentAdapter.createCard(momentBox, moment, cardListener));
        renderLikes();
        renderComments();
    }

    private void renderLikes() {
        likesBox.removeAllViews();
        tvLikeTitle.setText("点赞（" + moment.likes.size() + "）");
        if (moment.likes.isEmpty()) {
            TextView tv = new TextView(this);
            tv.setText("还没有人点赞");
            tv.setTextColor(0xFF6E7793);
            tv.setTextSize(12);
            tv.setPadding(Ui.dp(this, 6), Ui.dp(this, 8), Ui.dp(this, 6), Ui.dp(this, 8));
            likesBox.addView(tv);
            return;
        }
        for (Models.MomentLike l : moment.likes) {
            if (l.user == null) continue;
            final Models.User u = l.user;
            LinearLayout item = new LinearLayout(this);
            item.setOrientation(LinearLayout.VERTICAL);
            item.setGravity(Gravity.CENTER);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            lp.rightMargin = Ui.dp(this, 14);
            item.setLayoutParams(lp);

            AvatarView av = new AvatarView(this);
            int s = Ui.dp(this, 42);
            av.setLayoutParams(new LinearLayout.LayoutParams(s, s));
            av.bind(u.displayName(), u.avatar, null);
            item.addView(av);

            TextView name = new TextView(this);
            name.setText(u.displayName());
            name.setTextColor(0xFFAEB6CC);
            name.setTextSize(11);
            name.setGravity(Gravity.CENTER);
            name.setMaxLines(1);
            LinearLayout.LayoutParams nlp = new LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT, LinearLayout.LayoutParams.WRAP_CONTENT);
            nlp.topMargin = Ui.dp(this, 3);
            name.setLayoutParams(nlp);
            item.addView(name);

            if (u.id != myId) item.setOnClickListener(v -> FriendInfoActivity.start(this, u.id));
            likesBox.addView(item);
        }
    }

    private void renderComments() {
        commentsBox.removeAllViews();
        tvCommentTitle.setText("评论（" + moment.comments.size() + "）");
        tvNoComment.setVisibility(moment.comments.isEmpty() ? View.VISIBLE : View.GONE);
        for (final Models.MomentComment c : moment.comments) {
            View row = LayoutInflater.from(this).inflate(R.layout.item_comment, commentsBox, false);
            AvatarView av = row.findViewById(R.id.avatar);
            TextView body = row.findViewById(R.id.tvBody);
            TextView time = row.findViewById(R.id.tvTime);
            TextView more = row.findViewById(R.id.tvMore);

            String name = c.user == null ? "某人" : c.user.displayName();
            StringBuilder sb = new StringBuilder(name);
            if (c.replyToUser != null) sb.append(" 回复 ").append(c.replyToUser.displayName());
            if (!c.content.trim().isEmpty()) sb.append("：").append(c.content);
            body.setText(sb.toString());
            time.setText(Ui.relative(c.createdAt));
            av.bind(name, c.user == null ? "" : c.user.avatar, null);

            final View anchor = more;
            more.setOnClickListener(v -> commentActions(c, anchor));
            row.setOnClickListener(v -> setReply(c));

            if (c.user != null && c.user.id == myId) {
                av.setOnClickListener(null);
            } else if (c.user != null) {
                av.setOnClickListener(v -> FriendInfoActivity.start(this, c.user.id));
            }

            if (!"text".equals(c.msgType) && !c.mediaUrl.trim().isEmpty()) {
                addCommentMedia(c, body);
            }
            commentsBox.addView(row);
        }
    }

    private void addCommentMedia(Models.MomentComment c, TextView body) {
        if (!(body.getParent() instanceof LinearLayout)) return;
        LinearLayout parent = (LinearLayout) body.getParent();
        ImageView iv = new ImageView(this);
        int s = Ui.dp(this, 116);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(s, s);
        lp.topMargin = Ui.dp(this, 6);
        iv.setLayoutParams(lp);
        iv.setScaleType(ImageView.ScaleType.CENTER_CROP);
        iv.setClipToOutline(true);
        iv.setOutlineProvider(ViewOutlineProvider.BACKGROUND);
        android.graphics.drawable.GradientDrawable bg = new android.graphics.drawable.GradientDrawable();
        bg.setCornerRadius(Ui.dp(this, 10));
        bg.setColor(0x1AFFFFFF);
        iv.setBackground(bg);
        String url = c.mediaThumb.trim().isEmpty() ? c.mediaUrl : c.mediaThumb;
        Glide.with(this).load(MediaUtil.mediaUrl(url))
                .diskCacheStrategy(DiskCacheStrategy.ALL)
                .into(iv);
        if ("video".equals(c.msgType)) {
            iv.setColorFilter(0x33000000);
        }
        iv.setOnClickListener(v -> {
            if ("video".equals(c.msgType)) MediaDialogs.showVideo(this, c.mediaUrl);
            else MediaDialogs.showImage(this, c.mediaUrl);
        });
        parent.addView(iv);
    }

    private void commentActions(final Models.MomentComment c, View anchor) {
        List<String> labels = new ArrayList<>();
        List<Runnable> actions = new ArrayList<>();
        labels.add("回复");
        actions.add(() -> {
            setReply(c);
            focusInput();
        });
        if (c.isMine || moment.isMine) {
            labels.add("删除评论");
            actions.add(() -> Ui.confirm(this, "删除评论", "确定删除这条评论？", () ->
                    Ui.runIo(() -> {
                        try {
                            Models.Moment updated = Api.api().deleteMomentComment(momentId, c.id);
                            Ui.runMain(() -> {
                                moment = updated;
                                render();
                                Ui.toast(this, "评论已删除");
                            });
                        } catch (Exception e) {
                            Ui.toast(this, e.getMessage() == null ? "删除失败" : e.getMessage());
                        }
                    })));
        }
        if (c.user != null && c.user.id != myId && (moment.author == null || moment.author.id != myId)) {
            labels.add("查看 TA 的动态");
            final Models.User u = c.user;
            actions.add(() -> UserMomentsActivity.start(this, u.id, u.displayName()));
        }
        if (labels.size() == 1) {
            setReply(c);
            focusInput();
            return;
        }
        new AlertDialog.Builder(this)
                .setTitle(c.user == null ? "评论" : c.user.displayName())
                .setItems(labels.toArray(new String[0]), (d, which) -> actions.get(which).run())
                .show();
    }

    private void setReply(Models.MomentComment c) {
        replyTo = c.user;
        if (replyTo == null) {
            clearReply();
            return;
        }
        tvReplyHint.setVisibility(View.VISIBLE);
        tvReplyHint.setText("回复 " + replyTo.displayName() + " · 点击取消");
        etComment.setHint("回复 " + replyTo.displayName() + "…");
    }

    private void clearReply() {
        replyTo = null;
        tvReplyHint.setVisibility(View.GONE);
        etComment.setHint("写评论…");
    }

    private void focusInput() {
        etComment.requestFocus();
        Ui.MAIN.postDelayed(() -> {
            try {
                android.view.inputmethod.InputMethodManager im =
                        (android.view.inputmethod.InputMethodManager) getSystemService(INPUT_METHOD_SERVICE);
                if (im != null) im.showSoftInput(etComment, android.view.inputmethod.InputMethodManager.SHOW_IMPLICIT);
            } catch (Exception ignored) {
            }
        }, 120);
    }

    private void sendText() {
        String text = etComment.getText().toString().trim();
        if (text.isEmpty() || uploading) return;
        submit(text, "text", "", "");
    }

    private void submit(final String content, final String msgType, final String mediaUrl, final String thumb) {
        final int replyId = replyTo == null ? 0 : replyTo.id;
        Ui.runIo(() -> {
            try {
                Models.Moment updated = Api.api().commentMoment(momentId, content, msgType,
                        mediaUrl, thumb, replyId);
                Ui.runMain(() -> {
                    if (isFinishing()) return;
                    moment = updated;
                    etComment.setText("");
                    clearReply();
                    render();
                    Ui.toast(this, "评论已发送");
                });
            } catch (Exception e) {
                Ui.toast(this, e.getMessage() == null ? "发送失败" : "发送失败");
            }
        });
    }

    private void openEmoji() {
        StickerPanel.show(this, new StickerPanel.Listener() {
            @Override
            public void onSticker(String url, String label) {
                submit(etComment.getText().toString().trim(), "sticker", url, "");
            }

            @Override
            public void onEmoji(String emoji) {
                int start = etComment.getSelectionStart();
                if (start < 0) start = etComment.getText().length();
                etComment.getText().insert(start, emoji);
                etComment.requestFocus();
            }
        });
    }

    private void chooseMediaKind() {
        String[] items = {"发送图片", "发送视频"};
        new AlertDialog.Builder(this)
                .setTitle("评论内容")
                .setItems(items, (d, which) -> {
                    if (which == 0) imagePicker.launch("image/*");
                    else videoPicker.launch("video/*");
                })
                .show();
    }

    private void sendMedia(Uri uri, final boolean video) {
        if (uploading) return;
        uploading = true;
        final String content = etComment.getText().toString().trim();
        Ui.runIo(() -> {
            try {
                String name = MediaUtil.queryDisplayName(this, uri, video ? "video.mp4" : "image.jpg");
                String url;
                if (video) {
                    long size = MediaUtil.querySize(this, uri);
                    InputStream in = MediaUtil.openStream(this, uri);
                    if (in == null) throw new IllegalStateException("无法读取视频");
                    url = Api.api().uploadStream(in, size, name).optString("url", "");
                } else {
                    byte[] bytes = MediaUtil.compressImage(this, uri);
                    if (bytes == null) throw new IllegalStateException("无法读取图片");
                    url = Api.api().uploadBytes(bytes, name, "image/jpeg").optString("url", "");
                }
                if (url.isEmpty()) throw new IllegalStateException("上传失败");
                Models.Moment updated = Api.api().commentMoment(momentId, content,
                        video ? "video" : "image", url, "", replyTo == null ? 0 : replyTo.id);
                Ui.runMain(() -> {
                    uploading = false;
                    if (isFinishing()) return;
                    moment = updated;
                    etComment.setText("");
                    clearReply();
                    render();
                    Ui.toast(this, "已发送");
                });
            } catch (Exception e) {
                Ui.runMain(() -> {
                    uploading = false;
                    Ui.toast(this, "发送失败");
                });
            }
        });
    }

    private void like() {
        Ui.runIo(() -> {
            try {
                Models.Moment updated = Api.api().likeMoment(momentId);
                Ui.runMain(() -> {
                    moment = updated;
                    render();
                });
            } catch (Exception e) {
                Ui.toast(this, e.getMessage() == null ? "操作失败" : e.getMessage());
            }
        });
    }

    private void more(Models.Moment m, View anchor) {
        PopupMenu menu = new PopupMenu(anchor.getContext(), anchor);
        if (m.isMine) {
            menu.getMenu().add("编辑文案");
            menu.getMenu().add("修改可见范围");
            menu.getMenu().add("删除动态");
        } else {
            menu.getMenu().add("查看作者动态");
        }
        menu.setOnMenuItemClickListener(item -> {
            String title = item.getTitle().toString();
            if ("编辑文案".equals(title)) {
                Ui.prompt(this, "编辑文案", "输入新的内容", m.text, text ->
                        Ui.runIo(() -> {
                            try {
                                Models.Moment updated = Api.api().updateMomentText(momentId, text);
                                Ui.runMain(() -> {
                                    moment = updated;
                                    render();
                                    Ui.toast(this, "已保存");
                                });
                            } catch (Exception e) {
                                Ui.toast(this, e.getMessage() == null ? "保存失败" : e.getMessage());
                            }
                        }));
            } else if ("修改可见范围".equals(title)) {
                changeVisibility();
            } else if ("删除动态".equals(title)) {
                Ui.confirm(this, "删除动态", "删除后不可恢复，确定删除？", () ->
                        Ui.runIo(() -> {
                            try {
                                Api.api().deleteMoment(momentId);
                                Ui.runMain(() -> {
                                    Ui.toast(this, "已删除");
                                    finish();
                                });
                            } catch (Exception e) {
                                Ui.toast(this, e.getMessage() == null ? "删除失败" : e.getMessage());
                            }
                        }));
            } else {
                if (moment.author != null) {
                    UserMomentsActivity.start(this, moment.author.id, moment.author.displayName());
                }
            }
            return true;
        });
        menu.show();
    }

    private void changeVisibility() {
        final String[] labels = {"公开", "好友可见", "仅自己可见", "部分好友可见", "部分好友不可见"};
        final String[] values = {"public", "friends", "private", "custom", "exclude"};
        new AlertDialog.Builder(this)
                .setTitle("修改可见范围")
                .setItems(labels, (d, which) -> {
                    if ("custom".equals(values[which]) || "exclude".equals(values[which])) {
                        pickFriends(values[which]);
                    } else {
                        applyVisibility(values[which], new ArrayList<>(), new ArrayList<>());
                    }
                })
                .show();
    }

    private void pickFriends(final String visibility) {
        Ui.runIo(() -> {
            List<Models.User> friends = new ArrayList<>();
            try {
                friends = Api.api().friends();
            } catch (Exception e) {
                Ui.runMain(() -> Ui.toast(this, e.getMessage() == null ? "加载失败" : e.getMessage()));
                return;
            }
            final List<Models.User> got = friends;
            Ui.runMain(() -> {
                if (got.isEmpty()) {
                    Ui.alert(this, "选择好友", "暂无可选好友");
                    return;
                }
                String[] names = new String[got.size()];
                final boolean[] checked = new boolean[got.size()];
                for (int i = 0; i < got.size(); i++) names[i] = got.get(i).displayName();
                new AlertDialog.Builder(this)
                        .setTitle("custom".equals(visibility) ? "选择可见好友" : "选择不可见好友")
                        .setMultiChoiceItems(names, checked, (d, which, isChecked) -> checked[which] = isChecked)
                        .setNegativeButton("取消", null)
                        .setPositiveButton("确定", (d, w) -> {
                            List<Integer> ids = new ArrayList<>();
                            for (int i = 0; i < checked.length; i++) {
                                if (checked[i]) ids.add(got.get(i).id);
                            }
                            if (ids.isEmpty()) {
                                Ui.toast(this, "请至少选择一位好友");
                                return;
                            }
                            applyVisibility(visibility, ids, new ArrayList<>());
                        })
                        .show();
            });
        });
    }

    private void applyVisibility(final String visibility, final List<Integer> allow,
                                 final List<Integer> deny) {
        Ui.runIo(() -> {
            try {
                Models.Moment updated = Api.api().updateMomentVisibility(momentId, visibility, allow, deny);
                Ui.runMain(() -> {
                    moment = updated;
                    render();
                    Ui.toast(this, "已更新可见范围");
                });
            } catch (Exception e) {
                Ui.toast(this, e.getMessage() == null ? "保存失败" : e.getMessage());
            }
        });
    }
}
