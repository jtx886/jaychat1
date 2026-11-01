package com.jaychat.app.ui;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.PopupMenu;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.jaychat.app.Api;
import com.jaychat.app.MediaUtil;
import com.jaychat.app.Models;
import com.jaychat.app.R;
import com.jaychat.app.Ui;

import java.util.List;

public class MomentsFragment extends Fragment {

    private RecyclerView recycler;
    private SwipeRefreshLayout swipe;
    private TextView tvSub, tvEmpty, tvTabAll, tvTabFriends;
    private MomentAdapter adapter;
    private String scope = "all";

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_moments, container, false);
        recycler = root.findViewById(R.id.recycler);
        swipe = root.findViewById(R.id.swipe);
        tvSub = root.findViewById(R.id.tvSub);
        tvEmpty = root.findViewById(R.id.tvEmpty);
        tvTabAll = root.findViewById(R.id.tvTabAll);
        tvTabFriends = root.findViewById(R.id.tvTabFriends);
        tvTabAll.setOnClickListener(v -> switchScope("all"));
        tvTabFriends.setOnClickListener(v -> switchScope("friends"));
        renderTabs();

        adapter = new MomentAdapter(new MomentAdapter.Listener() {
            @Override
            public void onLike(Models.Moment m) {
                like(m);
            }

            @Override
            public void onComment(Models.Moment m) {
                comment(m);
            }

            @Override
            public void onMore(Models.Moment m, View anchor) {
                more(m, anchor);
            }

            @Override
            public void onMedia(Models.MomentMedia mm) {
                if (getContext() == null) return;
                if (mm.isVideo()) MediaDialogs.showVideo(getContext(), mm.url);
                else MediaDialogs.showImage(getContext(), mm.url);
            }

            @Override
            public void onCommentLong(Models.Moment m, Models.MomentComment c) {
                deleteComment(m, c);
            }

            @Override
            public void onOpen(Models.Moment m) {
                if (getActivity() != null) MomentDetailActivity.start(getActivity(), m.id);
            }
        });
        recycler.setLayoutManager(new LinearLayoutManager(getContext()));
        recycler.setAdapter(adapter);

        swipe.setColorSchemeColors(0xFF6D8CFF, 0xFF35C6FF);
        swipe.setOnRefreshListener(this::load);
        root.findViewById(R.id.btnRefresh).setOnClickListener(v -> load());
        root.findViewById(R.id.btnPost).setOnClickListener(v -> {
            if (getActivity() != null) {
                startActivity(new Intent(getActivity(), PostMomentActivity.class));
            }
        });
        return root;
    }

    @Override
    public void onResume() {
        super.onResume();
        load();
    }

    @Override
    public void onHiddenChanged(boolean hidden) {
        super.onHiddenChanged(hidden);
        if (!hidden) load();
    }

    private void switchScope(String s) {
        if (scope.equals(s)) return;
        scope = s;
        renderTabs();
        load();
    }

    private void renderTabs() {
        boolean all = "all".equals(scope);
        tvTabAll.setTextColor(all ? 0xFF9DB6FF : 0xFF6E7793);
        tvTabFriends.setTextColor(all ? 0xFF6E7793 : 0xFF9DB6FF);
        tvTabAll.getBackground().setAlpha(all ? 255 : 120);
        tvTabFriends.getBackground().setAlpha(all ? 120 : 255);
    }

    private void load() {
        Ui.runIo(() -> {
            try {
                List<Models.Moment> list = Api.api().moments(scope);
                Ui.runMain(() -> {
                    if (!isAdded()) return;
                    adapter.setData(list);
                    swipe.setRefreshing(false);
                    tvSub.setText(list.isEmpty() ? "暂无动态" : list.size() + " 条动态");
                    tvEmpty.setVisibility(list.isEmpty() ? View.VISIBLE : View.GONE);
                });
            } catch (Exception e) {
                Ui.runMain(() -> {
                    if (!isAdded()) return;
                    swipe.setRefreshing(false);
                    tvSub.setText("加载失败，下拉重试");
                });
            }
        });
    }

    private void like(Models.Moment m) {
        Ui.runIo(() -> {
            try {
                final Models.Moment updated = Api.api().likeMoment(m.id);
                Ui.runMain(() -> {
                    if (!isAdded()) return;
                    adapter.replace(updated);
                });
            } catch (Exception e) {
                Ui.toast(getContext(), e.getMessage() == null ? "操作失败" : e.getMessage());
            }
        });
    }

    private void comment(Models.Moment m) {
        Ui.prompt(getContext(), "评论", "写点什么…", "", text -> {
            if (text.isEmpty()) return;
            Ui.runIo(() -> {
                try {
                    Models.Moment updated = Api.api().commentMoment(m.id, text);
                    Ui.runMain(() -> {
                        if (!isAdded()) return;
                        adapter.replace(updated);
                    });
                } catch (Exception e) {
                    Ui.toast(getContext(), e.getMessage() == null ? "评论失败" : e.getMessage());
                }
            });
        });
    }

    private void deleteComment(Models.Moment m, Models.MomentComment c) {
        if (!c.isMine) return;
        Ui.confirm(getContext(), "删除评论", "确定删除这条评论？", () ->
                Ui.runIo(() -> {
                    try {
                        Models.Moment updated = Api.api().deleteMomentComment(m.id, c.id);
                        Ui.runMain(() -> {
                            if (!isAdded()) return;
                            adapter.replace(updated);
                        });
                    } catch (Exception e) {
                        Ui.toast(getContext(), e.getMessage() == null ? "删除失败" : e.getMessage());
                    }
                }));
    }

    private void more(Models.Moment m, View anchor) {
        PopupMenu menu = new PopupMenu(anchor.getContext(), anchor);
        menu.getMenu().add("编辑文案");
        menu.getMenu().add("删除动态");
        menu.setOnMenuItemClickListener(item -> {
            if ("编辑文案".equals(item.getTitle().toString())) {
                Ui.prompt(getContext(), "编辑文案", "输入新的内容", m.text, text ->
                        Ui.runIo(() -> {
                            try {
                                Models.Moment updated = Api.api().updateMomentText(m.id, text);
                                Ui.runMain(() -> {
                                    if (!isAdded()) return;
                                    adapter.replace(updated);
                                });
                            } catch (Exception e) {
                                Ui.toast(getContext(), e.getMessage() == null ? "保存失败" : e.getMessage());
                            }
                        }));
            } else {
                Ui.confirm(getContext(), "删除动态", "删除后不可恢复，确定删除？", () ->
                        Ui.runIo(() -> {
                            try {
                                Api.api().deleteMoment(m.id);
                                Ui.runMain(() -> {
                                    if (!isAdded()) return;
                                    adapter.remove(m.id);
                                    tvSub.setText("已删除");
                                });
                            } catch (Exception e) {
                                Ui.toast(getContext(), e.getMessage() == null ? "删除失败" : e.getMessage());
                            }
                        }));
            }
            return true;
        });
        menu.show();
    }
}
