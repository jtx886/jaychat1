package com.jaychat.app.ui;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.widget.PopupMenu;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.jaychat.app.Api;
import com.jaychat.app.AvatarView;
import com.jaychat.app.Models;
import com.jaychat.app.R;
import com.jaychat.app.Store;
import com.jaychat.app.Ui;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** 我的动态 / TA 的动态 */
public class UserMomentsActivity extends AppCompatActivity {

    private static final String EXT_ID = "user_id";
    private static final String EXT_NAME = "user_name";

    public static void start(Activity a, int userId, String name) {
        Intent i = new Intent(a, UserMomentsActivity.class);
        i.putExtra(EXT_ID, userId);
        i.putExtra(EXT_NAME, name);
        a.startActivity(i);
    }

    private int userId;
    private boolean self;
    private Models.User user;

    private AvatarView avatar;
    private TextView tvTitle, tvSub, tvName, tvMeta, btnChat, btnPost, tvEmpty;
    private RecyclerView recycler;
    private SwipeRefreshLayout swipe;
    private MomentAdapter adapter;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_user_moments);
        userId = getIntent().getIntExtra(EXT_ID, 0);
        String name = getIntent().getStringExtra(EXT_NAME);
        self = userId == myId() || userId <= 0;
        if (self) userId = myId();
        if (name == null) name = "";

        avatar = findViewById(R.id.avatar);
        tvTitle = findViewById(R.id.tvTitle);
        tvSub = findViewById(R.id.tvSub);
        tvName = findViewById(R.id.tvName);
        tvMeta = findViewById(R.id.tvMeta);
        btnChat = findViewById(R.id.btnChat);
        btnPost = findViewById(R.id.btnPost);
        tvEmpty = findViewById(R.id.tvEmpty);
        recycler = findViewById(R.id.recycler);
        swipe = findViewById(R.id.swipe);

        tvTitle.setText(self ? "我的动态" : "TA 的动态");
        tvName.setText(name);
        btnPost.setVisibility(self ? View.VISIBLE : View.GONE);
        btnChat.setVisibility(self ? View.GONE : View.VISIBLE);

        findViewById(R.id.btnBack).setOnClickListener(v -> finish());
        btnPost.setOnClickListener(v -> startActivity(new Intent(this, PostMomentActivity.class)));
        btnChat.setOnClickListener(v -> {
            if (user != null) ChatActivity.startDm(this, user);
        });

        adapter = new MomentAdapter(new MomentAdapter.Listener() {
            @Override
            public void onLike(Models.Moment m) {
                like(m);
            }

            @Override
            public void onComment(Models.Moment m) {
                quickComment(m);
            }

            @Override
            public void onMore(Models.Moment m, View anchor) {
                more(m, anchor);
            }

            @Override
            public void onMedia(Models.MomentMedia mm) {
                if (mm.isVideo()) MediaDialogs.showVideo(UserMomentsActivity.this, mm.url);
                else MediaDialogs.showImage(UserMomentsActivity.this, mm.url);
            }

            @Override
            public void onCommentLong(Models.Moment m, Models.MomentComment c) {
                deleteComment(m, c);
            }

            @Override
            public void onOpen(Models.Moment m) {
                MomentDetailActivity.start(UserMomentsActivity.this, m.id);
            }
        });
        recycler.setLayoutManager(new LinearLayoutManager(this));
        recycler.setAdapter(adapter);
        swipe.setColorSchemeColors(0xFF6D8CFF, 0xFF35C6FF);
        swipe.setOnRefreshListener(this::load);
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
        load();
    }

    private void load() {
        Ui.runIo(() -> {
            Models.User u = null;
            List<Models.Moment> list = new ArrayList<>();
            try {
                u = self ? Api.api().me() : Api.api().user(userId);
                list = self ? Api.api().myMoments() : Api.api().userMoments(userId);
            } catch (Exception e) {
                Ui.runMain(() -> Ui.toast(this, e.getMessage() == null ? "加载失败" : e.getMessage()));
            }
            final Models.User gotUser = u;
            final List<Models.Moment> gotList = list;
            Ui.runMain(() -> {
                if (isFinishing()) return;
                swipe.setRefreshing(false);
                user = gotUser;
                Models.User ud = gotUser;
                if (ud != null) {
                    avatar.bind(ud.displayName(), ud.avatar, ud.online);
                    tvName.setText(ud.displayName());
                    String meta = (ud.online ? "在线" : "离线") + " · ID " + ud.id;
                    if (!ud.bio.isEmpty()) meta += " · " + ud.bio;
                    tvMeta.setText(meta);
                }
                adapter.setData(gotList);
                boolean empty = gotList.isEmpty();
                tvSub.setText(gotList.size() + " 条动态");
                tvEmpty.setText(self ? "还没有发布过动态" : "TA 还没有发布动态");
                tvEmpty.setVisibility(empty ? View.VISIBLE : View.GONE);
                recycler.setVisibility(empty ? View.GONE : View.VISIBLE);
            });
        });
    }

    private void like(Models.Moment m) {
        Ui.runIo(() -> {
            try {
                Models.Moment updated = Api.api().likeMoment(m.id);
                Ui.runMain(() -> adapter.replace(updated));
            } catch (Exception e) {
                Ui.toast(this, e.getMessage() == null ? "操作失败" : e.getMessage());
            }
        });
    }

    private void quickComment(Models.Moment m) {
        Ui.prompt(this, "评论", "写点什么…", "", text -> {
            if (text.isEmpty()) return;
            Ui.runIo(() -> {
                try {
                    Models.Moment updated = Api.api().commentMoment(m.id, text);
                    Ui.runMain(() -> adapter.replace(updated));
                } catch (Exception e) {
                    Ui.toast(this, e.getMessage() == null ? "评论失败" : e.getMessage());
                }
            });
        });
    }

    private void deleteComment(Models.Moment m, Models.MomentComment c) {
        if (!c.isMine && !m.isMine) return;
        Ui.confirm(this, "删除评论", "确定删除这条评论？", () ->
                Ui.runIo(() -> {
                    try {
                        Models.Moment updated = Api.api().deleteMomentComment(m.id, c.id);
                        Ui.runMain(() -> adapter.replace(updated));
                    } catch (Exception e) {
                        Ui.toast(this, e.getMessage() == null ? "删除失败" : e.getMessage());
                    }
                }));
    }

    private void more(Models.Moment m, View anchor) {
        PopupMenu menu = new PopupMenu(anchor.getContext(), anchor);
        if (!m.isMine) {
            menu.getMenu().add("查看详情");
            menu.setOnMenuItemClickListener(item -> {
                MomentDetailActivity.start(this, m.id);
                return true;
            });
            menu.show();
            return;
        }
        menu.getMenu().add("编辑文案");
        menu.getMenu().add("删除动态");
        menu.setOnMenuItemClickListener(item -> {
            if ("编辑文案".equals(item.getTitle().toString())) {
                Ui.prompt(this, "编辑文案", "输入新的内容", m.text, text ->
                        Ui.runIo(() -> {
                            try {
                                Models.Moment updated = Api.api().updateMomentText(m.id, text);
                                Ui.runMain(() -> adapter.replace(updated));
                            } catch (Exception e) {
                                Ui.toast(this, e.getMessage() == null ? "保存失败" : e.getMessage());
                            }
                        }));
            } else {
                Ui.confirm(this, "删除动态", "删除后不可恢复，确定删除？", () ->
                        Ui.runIo(() -> {
                            try {
                                Api.api().deleteMoment(m.id);
                                Ui.runMain(() -> {
                                    adapter.remove(m.id);
                                    Ui.toast(this, "已删除");
                                });
                            } catch (Exception e) {
                                Ui.toast(this, e.getMessage() == null ? "删除失败" : e.getMessage());
                            }
                        }));
            }
            return true;
        });
        menu.show();
    }
}
