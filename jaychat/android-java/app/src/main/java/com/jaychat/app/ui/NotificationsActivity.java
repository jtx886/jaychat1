package com.jaychat.app.ui;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
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

/** 通知：好友申请、动态互动、群聊消息等 */
public class NotificationsActivity extends AppCompatActivity {

    private RecyclerView recycler;
    private TextView tvSub, tvEmpty;
    private NotificationAdapter adapter;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_notifications);

        recycler = findViewById(R.id.recycler);
        tvSub = findViewById(R.id.tvSub);
        tvEmpty = findViewById(R.id.tvEmpty);
        findViewById(R.id.btnBack).setOnClickListener(v -> finish());

        adapter = new NotificationAdapter(new NotificationAdapter.Listener() {
            @Override
            public void onTap(Models.Notification n) {
                if ("friend_request".equals(n.type)) {
                    startActivity(new Intent(NotificationsActivity.this, AddFriendActivity.class));
                } else if ((n.type.startsWith("moment_") || "comment_reply".equals(n.type)
                        || "moment".equals(n.refType)) && !n.refId.isEmpty()) {
                    try {
                        MomentDetailActivity.start(NotificationsActivity.this, Long.parseLong(n.refId));
                    } catch (Exception ignored) {
                    }
                } else if ("group".equals(n.refType) && !n.refId.isEmpty()) {
                    try {
                        GroupInfoActivity.start(NotificationsActivity.this, Integer.parseInt(n.refId));
                    } catch (Exception ignored) {
                    }
                } else if (n.actor != null && n.actor.id > 0) {
                    FriendInfoActivity.start(NotificationsActivity.this, n.actor.id);
                }
            }

            @Override
            public void onLongPress(Models.Notification n) {
                Ui.runIo(() -> {
                    try {
                        Api.api().deleteNotification(n.id);
                        Ui.runMain(() -> {
                            adapter.remove(n.id);
                            int left = adapter.getItemCount();
                            tvSub.setText(left + " 条通知");
                            tvEmpty.setVisibility(left == 0 ? View.VISIBLE : View.GONE);
                            recycler.setVisibility(left == 0 ? View.GONE : View.VISIBLE);
                        });
                    } catch (Exception e) {
                        Ui.toast(NotificationsActivity.this, e.getMessage() == null ? "删除失败" : e.getMessage());
                    }
                });
            }
        });
        recycler.setLayoutManager(new LinearLayoutManager(this));
        recycler.setAdapter(adapter);
        load();
    }

    private void load() {
        Ui.runIo(() -> {
            List<Models.Notification> list = new ArrayList<>();
            try {
                list = Api.api().notifications();
            } catch (Exception e) {
                Ui.runMain(() -> Ui.toast(this, e.getMessage() == null ? "加载失败" : e.getMessage()));
            }
            try {
                Api.api().markNotificationsRead();
            } catch (Exception ignored) {
            }
            final List<Models.Notification> items = list;
            Ui.runMain(() -> {
                adapter.setData(items);
                boolean empty = items.isEmpty();
                tvSub.setText(items.size() + " 条通知");
                tvEmpty.setVisibility(empty ? View.VISIBLE : View.GONE);
                recycler.setVisibility(empty ? View.GONE : View.VISIBLE);
            });
        });
    }

    static class NotificationAdapter extends RecyclerView.Adapter<NotificationAdapter.VH> {
        interface Listener {
            void onTap(Models.Notification n);

            void onLongPress(Models.Notification n);
        }

        private final List<Models.Notification> data = new ArrayList<>();
        private final Listener listener;

        NotificationAdapter(Listener listener) {
            this.listener = listener;
        }

        void setData(List<Models.Notification> list) {
            data.clear();
            data.addAll(list);
            notifyDataSetChanged();
        }

        void remove(long id) {
            for (int i = 0; i < data.size(); i++) {
                if (data.get(i).id == id) {
                    data.remove(i);
                    notifyItemRemoved(i);
                    return;
                }
            }
        }

        @NonNull
        @Override
        public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            return new VH(LayoutInflater.from(parent.getContext())
                    .inflate(R.layout.item_notification, parent, false));
        }

        @Override
        public void onBindViewHolder(@NonNull VH h, int position) {
            Models.Notification n = data.get(position);
            String name = n.actor == null ? "Jay Chat" : n.actor.displayName();
            h.avatar.bind(n.actor == null ? "J" : name, n.actor == null ? "" : n.actor.avatar, null);
            h.title.setText(name);
            h.text.setText(n.text);
            h.time.setText(Ui.relative(n.createdAt));
            h.dot.setVisibility(n.read ? View.GONE : View.VISIBLE);
            h.itemView.setOnClickListener(v -> listener.onTap(n));
            h.itemView.setOnLongClickListener(v -> {
                listener.onLongPress(n);
                return true;
            });
        }

        @Override
        public int getItemCount() {
            return data.size();
        }

        static class VH extends RecyclerView.ViewHolder {
            AvatarView avatar;
            TextView title, text, time;
            View dot;

            VH(@NonNull View v) {
                super(v);
                avatar = v.findViewById(R.id.avatar);
                title = v.findViewById(R.id.tvTitle);
                text = v.findViewById(R.id.tvText);
                time = v.findViewById(R.id.tvTime);
                dot = v.findViewById(R.id.dot);
            }
        }
    }
}
