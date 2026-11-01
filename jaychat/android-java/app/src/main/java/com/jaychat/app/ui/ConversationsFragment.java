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
import com.jaychat.app.Models;
import com.jaychat.app.R;
import com.jaychat.app.Store;
import com.jaychat.app.Ui;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class ConversationsFragment extends Fragment {

    private RecyclerView recycler;
    private SwipeRefreshLayout swipe;
    private TextView tvSub, tvEmpty;
    private ConversationAdapter adapter;
    private boolean loaded;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_list, container, false);
        recycler = root.findViewById(R.id.recycler);
        swipe = root.findViewById(R.id.swipe);
        tvSub = root.findViewById(R.id.tvSub);
        tvEmpty = root.findViewById(R.id.tvEmpty);
        TextView title = root.findViewById(R.id.tvTitle);
        title.setText("Jay Chat");

        adapter = new ConversationAdapter(c -> {
            if (getActivity() == null) return;
            ChatActivity.start(getActivity(), c);
        }, this::showMenu);
        recycler.setLayoutManager(new LinearLayoutManager(getContext()));
        recycler.setAdapter(adapter);

        swipe.setColorSchemeColors(0xFF6D8CFF, 0xFF35C6FF);
        swipe.setOnRefreshListener(this::load);
        root.findViewById(R.id.btnRefresh).setOnClickListener(v -> load());
        View extra = root.findViewById(R.id.btnExtra);
        extra.setVisibility(View.VISIBLE);
        extra.setOnClickListener(this::showExtraMenu);
        return root;
    }

    private void showExtraMenu(View anchor) {
        PopupMenu menu = new PopupMenu(anchor.getContext(), anchor);
        menu.getMenu().add("添加好友");
        menu.getMenu().add("创建群聊");
        menu.getMenu().add("发布动态");
        menu.setOnMenuItemClickListener(item -> {
            if (getActivity() == null) return true;
            String title = item.getTitle().toString();
            if ("添加好友".equals(title)) {
                startActivity(new Intent(getActivity(), AddFriendActivity.class));
            } else if ("创建群聊".equals(title)) {
                startActivity(new Intent(getActivity(), CreateGroupActivity.class));
            } else {
                startActivity(new Intent(getActivity(), PostMomentActivity.class));
            }
            return true;
        });
        menu.show();
    }

    private static int myId() {
        try {
            return new JSONObject(Store.userJson()).optInt("id", 0);
        } catch (Exception e) {
            return 0;
        }
    }

    private static int peerId(Models.Conversation c) {
        String[] parts = c.id.split("_");
        if (parts.length < 2) return 0;
        try {
            int a = Integer.parseInt(parts[0]);
            int b = Integer.parseInt(parts[1]);
            return a == myId() ? b : a;
        } catch (Exception e) {
            return 0;
        }
    }

    private void showMenu(Models.Conversation c, View anchor) {
        List<String> labels = new ArrayList<>();
        List<Runnable> actions = new ArrayList<>();

        labels.add(c.pinned ? "取消置顶" : "置顶会话");
        actions.add(() -> Ui.runIo(() -> {
            try {
                Api.api().pinConversation(c.type, c.id, !c.pinned);
                Ui.runMain(() -> {
                    Ui.toast(getContext(), c.pinned ? "已取消置顶" : "已置顶");
                    load();
                });
            } catch (Exception e) {
                Ui.toast(getContext(), e.getMessage() == null ? "操作失败" : e.getMessage());
            }
        }));

        labels.add(c.dnd ? "关闭消息免打扰" : "开启消息免打扰");
        actions.add(() -> Ui.runIo(() -> {
            try {
                if (c.isGroup()) {
                    Api.api().groupDnd(Integer.parseInt(c.id), !c.dnd);
                } else {
                    Api.api().dmDnd(peerId(c), !c.dnd);
                }
                Ui.runMain(() -> {
                    Ui.toast(getContext(), c.dnd ? "已关闭免打扰" : "已开启免打扰");
                    load();
                });
            } catch (Exception e) {
                Ui.toast(getContext(), e.getMessage() == null ? "操作失败" : e.getMessage());
            }
        }));

        if (c.isGroup()) {
            labels.add("群资料");
            actions.add(() -> {
                if (getActivity() == null) return;
                try {
                    GroupInfoActivity.start(getActivity(), Integer.parseInt(c.id));
                } catch (Exception ignored) {
                }
            });
        } else {
            labels.add("好友资料");
            actions.add(() -> {
                if (getActivity() == null) return;
                int peer = peerId(c);
                if (peer > 0) FriendInfoActivity.start(getActivity(), peer);
            });
        }

        PopupMenu menu = new PopupMenu(anchor.getContext(), anchor);
        for (String label : labels) menu.getMenu().add(label);
        menu.setOnMenuItemClickListener(item -> {
            int index = labels.indexOf(item.getTitle().toString());
            if (index >= 0) actions.get(index).run();
            return true;
        });
        menu.show();
    }

    @Override
    public void onResume() {
        super.onResume();
        load();
    }

    private void load() {
        Ui.runIo(() -> {
            try {
                List<Models.Conversation> list = Api.api().conversations();
                Ui.runMain(() -> {
                    if (!isAdded()) return;
                    adapter.setData(list);
                    swipe.setRefreshing(false);
                    loaded = true;
                    tvSub.setText(list.isEmpty() ? "暂无会话" : list.size() + " 个会话");
                    tvEmpty.setVisibility(list.isEmpty() ? View.VISIBLE : View.GONE);
                    tvEmpty.setText("还没有聊天，去通讯录找好友吧");
                });
            } catch (Exception e) {
                Ui.runMain(() -> {
                    if (!isAdded()) return;
                    swipe.setRefreshing(false);
                    if (!loaded) {
                        tvSub.setText("加载失败，下拉重试");
                        tvEmpty.setVisibility(View.VISIBLE);
                        tvEmpty.setText(e.getMessage() == null ? "加载失败" : e.getMessage());
                    }
                });
            }
        });
    }

    @Override
    public void onHiddenChanged(boolean hidden) {
        super.onHiddenChanged(hidden);
        if (!hidden) load();
    }

    static class ConversationAdapter extends RecyclerView.Adapter<ConversationAdapter.VH> {
        interface OnClick {
            void onClick(Models.Conversation c);
        }

        interface OnLongClick {
            void onLongClick(Models.Conversation c, View anchor);
        }

        private final List<Models.Conversation> data = new ArrayList<>();
        private final OnClick onClick;
        private final OnLongClick onLongClick;

        ConversationAdapter(OnClick onClick, OnLongClick onLongClick) {
            this.onClick = onClick;
            this.onLongClick = onLongClick;
        }

        void setData(List<Models.Conversation> list) {
            data.clear();
            data.addAll(list);
            notifyDataSetChanged();
        }

        @NonNull
        @Override
        public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            return new VH(LayoutInflater.from(parent.getContext())
                    .inflate(R.layout.item_conversation, parent, false));
        }

        @Override
        public void onBindViewHolder(@NonNull VH h, int position) {
            Models.Conversation c = data.get(position);
            h.name.setText(c.name);
            h.time.setText(Ui.timeText(c.lastTime));
            h.pin.setVisibility(c.pinned ? View.VISIBLE : View.GONE);
            String last = c.lastText == null ? "" : c.lastText;
            h.last.setText(last.trim().isEmpty() ? "开始聊天吧" : Ui.lastPreview(c.lastType, last));
            h.avatar.bind(c.name, c.avatar, c.isGroup() ? null : c.online);
            if (c.unread > 0) {
                h.unread.setVisibility(View.VISIBLE);
                h.unread.setText(c.unread > 99 ? "99+" : String.valueOf(c.unread));
                h.unread.setBackgroundResource(c.dnd ? R.drawable.bg_avatar : R.drawable.bg_badge);
                h.unread.setTextColor(c.dnd ? 0xFF8F98B3 : 0xFFFFFFFF);
                h.unread.setText(c.dnd ? "•" : (c.unread > 99 ? "99+" : String.valueOf(c.unread)));
            } else {
                h.unread.setVisibility(View.GONE);
            }
            h.itemView.setOnClickListener(v -> onClick.onClick(c));
            h.itemView.setOnLongClickListener(v -> {
                if (onLongClick != null) onLongClick.onLongClick(c, v);
                return true;
            });
        }

        @Override
        public int getItemCount() {
            return data.size();
        }

        static class VH extends RecyclerView.ViewHolder {
            com.jaychat.app.AvatarView avatar;
            TextView name, time, last, unread, pin;

            VH(@NonNull View v) {
                super(v);
                avatar = v.findViewById(R.id.avatar);
                name = v.findViewById(R.id.tvName);
                time = v.findViewById(R.id.tvTime);
                last = v.findViewById(R.id.tvLast);
                unread = v.findViewById(R.id.tvUnread);
                pin = v.findViewById(R.id.tvPin);
            }
        }
    }
}
