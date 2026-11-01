package com.jaychat.app.ui;

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
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

import com.jaychat.app.Api;
import com.jaychat.app.AvatarView;
import com.jaychat.app.Models;
import com.jaychat.app.R;
import com.jaychat.app.Ui;

import java.util.ArrayList;
import java.util.List;

/** 黑名单：查看与解除拉黑 */
public class BlacklistActivity extends AppCompatActivity {

    private RecyclerView recycler;
    private SwipeRefreshLayout swipe;
    private TextView tvSub, tvEmpty;
    private final List<Models.User> data = new ArrayList<>();

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_blacklist);

        recycler = findViewById(R.id.recycler);
        swipe = findViewById(R.id.swipe);
        tvSub = findViewById(R.id.tvSub);
        tvEmpty = findViewById(R.id.tvEmpty);
        findViewById(R.id.btnBack).setOnClickListener(v -> finish());

        recycler.setLayoutManager(new LinearLayoutManager(this));
        recycler.setAdapter(new Adapter());
        swipe.setColorSchemeColors(0xFF6D8CFF, 0xFF35C6FF);
        swipe.setOnRefreshListener(this::load);
        load();
    }

    private void load() {
        Ui.runIo(() -> {
            List<Models.User> list = new ArrayList<>();
            try {
                list = Api.api().blocks();
            } catch (Exception e) {
                Ui.runMain(() -> Ui.toast(this, e.getMessage() == null ? "加载失败" : e.getMessage()));
            }
            final List<Models.User> got = list;
            Ui.runMain(() -> {
                if (isFinishing()) return;
                data.clear();
                data.addAll(got);
                recycler.getAdapter().notifyDataSetChanged();
                swipe.setRefreshing(false);
                boolean empty = got.isEmpty();
                tvSub.setText(got.size() + " 位用户");
                tvEmpty.setVisibility(empty ? View.VISIBLE : View.GONE);
                recycler.setVisibility(empty ? View.GONE : View.VISIBLE);
            });
        });
    }

    private void unblock(final Models.User u) {
        Ui.confirm(this, "解除拉黑", "解除拉黑「" + u.displayName() + "」？", () ->
                Ui.runIo(() -> {
                    try {
                        Api.api().unblockUser(u.id);
                        Ui.runMain(() -> {
                            Ui.toast(this, "已解除拉黑");
                            load();
                        });
                    } catch (Exception e) {
                        Ui.toast(this, e.getMessage() == null ? "操作失败" : e.getMessage());
                    }
                }));
    }

    class Adapter extends RecyclerView.Adapter<Adapter.VH> {

        @NonNull
        @Override
        public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            return new VH(LayoutInflater.from(parent.getContext())
                    .inflate(R.layout.item_blacklist, parent, false));
        }

        @Override
        public void onBindViewHolder(@NonNull VH h, int position) {
            Models.User u = data.get(position);
            h.avatar.bind(u.displayName(), u.avatar, null);
            h.name.setText(u.displayName());
            String sub = "ID " + u.id;
            if (!u.username.isEmpty() && !u.username.equals(u.displayName())) sub += " · @" + u.username;
            h.sub.setText(sub);
            h.unblock.setOnClickListener(v -> unblock(u));
            h.itemView.setOnClickListener(v -> FriendInfoActivity.start(BlacklistActivity.this, u.id));
        }

        @Override
        public int getItemCount() {
            return data.size();
        }

        class VH extends RecyclerView.ViewHolder {
            AvatarView avatar;
            TextView name, sub, unblock;

            VH(@NonNull View v) {
                super(v);
                avatar = v.findViewById(R.id.avatar);
                name = v.findViewById(R.id.tvName);
                sub = v.findViewById(R.id.tvSub);
                unblock = v.findViewById(R.id.btnUnblock);
            }
        }
    }
}
