package com.jaychat.app.ui;

import android.app.Activity;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.text.TextUtils;
import android.view.View;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.ProgressBar;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

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

/** 聊天页：文本 / 图片 / 视频 / 表情，应用内播放，实时轮询新消息与撤回 */
public class ChatActivity extends AppCompatActivity {

    private static final String EXT_TYPE = "conv_type";
    private static final String EXT_ID = "conv_id";
    private static final String EXT_NAME = "conv_name";
    private static final String EXT_AVATAR = "conv_avatar";
    private static final String EXT_ONLINE = "conv_online";
    private static final String EXT_MEMBERS = "conv_members";
    private static final String EXT_GROUP = "conv_is_group";

    private static final int REQ_PICK = 1001;

    public static void start(Activity a, Models.Conversation c) {
        Intent i = new Intent(a, ChatActivity.class);
        i.putExtra(EXT_TYPE, c.type);
        i.putExtra(EXT_ID, c.id);
        i.putExtra(EXT_NAME, c.name);
        i.putExtra(EXT_AVATAR, c.avatar);
        i.putExtra(EXT_ONLINE, c.online && !c.isGroup());
        i.putExtra(EXT_MEMBERS, c.memberCount);
        i.putExtra(EXT_GROUP, c.isGroup());
        a.startActivity(i);
    }

    public static void startDm(Activity a, Models.User u) {
        Intent i = new Intent(a, ChatActivity.class);
        i.putExtra(EXT_TYPE, "dm");
        i.putExtra(EXT_ID, dmId(myId(), u.id));
        i.putExtra(EXT_NAME, u.displayName());
        i.putExtra(EXT_AVATAR, u.avatar);
        i.putExtra(EXT_ONLINE, u.online);
        i.putExtra(EXT_MEMBERS, 0);
        i.putExtra(EXT_GROUP, false);
        a.startActivity(i);
    }

    public static void startGroup(Activity a, Models.Group g) {
        Intent i = new Intent(a, ChatActivity.class);
        i.putExtra(EXT_TYPE, "group");
        i.putExtra(EXT_ID, String.valueOf(g.id));
        i.putExtra(EXT_NAME, g.name);
        i.putExtra(EXT_AVATAR, g.avatar);
        i.putExtra(EXT_ONLINE, false);
        i.putExtra(EXT_MEMBERS, g.memberCount);
        i.putExtra(EXT_GROUP, true);
        a.startActivity(i);
    }

    private static String dmId(int a, int b) {
        return a < b ? a + "_" + b : b + "_" + a;
    }

    private static int myId() {
        try {
            JSONObject o = new JSONObject(Store.userJson());
            return o.optInt("id", 0);
        } catch (Exception e) {
            return 0;
        }
    }

    private String convType = "dm";
    private String convId = "";
    private boolean isGroup;
    private int myId;
    private long cursor;

    private RecyclerView recycler;
    private TextView tvEmpty, tvSub;
    private ProgressBar progress;
    private EditText etInput;
    private TextView btnSend;
    private ImageView btnAdd, btnEmoji, btnStickers;

    private MessageAdapter adapter;
    private final List<Models.Message> messages = new ArrayList<>();
    private final Handler handler = new Handler(Looper.getMainLooper());
    private volatile boolean active;
    private int pollGen;
    private boolean sending;
    private boolean uploading;
    private boolean firstLoadDone;

    private final Runnable fallbackRefresh = new Runnable() {
        @Override
        public void run() {
            if (!active) return;
            loadMessages(false);
            handler.postDelayed(this, 45000);
        }
    };

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_chat);

        Intent it = getIntent();
        convType = it.getStringExtra(EXT_TYPE);
        convId = it.getStringExtra(EXT_ID);
        isGroup = it.getBooleanExtra(EXT_GROUP, "group".equals(convType));
        myId = myId();
        if (convType == null) convType = "dm";
        if (convId == null) convId = "";

        recycler = findViewById(R.id.recycler);
        tvEmpty = findViewById(R.id.tvEmpty);
        tvSub = findViewById(R.id.tvSub);
        progress = findViewById(R.id.progress);
        etInput = findViewById(R.id.etInput);
        btnSend = findViewById(R.id.btnSend);
        btnAdd = findViewById(R.id.btnAdd);
        btnEmoji = findViewById(R.id.btnEmoji);
        btnStickers = findViewById(R.id.btnStickers);

        String name = it.getStringExtra(EXT_NAME);
        String avatar = it.getStringExtra(EXT_AVATAR);
        boolean online = it.getBooleanExtra(EXT_ONLINE, false);
        int members = it.getIntExtra(EXT_MEMBERS, 0);

        TextView tvName = findViewById(R.id.tvName);
        AvatarView av = findViewById(R.id.avatar);
        tvName.setText(name == null ? "" : name);
        av.bind(name == null ? "" : name, avatar == null ? "" : avatar, isGroup ? null : online);
        renderSub(online, members, "member");

        View.OnClickListener openInfo = v -> openInfo();
        tvName.setOnClickListener(openInfo);
        av.setOnClickListener(openInfo);

        recycler.setLayoutManager(new LinearLayoutManager(this));
        adapter = new MessageAdapter(myId, isGroup, new MessageAdapter.Listener() {
            @Override
            public void onLongPress(Models.Message m, View anchor) {
                showActions(m);
            }

            @Override
            public void onMedia(Models.Message m) {
                if ("video".equals(m.type)) MediaDialogs.showVideo(ChatActivity.this, m.mediaUrl);
                else MediaDialogs.showImage(ChatActivity.this, m.mediaUrl);
            }
        });
        recycler.setAdapter(adapter);

        findViewById(R.id.btnBack).setOnClickListener(v -> finish());
        btnSend.setOnClickListener(v -> sendText());
        btnAdd.setOnClickListener(v -> pickMedia());
        StickerPanel.Listener stickerListener = new StickerPanel.Listener() {
            @Override
            public void onSticker(String url, String label) {
                sendSticker(url, label);
            }

            @Override
            public void onEmoji(String emoji) {
                int start = etInput.getSelectionStart();
                if (start < 0) start = etInput.getText().length();
                etInput.getText().insert(start, emoji);
                etInput.requestFocus();
            }
        };
        btnEmoji.setOnClickListener(v -> StickerPanel.show(this, stickerListener));
        btnStickers.setOnClickListener(v -> StickerPanel.show(this, stickerListener));

        loadMessages(true);
        if (isGroup) {
            Ui.runIo(() -> {
                try {
                    String role = Api.api().groupRole(Integer.parseInt(convId));
                    Ui.runMain(() -> renderSub(false, 0, role));
                } catch (Exception ignored) {
                }
            });
        }
    }

    /** 头部头像/名称 → 群资料或好友资料 */
    private void openInfo() {
        if (isGroup) {
            try {
                GroupInfoActivity.start(this, Integer.parseInt(convId));
            } catch (Exception ignored) {
            }
        } else {
            String[] parts = convId.split("_");
            if (parts.length < 2) return;
            try {
                int a = Integer.parseInt(parts[0]);
                int b = Integer.parseInt(parts[1]);
                int peer = a == myId ? b : a;
                FriendInfoActivity.start(this, peer);
            } catch (Exception ignored) {
            }
        }
    }

    private void renderSub(boolean online, int members, String role) {
        if (isGroup) {
            String text = members > 0 ? members + " 人" : "群聊";
            if ("owner".equals(role)) text += " · 群主";
            else if ("admin".equals(role)) text += " · 管理员";
            tvSub.setText(text);
        } else {
            tvSub.setText(online ? "在线" : "离线");
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        active = true;
        pollGen++;
        handler.removeCallbacks(fallbackRefresh);
        handler.postDelayed(fallbackRefresh, 45000);
        pollOnce(pollGen);
    }

    @Override
    protected void onPause() {
        active = false;
        pollGen++;
        handler.removeCallbacks(fallbackRefresh);
        super.onPause();
    }

    private void pollOnce(int gen) {
        if (!active || gen != pollGen) return;
        Ui.runIo(() -> {
            List<Api.PollEvent> events = new ArrayList<>();
            if (active && gen == pollGen) {
                try {
                    Api.PollResult r = Api.api().poll(cursor, 15);
                    cursor = r.cursor;
                    events = r.events;
                } catch (Exception ignored) {
                }
            }
            final List<Api.PollEvent> got = events;
            if (!got.isEmpty()) Ui.runMain(() -> handleEvents(got));
            if (active && gen == pollGen) Ui.runIo(() -> pollOnce(gen));
        });
    }

    private void handleEvents(List<Api.PollEvent> events) {
        boolean added = false;
        for (Api.PollEvent e : events) {
            JSONObject d = e.data;
            if ("message".equals(e.type)) {
                if (convType.equals(d.optString("conv_type")) && convId.equals(d.optString("conv_id"))) {
                    Models.Message m = Models.parseMessage(d);
                    boolean exists = false;
                    for (Models.Message x : messages) {
                        if (x.id == m.id) exists = true;
                    }
                    if (!exists) {
                        messages.add(m);
                        adapter.append(m);
                        added = true;
                        if (m.senderId != myId) {
                            final long id = m.id;
                            Ui.runIo(() -> {
                                try {
                                    Api.api().markRead(id);
                                } catch (Exception ignored) {
                                }
                            });
                        }
                    }
                }
            } else if ("message:recall".equals(e.type)) {
                if (convType.equals(d.optString("convType")) && convId.equals(d.optString("convId"))) {
                    long id = d.optLong("id", 0L);
                    adapter.recall(id);
                }
            }
        }
        if (added) scrollBottom();
    }

    private void loadMessages(boolean markRead) {
        Ui.runIo(() -> {
            try {
                List<Models.Message> list = Api.api().messages(convType, convId, 80, 0, markRead);
                Ui.runMain(() -> {
                    if (isFinishing()) return;
                    messages.clear();
                    messages.addAll(list);
                    adapter.setData(list);
                    firstLoadDone = true;
                    showEmpty(list.isEmpty());
                    if (!list.isEmpty()) scrollBottom();
                });
            } catch (Exception e) {
                Ui.runMain(() -> {
                    if (isFinishing() || firstLoadDone) return;
                    showEmpty(true);
                    tvEmpty.setText(e.getMessage() == null ? "加载失败" : e.getMessage());
                });
            }
        });
    }

    private void showEmpty(boolean empty) {
        tvEmpty.setVisibility(empty ? View.VISIBLE : View.GONE);
        recycler.setVisibility(empty ? View.GONE : View.VISIBLE);
    }

    private void scrollBottom() {
        if (messages.isEmpty()) return;
        recycler.post(() -> recycler.scrollToPosition(messages.size() - 1));
    }

    private void sendText() {
        String text = etInput.getText().toString().trim();
        if (TextUtils.isEmpty(text) || sending || uploading) return;
        sending = true;
        Ui.runIo(() -> {
            try {
                Models.Message m = Api.api().sendMessage(convType, convId, "text", text, "");
                Ui.runMain(() -> {
                    messages.add(m);
                    adapter.append(m);
                    etInput.setText("");
                    showEmpty(false);
                    scrollBottom();
                    Ui.toast(this, "发送成功");
                    sending = false;
                });
            } catch (Exception e) {
                Ui.runMain(() -> {
                    Ui.toast(this, "发送失败");
                    sending = false;
                });
            }
        });
    }

    private void sendSticker(String url, String label) {
        if (uploading) return;
        Ui.runIo(() -> {
            try {
                Models.Message m = Api.api().sendMessage(convType, convId, "sticker", label == null ? "" : label, url);
                Ui.runMain(() -> {
                    messages.add(m);
                    adapter.append(m);
                    showEmpty(false);
                    scrollBottom();
                    Ui.toast(this, "发送成功");
                });
            } catch (Exception e) {
                Ui.runMain(() -> Ui.toast(this, "发送失败"));
            }
        });
    }

    private void pickMedia() {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("*/*");
        try {
            startActivityForResult(i, REQ_PICK);
        } catch (Exception e) {
            Ui.toast(this, "无法选择文件");
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_PICK || resultCode != RESULT_OK || data == null) return;
        Uri uri = data.getData();
        if (uri == null) return;
        upload(uri);
    }

    private void upload(Uri uri) {
        if (uploading) return;
        uploading = true;
        progress.setVisibility(View.VISIBLE);
        Ui.runIo(() -> {
            String type;
            try {
                boolean video = MediaUtil.isVideoUri(this, uri);
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
                if (TextUtils.isEmpty(url)) throw new IllegalStateException("上传失败");
                type = video ? "video" : "image";
                Models.Message m = Api.api().sendMessage(convType, convId, type, "", url);
                Ui.runMain(() -> {
                    messages.add(m);
                    adapter.append(m);
                    showEmpty(false);
                    scrollBottom();
                    uploading = false;
                    progress.setVisibility(View.GONE);
                    Ui.toast(this, "发送成功");
                });
            } catch (Exception e) {
                Ui.runMain(() -> {
                    uploading = false;
                    progress.setVisibility(View.GONE);
                    Ui.toast(this, "发送失败");
                });
            }
        });
    }

    private void showActions(Models.Message m) {
        boolean mine = m.senderId == myId;
        List<String> labels = new ArrayList<>();
        if ("text".equals(m.type) || "sticker".equals(m.type)) labels.add("复制");
        if (mine) labels.add("撤回");
        labels.add("删除");
        String[] items = labels.toArray(new String[0]);
        new AlertDialog.Builder(this)
                .setTitle("消息操作")
                .setItems(items, (d, which) -> {
                    String pick = items[which];
                    if ("复制".equals(pick)) {
                        ClipboardManager cm = (ClipboardManager) getSystemService(Context.CLIPBOARD_SERVICE);
                        if (cm != null) {
                            cm.setPrimaryClip(ClipData.newPlainText("message", m.content));
                            Ui.toast(this, "已复制");
                        }
                    } else if ("撤回".equals(pick)) {
                        Ui.runIo(() -> {
                            try {
                                Api.api().recall(m.id);
                                Ui.runMain(() -> adapter.recall(m.id));
                            } catch (Exception e) {
                                Ui.toast(this, e.getMessage() == null ? "撤回失败" : e.getMessage());
                            }
                        });
                    } else {
                        Ui.runIo(() -> {
                            try {
                                Api.api().hideMessage(m.id);
                                for (int i = 0; i < messages.size(); i++) {
                                    if (messages.get(i).id == m.id) {
                                        messages.remove(i);
                                        break;
                                    }
                                }
                                Ui.runMain(() -> adapter.remove(m.id));
                            } catch (Exception e) {
                                Ui.toast(this, e.getMessage() == null ? "删除失败" : e.getMessage());
                            }
                        });
                    }
                })
                .show();
    }
}
