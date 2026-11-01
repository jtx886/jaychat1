package com.jaychat.app.ui;

import android.os.Bundle;
import android.text.TextUtils;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.jaychat.app.Api;
import com.jaychat.app.AvatarView;
import com.jaychat.app.Models;
import com.jaychat.app.R;
import com.jaychat.app.Ui;

import java.util.ArrayList;
import java.util.List;

/** 后台管理：数据总览 + 用户封禁 / 禁言 */
public class AdminActivity extends AppCompatActivity {

    private LinearLayout statsGrid, trendBox;
    private RecyclerView usersList;
    private EditText etSearch;
    private TextView tvEmpty;
    private AdminUserAdapter adapter;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_admin);

        statsGrid = findViewById(R.id.statsGrid);
        trendBox = findViewById(R.id.trendBox);
        usersList = findViewById(R.id.usersList);
        etSearch = findViewById(R.id.etSearch);
        tvEmpty = findViewById(R.id.tvEmpty);

        findViewById(R.id.btnBack).setOnClickListener(v -> finish());
        findViewById(R.id.btnRefresh).setOnClickListener(v -> loadAll(""));
        findViewById(R.id.btnSearch).setOnClickListener(v ->
                loadUsers(etSearch.getText().toString().trim()));

        adapter = new AdminUserAdapter(new AdminUserAdapter.Listener() {
            @Override
            public void onBan(Models.AdminUser u) {
                choose("封禁天数", new String[]{"1 天", "3 天", "7 天", "30 天"},
                        new int[]{1, 3, 7, 30}, days -> banUser(u, days));
            }

            @Override
            public void onUnban(Models.AdminUser u) {
                Ui.runIo(() -> {
                    try {
                        Api.api().adminUnbanUser(u.id);
                        Ui.runMain(() -> {
                            Ui.toast(AdminActivity.this, "已解封");
                            loadUsers(etSearch.getText().toString().trim());
                        });
                    } catch (Exception e) {
                        Ui.runMain(() -> Ui.toast(AdminActivity.this, e.getMessage() == null ? "操作失败" : e.getMessage()));
                    }
                });
            }

            @Override
            public void onMute(Models.AdminUser u) {
                choose("禁言时长", new String[]{"10 分钟", "1 小时", "1 天", "7 天"},
                        new int[]{10, 60, 1440, 10080}, minutes -> muteUser(u, minutes));
            }

            @Override
            public void onUnmute(Models.AdminUser u) {
                Ui.runIo(() -> {
                    try {
                        Api.api().adminUnmuteUser(u.id);
                        Ui.runMain(() -> {
                            Ui.toast(AdminActivity.this, "已解除禁言");
                            loadUsers(etSearch.getText().toString().trim());
                        });
                    } catch (Exception e) {
                        Ui.runMain(() -> Ui.toast(AdminActivity.this, e.getMessage() == null ? "操作失败" : e.getMessage()));
                    }
                });
            }
        });
        usersList.setLayoutManager(new LinearLayoutManager(this));
        usersList.setAdapter(adapter);

        loadAll("");
    }

    private interface Pick {
        void onPick(int value);
    }

    private void choose(String title, String[] labels, int[] values, Pick cb) {
        new AlertDialog.Builder(this)
                .setTitle(title)
                .setItems(labels, (d, which) -> cb.onPick(values[which]))
                .show();
    }

    private void banUser(Models.AdminUser u, int days) {
        Ui.runIo(() -> {
            try {
                Api.api().adminBanUser(u.id, days);
                Ui.runMain(() -> {
                    Ui.toast(this, "已封禁");
                    loadUsers(etSearch.getText().toString().trim());
                });
            } catch (Exception e) {
                Ui.runMain(() -> Ui.toast(this, e.getMessage() == null ? "操作失败" : e.getMessage()));
            }
        });
    }

    private void muteUser(Models.AdminUser u, int minutes) {
        Ui.runIo(() -> {
            try {
                Api.api().adminMuteUser(u.id, minutes);
                Ui.runMain(() -> {
                    Ui.toast(this, "已禁言");
                    loadUsers(etSearch.getText().toString().trim());
                });
            } catch (Exception e) {
                Ui.runMain(() -> Ui.toast(this, e.getMessage() == null ? "操作失败" : e.getMessage()));
            }
        });
    }

    private void loadAll(String keyword) {
        loadOverview();
        loadUsers(keyword);
    }

    private void loadOverview() {
        Ui.runIo(() -> {
            try {
                Models.AdminOverview ov = Api.api().adminOverview();
                Ui.runMain(() -> renderOverview(ov));
            } catch (Exception e) {
                Ui.runMain(() -> Ui.toast(this, e.getMessage() == null ? "加载失败" : e.getMessage()));
            }
        });
    }

    private void loadUsers(String keyword) {
        Ui.runIo(() -> {
            try {
                List<Models.AdminUser> list = Api.api().adminUsers(keyword);
                Ui.runMain(() -> {
                    adapter.setData(list);
                    boolean empty = list.isEmpty();
                    tvEmpty.setVisibility(empty ? View.VISIBLE : View.GONE);
                    usersList.setVisibility(empty ? View.GONE : View.VISIBLE);
                    if (empty) tvEmpty.setText(TextUtils.isEmpty(keyword) ? "暂无用户" : "没有找到用户");
                });
            } catch (Exception e) {
                Ui.runMain(() -> Ui.toast(this, e.getMessage() == null ? "加载失败" : e.getMessage()));
            }
        });
    }

    private void renderOverview(Models.AdminOverview ov) {
        statsGrid.removeAllViews();
        Models.AdminStats s = ov.stats;
        String[][] cards = {
                {String.valueOf(s.totalUsers), "总用户"},
                {String.valueOf(s.todayUsers), "今日新增"},
                {String.valueOf(s.weekUsers), "本周新增"},
                {String.valueOf(s.onlineUsers), "在线用户"},
                {String.valueOf(s.groups), "群聊"},
                {String.valueOf(s.messages), "总消息"},
                {String.valueOf(s.todayMessages), "今日消息"},
                {String.valueOf(s.moments), "动态"},
                {String.valueOf(s.banned), "封禁中"},
                {String.valueOf(s.muted), "禁言中"},
        };
        LayoutInflater inflater = LayoutInflater.from(this);
        LinearLayout row = null;
        for (int i = 0; i < cards.length; i++) {
            if (i % 3 == 0) {
                row = new LinearLayout(this);
                row.setOrientation(LinearLayout.HORIZONTAL);
                LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
                lp.topMargin = Ui.dp(this, 8);
                row.setLayoutParams(lp);
                statsGrid.addView(row);
            }
            LinearLayout card = new LinearLayout(this);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(0,
                    ViewGroup.LayoutParams.WRAP_CONTENT, 1);
            lp.rightMargin = Ui.dp(this, 8);
            card.setLayoutParams(lp);
            card.setBackgroundResource(R.drawable.card_glass_sm);
            card.setOrientation(LinearLayout.VERTICAL);
            card.setPadding(Ui.dp(this, 12), Ui.dp(this, 12), Ui.dp(this, 12), Ui.dp(this, 12));
            TextView value = new TextView(this);
            value.setText(cards[i][0]);
            value.setTextColor(0xFF7FE7FF);
            value.setTextSize(19);
            value.setTypeface(null, android.graphics.Typeface.BOLD);
            TextView label = new TextView(this);
            label.setText(cards[i][1]);
            label.setTextColor(0xFFAEB6CC);
            label.setTextSize(10);
            label.setPadding(0, Ui.dp(this, 3), 0, 0);
            card.addView(value);
            card.addView(label);
            row.addView(card);
        }

        trendBox.removeAllViews();
        if (ov.days.isEmpty()) {
            TextView tv = new TextView(this);
            tv.setText("暂无趋势数据");
            tv.setTextColor(0xFF6E7793);
            tv.setTextSize(12);
            trendBox.addView(tv);
            return;
        }
        int max = 1;
        for (Models.AdminDay d : ov.days) {
            max = Math.max(max, Math.max(d.users, d.messages));
        }
        for (Models.AdminDay d : ov.days) {
            LinearLayout line = new LinearLayout(this);
            line.setOrientation(LinearLayout.HORIZONTAL);
            line.setGravity(android.view.Gravity.CENTER_VERTICAL);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT);
            lp.topMargin = Ui.dp(this, 6);
            line.setLayoutParams(lp);

            TextView day = new TextView(this);
            day.setText(d.label);
            day.setTextColor(0xFFAEB6CC);
            day.setTextSize(10);
            day.setWidth(Ui.dp(this, 44));
            line.addView(day);

            line.addView(bar(d.users, max, 0xFF6D8CFF));
            line.addView(bar(d.messages, max, 0xFF35C6FF));

            TextView nums = new TextView(this);
            nums.setText(d.users + " / " + d.messages);
            nums.setTextColor(0xFF6E7793);
            nums.setTextSize(10);
            nums.setPadding(Ui.dp(this, 10), 0, 0, 0);
            line.addView(nums);
            trendBox.addView(line);
        }
        TextView legend = new TextView(this);
        legend.setText("蓝：新增用户　青：消息量");
        legend.setTextColor(0xFF6E7793);
        legend.setTextSize(9);
        legend.setPadding(0, Ui.dp(this, 8), 0, 0);
        trendBox.addView(legend);
    }

    private View bar(int value, int max, int color) {
        View v = new View(this);
        int maxW = Ui.dp(this, 110);
        int w = Math.max(Ui.dp(this, 3), (int) (maxW * (value / (float) max)));
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(w, Ui.dp(this, 7));
        lp.rightMargin = Ui.dp(this, 5);
        v.setLayoutParams(lp);
        v.setBackgroundColor(color);
        return v;
    }

    static class AdminUserAdapter extends RecyclerView.Adapter<AdminUserAdapter.VH> {
        interface Listener {
            void onBan(Models.AdminUser u);

            void onUnban(Models.AdminUser u);

            void onMute(Models.AdminUser u);

            void onUnmute(Models.AdminUser u);
        }

        private final List<Models.AdminUser> data = new ArrayList<>();
        private final Listener listener;

        AdminUserAdapter(Listener listener) {
            this.listener = listener;
        }

        void setData(List<Models.AdminUser> list) {
            data.clear();
            data.addAll(list);
            notifyDataSetChanged();
        }

        @NonNull
        @Override
        public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            return new VH(LayoutInflater.from(parent.getContext())
                    .inflate(R.layout.item_admin_user, parent, false));
        }

        @Override
        public void onBindViewHolder(@NonNull VH h, int position) {
            Models.AdminUser u = data.get(position);
            h.avatar.bind(u.username, u.avatar, u.online);
            h.name.setText(u.username);
            StringBuilder sb = new StringBuilder("ID " + u.id);
            if (!TextUtils.isEmpty(u.email)) sb.append(" · ").append(u.email);
            if (u.isAdmin || u.isOfficial) sb.append(" · 管理员");
            if (u.banned) sb.append(" · 已封禁");
            if (u.muted) sb.append(" · 已禁言");
            h.sub.setText(sb.toString());

            if (u.canOperate()) {
                h.btnBan.setVisibility(View.VISIBLE);
                h.btnMute.setVisibility(View.VISIBLE);
                h.btnBan.setText(u.banned ? "解封" : "封禁");
                h.btnMute.setText(u.muted ? "解禁" : "禁言");
                h.btnBan.setOnClickListener(v -> {
                    if (u.banned) listener.onUnban(u);
                    else listener.onBan(u);
                });
                h.btnMute.setOnClickListener(v -> {
                    if (u.muted) listener.onUnmute(u);
                    else listener.onMute(u);
                });
            } else {
                h.btnBan.setVisibility(View.GONE);
                h.btnMute.setVisibility(View.GONE);
            }
        }

        @Override
        public int getItemCount() {
            return data.size();
        }

        static class VH extends RecyclerView.ViewHolder {
            AvatarView avatar;
            TextView name, sub, btnBan, btnMute;

            VH(@NonNull View v) {
                super(v);
                avatar = v.findViewById(R.id.avatar);
                name = v.findViewById(R.id.tvName);
                sub = v.findViewById(R.id.tvSub);
                btnBan = v.findViewById(R.id.btnBan);
                btnMute = v.findViewById(R.id.btnMute);
            }
        }
    }
}
