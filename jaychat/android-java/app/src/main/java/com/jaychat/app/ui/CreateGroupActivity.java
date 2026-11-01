package com.jaychat.app.ui;

import android.content.Context;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.jaychat.app.Api;
import com.jaychat.app.Models;
import com.jaychat.app.R;
import com.jaychat.app.Ui;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** 创建群聊：输入群名并从好友中勾选成员 */
public class CreateGroupActivity extends AppCompatActivity {

    private final List<Models.User> friends = new ArrayList<>();
    private final Set<Integer> picked = new LinkedHashSet<>();

    private EditText etName;
    private TextView tvSub, btnCreate, tvEmpty;
    private RecyclerView recycler;
    private PickAdapter adapter;
    private boolean busy;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_create_group);

        etName = findViewById(R.id.etName);
        tvSub = findViewById(R.id.tvSub);
        btnCreate = findViewById(R.id.btnCreate);
        tvEmpty = findViewById(R.id.tvEmpty);
        recycler = findViewById(R.id.recycler);

        adapter = new PickAdapter();
        recycler.setLayoutManager(new LinearLayoutManager(this));
        recycler.setAdapter(adapter);

        findViewById(R.id.btnBack).setOnClickListener(v -> finish());
        btnCreate.setOnClickListener(v -> create());

        Ui.runIo(() -> {
            List<Models.User> list = new ArrayList<>();
            try {
                list = Api.api().friends();
            } catch (Exception ignored) {
            }
            final List<Models.User> got = list;
            Ui.runMain(() -> {
                friends.clear();
                friends.addAll(got);
                adapter.notifyDataSetChanged();
                tvSub.setText(got.isEmpty() ? "选填邀请好友" : "共 " + got.size() + " 位好友");
                tvEmpty.setVisibility(got.isEmpty() ? View.VISIBLE : View.GONE);
                recycler.setVisibility(got.isEmpty() ? View.GONE : View.VISIBLE);
            });
        });
    }

    private void renderPicked() {
        tvSub.setText(picked.isEmpty() ? "选填邀请好友" : "已选 " + picked.size() + " 人");
    }

    private void create() {
        if (busy) return;
        String name = etName.getText().toString().trim();
        if (name.isEmpty()) {
            Ui.toast(this, "请输入群名称");
            return;
        }
        busy = true;
        btnCreate.setEnabled(false);
        btnCreate.setText("创建中…");
        final List<Integer> ids = new ArrayList<>(picked);
        Ui.runIo(() -> {
            try {
                Models.Group g = Api.api().createGroup(name, ids);
                Ui.runMain(() -> {
                    busy = false;
                    btnCreate.setEnabled(true);
                    btnCreate.setText("创建群聊");
                    Ui.toast(this, "群聊创建成功");
                    ChatActivity.startGroup(this, g);
                    finish();
                });
            } catch (Exception e) {
                Ui.runMain(() -> {
                    busy = false;
                    btnCreate.setEnabled(true);
                    btnCreate.setText("创建群聊");
                    Ui.toast(this, e.getMessage() == null ? "创建失败" : e.getMessage());
                });
            }
        });
    }

    class PickAdapter extends RecyclerView.Adapter<PickAdapter.VH> {
        @NonNull
        @Override
        public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            return new VH(LayoutInflater.from(parent.getContext())
                    .inflate(R.layout.item_select_user, parent, false));
        }

        @Override
        public void onBindViewHolder(@NonNull VH h, int position) {
            Models.User u = friends.get(position);
            h.avatar.bind(u.displayName(), u.avatar, u.online);
            h.name.setText(u.displayName());
            h.sub.setText(u.remark == null || u.remark.trim().isEmpty() ? "ID：" + u.id : "昵称：" + u.username);
            boolean on = picked.contains(u.id);
            h.switchPick.setChecked(on);
            h.switchPick.setOnCheckedChangeListener((b, checked) -> {
                if (checked) picked.add(u.id);
                else picked.remove(u.id);
                renderPicked();
            });
            h.itemView.setOnClickListener(v -> {
                if (picked.contains(u.id)) picked.remove(u.id);
                else picked.add(u.id);
                notifyItemChanged(h.getAdapterPosition());
                renderPicked();
            });
        }

        @Override
        public int getItemCount() {
            return friends.size();
        }

        class VH extends RecyclerView.ViewHolder {
            com.jaychat.app.AvatarView avatar;
            TextView name, sub;
            androidx.appcompat.widget.SwitchCompat switchPick;

            VH(@NonNull View v) {
                super(v);
                avatar = v.findViewById(R.id.avatar);
                name = v.findViewById(R.id.tvName);
                sub = v.findViewById(R.id.tvSub);
                switchPick = v.findViewById(R.id.switchPick);
            }
        }
    }
}
