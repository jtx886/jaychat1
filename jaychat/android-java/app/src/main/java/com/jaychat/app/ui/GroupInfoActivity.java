package com.jaychat.app.ui;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.appcompat.widget.SwitchCompat;

import com.jaychat.app.Api;
import com.jaychat.app.AvatarView;
import com.jaychat.app.MediaUtil;
import com.jaychat.app.Models;
import com.jaychat.app.R;
import com.jaychat.app.Store;
import com.jaychat.app.Ui;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** 群聊信息：群资料、公告、成员管理与邀请 */
public class GroupInfoActivity extends AppCompatActivity {

    private static final String EXT_ID = "group_id";

    public static void start(Activity a, int groupId) {
        Intent i = new Intent(a, GroupInfoActivity.class);
        i.putExtra(EXT_ID, groupId);
        a.startActivity(i);
    }

    private static final String[] MUTE_LABELS = {"10 分钟", "1 小时", "1 天", "7 天", "永久"};
    private static final int[] MUTE_SECONDS = {600, 3600, 86400, 604800, 315360000};

    private int groupId;
    private int myId;
    private Models.GroupDetail detail;

    private AvatarView avatar;
    private TextView tvName, tvMeta, tvSub, tvAnnouncement, tvMemberTitle, btnQuit;
    private LinearLayout editRow, membersBox, announceBox;
    private SwitchCompat switchDnd;
    private boolean bindDnd;

    private final List<Models.User> friends = new ArrayList<>();
    private ActivityResultLauncher<String> imagePicker;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_group_info);
        groupId = getIntent().getIntExtra(EXT_ID, 0);
        myId = myId();

        avatar = findViewById(R.id.avatar);
        tvName = findViewById(R.id.tvName);
        tvMeta = findViewById(R.id.tvMeta);
        tvSub = findViewById(R.id.tvSub);
        tvAnnouncement = findViewById(R.id.tvAnnouncement);
        tvMemberTitle = findViewById(R.id.tvMemberTitle);
        btnQuit = findViewById(R.id.btnQuit);
        editRow = findViewById(R.id.editRow);
        membersBox = findViewById(R.id.membersBox);
        announceBox = findViewById(R.id.announceBox);
        switchDnd = findViewById(R.id.switchDnd);

        findViewById(R.id.btnBack).setOnClickListener(v -> finish());
        findViewById(R.id.rowChat).setOnClickListener(v -> {
            if (detail == null) return;
            ChatActivity.startGroup(this, detail.group);
            finish();
        });
        findViewById(R.id.rowInvite).setOnClickListener(v -> openInvite());
        findViewById(R.id.btnEditName).setOnClickListener(v -> editName());
        findViewById(R.id.btnEditAvatar).setOnClickListener(v -> chooseAvatar());
        announceBox.setOnClickListener(v -> editAnnouncement());
        btnQuit.setOnClickListener(v -> quit());
        switchDnd.setOnCheckedChangeListener((b, checked) -> {
            if (bindDnd || detail == null) return;
            Ui.runIo(() -> {
                try {
                    Api.api().groupDnd(groupId, checked);
                    detail.group.dnd = checked;
                    Ui.toast(this, checked ? "已开启免打扰" : "已关闭免打扰");
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

        imagePicker = registerForActivityResult(new ActivityResultContracts.GetContent(),
                uri -> {
                    if (uri != null) uploadAvatar(uri);
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
            Models.GroupDetail d = null;
            try {
                d = Api.api().groupDetail(groupId);
            } catch (Exception e) {
                Ui.runMain(() -> {
                    Ui.toast(this, e.getMessage() == null ? "加载失败" : e.getMessage());
                    finish();
                });
                return;
            }
            final Models.GroupDetail got = d;
            Ui.runMain(() -> {
                if (isFinishing()) return;
                detail = got;
                render();
            });
        });
    }

    private void render() {
        Models.Group g = detail.group;
        avatar.bind(g.name, g.avatar, null);
        tvName.setText(g.name);
        String roleText = "owner".equals(detail.myRole) ? "群主"
                : "admin".equals(detail.myRole) ? "管理员" : "成员";
        tvMeta.setText("群主：" + (g.ownerName.isEmpty() ? "—" : g.ownerName)
                + " · 我的身份：" + roleText
                + "\n群 ID：" + g.id + " · " + detail.onlineCount + "/" + detail.members.size() + " 人在线");
        tvSub.setText(detail.members.size() + " 位成员 · " + detail.onlineCount + " 人在线");
        tvAnnouncement.setText(g.announcement == null || g.announcement.trim().isEmpty()
                ? "暂无公告" : g.announcement);
        tvMemberTitle.setText("群成员（" + detail.members.size() + "）");

        editRow.setVisibility(detail.canEdit ? View.VISIBLE : View.GONE);
        bindDnd = true;
        switchDnd.setChecked(g.dnd);
        bindDnd = false;

        boolean official = g.isOfficial;
        btnQuit.setVisibility(official || "owner".equals(detail.myRole) ? View.GONE : View.VISIBLE);
        btnQuit.setText(official ? "" : "退出群聊");

        renderMembers();
    }

    private void renderMembers() {
        membersBox.removeAllViews();
        List<Models.GroupMember> list = new ArrayList<>(detail.members);
        list.sort((a, b) -> {
            int wa = a.isOwner() ? 2 : a.isAdmin() ? 1 : 0;
            int wb = b.isOwner() ? 2 : b.isAdmin() ? 1 : 0;
            if (wa != wb) return wb - wa;
            return a.user.id - b.user.id;
        });
        for (Models.GroupMember m : list) {
            View row = LayoutInflater.from(this).inflate(R.layout.item_group_member, membersBox, false);
            AvatarView av = row.findViewById(R.id.avatar);
            TextView name = row.findViewById(R.id.tvName);
            TextView sub = row.findViewById(R.id.tvSub);
            TextView role = row.findViewById(R.id.tvRole);
            av.bind(m.user.displayName(), m.user.avatar, m.online);
            name.setText(m.user.displayName() + (m.user.id == myId ? "（我）" : ""));
            StringBuilder sb = new StringBuilder(m.online ? "在线" : "离线");
            if (m.muted()) sb.append(" · 已禁言");
            sub.setText(sb.toString());
            if (m.isOwner()) {
                role.setVisibility(View.VISIBLE);
                role.setText("群主");
            } else if (m.isAdmin()) {
                role.setVisibility(View.VISIBLE);
                role.setText("管理员");
            } else {
                role.setVisibility(View.GONE);
            }
            row.setOnClickListener(v -> {
                if (m.user.id == myId) return;
                openMember(m);
            });
            membersBox.addView(row);
        }
    }

    private void editName() {
        if (detail == null) return;
        Ui.prompt(this, "修改群名称", "群名称（最多 20 字）", detail.group.name, text -> {
            if (text.isEmpty()) {
                Ui.toast(this, "群名称不能为空");
                return;
            }
            String name = text.length() > 20 ? text.substring(0, 20) : text;
            try {
                JSONObject body = new JSONObject();
                body.put("name", name);
                Ui.runIo(() -> {
                    try {
                        Models.Group g = Api.api().updateGroup(groupId, body);
                        Ui.runMain(() -> {
                            detail.group = g;
                            tvName.setText(g.name);
                            avatar.bind(g.name, g.avatar, null);
                            Ui.toast(this, "已更新");
                        });
                    } catch (Exception e) {
                        Ui.toast(this, e.getMessage() == null ? "保存失败" : e.getMessage());
                    }
                });
            } catch (Exception ignored) {
            }
        });
    }

    private void editAnnouncement() {
        if (detail == null || !detail.canEdit) return;
        Ui.prompt(this, "群公告", "填写群公告（最多 200 字）",
                detail.group.announcement, text -> patchAnnouncement(text));
    }

    private void patchAnnouncement(String text) {
        try {
            JSONObject body = new JSONObject();
            body.put("announcement", text.length() > 200 ? text.substring(0, 200) : text);
            Ui.runIo(() -> {
                try {
                    Models.Group g = Api.api().updateGroup(groupId, body);
                    detail.group = g;
                    Ui.runMain(() -> {
                        tvAnnouncement.setText(g.announcement.isEmpty() ? "暂无公告" : g.announcement);
                        Ui.toast(this, "已更新");
                    });
                } catch (Exception e) {
                    Ui.toast(this, e.getMessage() == null ? "保存失败" : e.getMessage());
                }
            });
        } catch (Exception ignored) {
        }
    }

    private void chooseAvatar() {
        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        int pad = Ui.dp(this, 18);
        box.setPadding(pad, Ui.dp(this, 8), pad, 0);
        AlertDialog dialog = new AlertDialog.Builder(this)
                .setTitle("更换群头像")
                .setView(box)
                .setNegativeButton("取消", null)
                .create();

        for (int row = 0; row < 2; row++) {
            LinearLayout r = new LinearLayout(this);
            r.setOrientation(LinearLayout.HORIZONTAL);
            r.setGravity(Gravity.CENTER);
            for (int col = 0; col < 6; col++) {
                final int idx = row * 6 + col;
                TextView tv = new TextView(this);
                int size = Ui.dp(this, 42);
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(size, size);
                lp.setMargins(Ui.dp(this, 5), Ui.dp(this, 5), Ui.dp(this, 5), Ui.dp(this, 5));
                tv.setLayoutParams(lp);
                AvatarView.applyPreset(tv, idx);
                tv.setGravity(Gravity.CENTER);
                tv.setTextSize(18);
                tv.setOnClickListener(v -> {
                    dialog.dismiss();
                    applyAvatar("preset:" + idx);
                });
                r.addView(tv);
            }
            box.addView(r);
        }
        TextView upload = new TextView(this);
        upload.setText("上传本地图片");
        upload.setTextColor(0xFF9DB6FF);
        upload.setTextSize(14);
        upload.setGravity(Gravity.CENTER);
        upload.setPadding(0, Ui.dp(this, 12), 0, Ui.dp(this, 12));
        upload.setOnClickListener(v -> {
            dialog.dismiss();
            imagePicker.launch("image/*");
        });
        box.addView(upload);
        dialog.show();
    }

    private void uploadAvatar(Uri uri) {
        Ui.runIo(() -> {
            try {
                byte[] bytes = MediaUtil.compressImage(this, uri);
                if (bytes == null) throw new Api.ApiException(500, "无法读取该图片");
                JSONObject up = Api.api().uploadBytes(bytes,
                        MediaUtil.queryDisplayName(this, uri, "avatar.jpg"), "image/jpeg");
                String url = up.optString("url", "");
                if (url.isEmpty()) throw new Api.ApiException(500, "上传失败");
                applyAvatar(url);
            } catch (Exception e) {
                Ui.toast(this, e.getMessage() == null ? "上传失败" : e.getMessage());
            }
        });
    }

    private void applyAvatar(final String avatarValue) {
        Ui.runIo(() -> {
            try {
                JSONObject body = new JSONObject();
                body.put("avatar", avatarValue);
                Models.Group g = Api.api().updateGroup(groupId, body);
                Ui.runMain(() -> {
                    if (isFinishing()) return;
                    detail.group.avatar = g.avatar;
                    avatar.bind(g.name, g.avatar, null);
                    Ui.toast(this, "已更新头像");
                });
            } catch (Exception e) {
                Ui.toast(this, e.getMessage() == null ? "保存失败" : e.getMessage());
            }
        });
    }

    private void openInvite() {
        Ui.runIo(() -> {
            List<Models.User> list = new ArrayList<>();
            try {
                list = Api.api().friends();
            } catch (Exception e) {
                Ui.runMain(() -> Ui.toast(this, e.getMessage() == null ? "加载失败" : e.getMessage()));
                return;
            }
            final List<Models.User> got = list;
            Ui.runMain(() -> {
                friends.clear();
                friends.addAll(got);
                showInviteDialog();
            });
        });
    }

    private void showInviteDialog() {
        if (detail == null) return;
        List<Models.User> available = new ArrayList<>();
        List<Integer> memberIds = new ArrayList<>();
        for (Models.GroupMember m : detail.members) memberIds.add(m.user.id);
        for (Models.User u : friends) {
            if (!memberIds.contains(u.id)) available.add(u);
        }
        if (available.isEmpty()) {
            Ui.alert(this, "邀请好友入群", "没有可邀请的好友（好友可能都已在群内）");
            return;
        }
        String[] labels = new String[available.size()];
        final boolean[] checked = new boolean[available.size()];
        for (int i = 0; i < available.size(); i++) {
            labels[i] = available.get(i).displayName();
        }
        new AlertDialog.Builder(this)
                .setTitle("邀请好友入群")
                .setMultiChoiceItems(labels, checked, (d, which, isChecked) -> checked[which] = isChecked)
                .setNegativeButton("取消", null)
                .setPositiveButton("邀请", (d, w) -> {
                    List<Integer> ids = new ArrayList<>();
                    for (int i = 0; i < checked.length; i++) {
                        if (checked[i]) ids.add(available.get(i).id);
                    }
                    if (!ids.isEmpty()) invite(ids);
                })
                .show();
    }

    private void invite(List<Integer> ids) {
        Ui.runIo(() -> {
            try {
                Api.api().inviteGroup(groupId, ids);
                Ui.runMain(() -> {
                    Ui.toast(this, "已邀请入群");
                    load();
                });
            } catch (Exception e) {
                Ui.toast(this, e.getMessage() == null ? "邀请失败" : e.getMessage());
            }
        });
    }

    private void openMember(final Models.GroupMember m) {
        List<String> labels = new ArrayList<>();
        List<Runnable> actions = new ArrayList<>();
        labels.add("查看资料");
        actions.add(() -> FriendInfoActivity.start(this, m.user.id));

        if (detail.canSetAdmin && !m.isOwner()) {
            if (m.isAdmin()) {
                labels.add("取消管理员");
                actions.add(() -> setAdmin(m.user.id, false));
            } else {
                labels.add("设为管理员");
                actions.add(() -> setAdmin(m.user.id, true));
            }
        }
        if (detail.canMute && !m.isOwner()) {
            if (m.muted()) {
                labels.add("解除禁言");
                actions.add(() -> mute(m.user.id, 0));
            } else {
                labels.add("禁言");
                actions.add(() -> chooseMute(m.user.id));
            }
        }
        if (detail.canTransfer && !m.isOwner()) {
            labels.add("转让群主");
            actions.add(() -> transfer(m.user.id));
        }
        if (detail.canKick && !m.isOwner()) {
            labels.add("移出群聊");
            actions.add(() -> kick(m.user.id));
        }

        new AlertDialog.Builder(this)
                .setTitle(m.user.displayName())
                .setItems(labels.toArray(new String[0]), (d, which) -> actions.get(which).run())
                .show();
    }

    private void setAdmin(int userId, boolean admin) {
        Ui.runIo(() -> {
            try {
                Api.api().setAdmin(groupId, userId, admin);
                Ui.runMain(() -> {
                    Ui.toast(this, "操作成功");
                    load();
                });
            } catch (Exception e) {
                Ui.toast(this, e.getMessage() == null ? "操作失败" : e.getMessage());
            }
        });
    }

    private void chooseMute(final int userId) {
        new AlertDialog.Builder(this)
                .setTitle("禁言时长")
                .setItems(MUTE_LABELS, (d, which) -> mute(userId, MUTE_SECONDS[which]))
                .show();
    }

    private void mute(int userId, int seconds) {
        Ui.runIo(() -> {
            try {
                Api.api().muteMember(groupId, userId, seconds);
                Ui.runMain(() -> {
                    Ui.toast(this, seconds == 0 ? "已解除禁言" : "已禁言");
                    load();
                });
            } catch (Exception e) {
                Ui.toast(this, e.getMessage() == null ? "操作失败" : e.getMessage());
            }
        });
    }

    private void transfer(final int userId) {
        Ui.confirm(this, "转让群主", "转让后你将成为普通成员，确定转让？", () ->
                Ui.runIo(() -> {
                    try {
                        Api.api().transferOwner(groupId, userId);
                        Ui.runMain(() -> {
                            Ui.toast(this, "已转让群主");
                            load();
                        });
                    } catch (Exception e) {
                        Ui.toast(this, e.getMessage() == null ? "操作失败" : e.getMessage());
                    }
                }));
    }

    private void kick(final int userId) {
        Ui.confirm(this, "移出群聊", "确定将该成员移出群聊？", () ->
                Ui.runIo(() -> {
                    try {
                        Api.api().kickMember(groupId, userId);
                        Ui.runMain(() -> {
                            Ui.toast(this, "已移出群聊");
                            load();
                        });
                    } catch (Exception e) {
                        Ui.toast(this, e.getMessage() == null ? "操作失败" : e.getMessage());
                    }
                }));
    }

    private void quit() {
        Ui.confirm(this, "退出群聊", "退出后将不再接收该群消息，确定退出？", () ->
                Ui.runIo(() -> {
                    try {
                        Api.api().quitGroup(groupId);
                        Ui.runMain(() -> {
                            Ui.toast(this, "已退出群聊");
                            finish();
                        });
                    } catch (Exception e) {
                        Ui.toast(this, e.getMessage() == null ? "退出失败" : e.getMessage());
                    }
                }));
    }
}
