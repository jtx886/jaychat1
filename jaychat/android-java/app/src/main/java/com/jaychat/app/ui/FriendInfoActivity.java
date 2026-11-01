package com.jaychat.app.ui;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.SwitchCompat;

import com.jaychat.app.Api;
import com.jaychat.app.AvatarView;
import com.jaychat.app.Models;
import com.jaychat.app.R;
import com.jaychat.app.Store;
import com.jaychat.app.Ui;

import org.json.JSONObject;

import java.util.List;

/** 好友资料：备注、免打扰、发消息、TA 的动态、删除好友、拉黑 */
public class FriendInfoActivity extends AppCompatActivity {

    private static final String EXT_ID = "user_id";

    public static void start(Activity a, int userId) {
        Intent i = new Intent(a, FriendInfoActivity.class);
        i.putExtra(EXT_ID, userId);
        a.startActivity(i);
    }

    private int userId;
    private int myId;
    private Models.User user;
    private boolean online;
    private boolean dnd;
    private boolean bindDnd;

    private AvatarView avatar;
    private TextView tvName, tvNick, tvMeta, tvBio, tvSub;
    private SwitchCompat switchDnd;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_friend_info);
        userId = getIntent().getIntExtra(EXT_ID, 0);
        myId = myId();

        avatar = findViewById(R.id.avatar);
        tvName = findViewById(R.id.tvName);
        tvNick = findViewById(R.id.tvNick);
        tvMeta = findViewById(R.id.tvMeta);
        tvBio = findViewById(R.id.tvBio);
        tvSub = findViewById(R.id.tvSub);
        switchDnd = findViewById(R.id.switchDnd);

        findViewById(R.id.btnBack).setOnClickListener(v -> finish());
        findViewById(R.id.rowRemark).setOnClickListener(v -> editRemark());
        findViewById(R.id.rowChat).setOnClickListener(v -> openChat());
        findViewById(R.id.rowMoments).setOnClickListener(v -> {
            if (user == null) return;
            UserMomentsActivity.start(this, userId, user.displayName());
        });
        findViewById(R.id.btnDelete).setOnClickListener(v -> removeFriend());
        findViewById(R.id.btnBlock).setOnClickListener(v -> block());

        switchDnd.setOnCheckedChangeListener((b, checked) -> {
            if (bindDnd) return;
            Ui.runIo(() -> {
                try {
                    Api.api().dmDnd(userId, checked);
                    dnd = checked;
                    Ui.runMain(() -> Ui.toast(this, checked ? "已开启消息免打扰" : "已关闭消息免打扰"));
                } catch (Exception e) {
                    Ui.runMain(() -> {
                        bindDnd = true;
                        switchDnd.setChecked(!checked);
                        bindDnd = false;
                        Ui.toast(this, e.getMessage() == null ? "操作失败" : e.getMessage());
                    });
                }
            });
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

    private void load() {
        Ui.runIo(() -> {
            Models.User got = null;
            boolean on = false;
            boolean d = false;
            try {
                got = Api.api().user(userId);
            } catch (Exception e) {
                Ui.runMain(() -> {
                    Ui.toast(this, e.getMessage() == null ? "加载失败" : e.getMessage());
                    finish();
                });
                return;
            }
            try {
                String key = dmKey(myId, userId);
                List<Models.Conversation> list = Api.api().conversations();
                for (Models.Conversation c : list) {
                    if ("dm".equals(c.type) && key.equals(c.id)) {
                        on = c.online;
                        d = c.dnd;
                        break;
                    }
                }
            } catch (Exception ignored) {
            }
            final Models.User u = got;
            final boolean onlineGot = on;
            final boolean dndGot = d;
            Ui.runMain(() -> {
                if (isFinishing()) return;
                user = u;
                online = onlineGot;
                dnd = dndGot;
                render();
            });
        });
    }

    private static String dmKey(int a, int b) {
        int lo = Math.min(a, b), hi = Math.max(a, b);
        return lo + "_" + hi;
    }

    private void render() {
        if (user == null) return;
        avatar.bind(user.displayName(), user.avatar, online);
        tvName.setText(user.displayName());
        tvSub.setText(user.isOfficial ? "官方账号" : "好友");

        if (!user.remark.trim().isEmpty() && !user.remark.equals(user.username)) {
            tvNick.setVisibility(View.VISIBLE);
            tvNick.setText("昵称：" + user.username);
        } else {
            tvNick.setVisibility(View.GONE);
        }

        tvMeta.setText((online ? "在线" : "离线") + " · ID：" + user.id);
        if (user.bio.trim().isEmpty()) {
            tvBio.setVisibility(View.GONE);
        } else {
            tvBio.setVisibility(View.VISIBLE);
            tvBio.setText(user.bio);
        }

        bindDnd = true;
        switchDnd.setChecked(dnd);
        bindDnd = false;
    }

    private void editRemark() {
        if (user == null) return;
        Ui.prompt(this, "设置好友备注", "备注名（最多 20 字）", user.remark, text -> {
            String remark = text.length() > 20 ? text.substring(0, 20) : text;
            Ui.runIo(() -> {
                try {
                    String saved = Api.api().setRemark(userId, remark);
                    Ui.runMain(() -> {
                        user.remark = saved == null || saved.trim().isEmpty() ? remark : saved;
                        render();
                        Ui.toast(this, "备注已更新");
                    });
                } catch (Exception e) {
                    Ui.toast(this, e.getMessage() == null ? "保存失败" : e.getMessage());
                }
            });
        });
    }

    private void openChat() {
        if (user == null) return;
        ChatActivity.startDm(this, user);
    }

    private void removeFriend() {
        Ui.confirm(this, "删除好友", "确定删除该好友？", () ->
                Ui.runIo(() -> {
                    try {
                        Api.api().deleteFriend(userId);
                        Ui.runMain(() -> {
                            Ui.toast(this, "已删除好友");
                            finish();
                        });
                    } catch (Exception e) {
                        Ui.toast(this, e.getMessage() == null ? "删除失败" : e.getMessage());
                    }
                }));
    }

    private void block() {
        Ui.confirm(this, "拉黑", "拉黑后将解除好友关系，双方互相收不到消息，确定拉黑？", () ->
                Ui.runIo(() -> {
                    try {
                        Api.api().blockUser(userId);
                        Ui.runMain(() -> {
                            Ui.toast(this, "已拉黑该用户");
                            finish();
                        });
                    } catch (Exception e) {
                        Ui.toast(this, e.getMessage() == null ? "操作失败" : e.getMessage());
                    }
                }));
    }
}
