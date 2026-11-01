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
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.LinearLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.jaychat.app.Api;
import com.jaychat.app.AvatarView;
import com.jaychat.app.Models;
import com.jaychat.app.R;
import com.jaychat.app.Store;
import com.jaychat.app.Ui;

import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** 添加好友：搜索用户 + 处理好友申请 */
public class AddFriendActivity extends AppCompatActivity {

    private EditText etSearch;
    private RecyclerView recycler;
    private TextView tvEmpty, tvRequestsLabel;
    private LinearLayout requestsBox;
    private UserAdapter adapter;
    private boolean searched;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_add_friend);

        etSearch = findViewById(R.id.etSearch);
        recycler = findViewById(R.id.recycler);
        tvEmpty = findViewById(R.id.tvEmpty);
        tvRequestsLabel = findViewById(R.id.tvRequestsLabel);
        requestsBox = findViewById(R.id.requestsBox);

        findViewById(R.id.btnBack).setOnClickListener(v -> finish());

        adapter = new UserAdapter(this::sendRequest);
        recycler.setLayoutManager(new LinearLayoutManager(this));
        recycler.setAdapter(adapter);

        findViewById(R.id.btnSearch).setOnClickListener(v -> search());
        etSearch.setOnEditorActionListener((v, actionId, event) -> {
            search();
            return true;
        });
        loadRequests();
    }

    private void loadRequests() {
        Ui.runIo(() -> {
            List<Models.FriendRequest> list = new ArrayList<>();
            try {
                list = Api.api().friendRequests();
            } catch (Exception ignored) {
            }
            final List<Models.FriendRequest> reqs = list;
            Ui.runMain(() -> renderRequests(reqs));
        });
    }

    private void renderRequests(List<Models.FriendRequest> list) {
        requestsBox.removeAllViews();
        boolean any = !list.isEmpty();
        tvRequestsLabel.setVisibility(any ? View.VISIBLE : View.GONE);
        requestsBox.setVisibility(any ? View.VISIBLE : View.GONE);
        LayoutInflater inflater = LayoutInflater.from(this);
        for (Models.FriendRequest r : list) {
            View row = inflater.inflate(R.layout.item_friend_request, requestsBox, false);
            AvatarView av = row.findViewById(R.id.avatar);
            TextView name = row.findViewById(R.id.tvName);
            TextView msg = row.findViewById(R.id.tvMessage);
            av.bind(r.from == null ? "" : r.from.displayName(),
                    r.from == null ? "" : r.from.avatar, null);
            name.setText(r.from == null ? "未知用户" : r.from.displayName());
            msg.setText(TextUtils.isEmpty(r.message) ? "请求添加你为好友" : r.message);
            row.findViewById(R.id.btnAccept).setOnClickListener(v -> answer(r, true));
            row.findViewById(R.id.btnReject).setOnClickListener(v -> answer(r, false));
            requestsBox.addView(row);
        }
    }

    private void answer(Models.FriendRequest r, boolean accept) {
        Ui.runIo(() -> {
            try {
                Api.api().answerFriendRequest(r.id, accept);
                Ui.runMain(() -> {
                    Ui.toast(this, accept ? "已添加好友" : "已拒绝");
                    loadRequests();
                });
            } catch (Exception e) {
                Ui.runMain(() -> Ui.toast(this, e.getMessage() == null ? "操作失败" : e.getMessage()));
            }
        });
    }

    private void search() {
        String kw = etSearch.getText().toString().trim();
        if (TextUtils.isEmpty(kw)) {
            Ui.toast(this, "请输入昵称或 ID");
            return;
        }
        Ui.hideKeyboard(this);
        Ui.runIo(() -> {
            try {
                List<Models.FriendResult> list = Api.api().searchUsers(kw);
                Ui.runMain(() -> {
                    searched = true;
                    adapter.setData(list);
                    boolean empty = list.isEmpty();
                    tvEmpty.setVisibility(empty ? View.VISIBLE : View.GONE);
                    recycler.setVisibility(empty ? View.GONE : View.VISIBLE);
                    if (empty) tvEmpty.setText("没有找到相关用户");
                });
            } catch (Exception e) {
                Ui.runMain(() -> Ui.toast(this, e.getMessage() == null ? "搜索失败" : e.getMessage()));
            }
        });
    }

    private void sendRequest(Models.FriendResult r) {
        if (r.user == null) return;
        String me = "Jay Chat 用户";
        try {
            JSONObject o = new JSONObject(Store.userJson());
            me = o.optString("username", me);
        } catch (Exception ignored) {
        }
        final String greeting = "我是 " + me;
        Ui.runIo(() -> {
            try {
                Api.api().requestFriend(r.user.id, greeting);
                Ui.runMain(() -> {
                    Ui.toast(this, "好友申请已发送");
                    searched = true;
                    r.pendingDirection = "out";
                    adapter.notifyDataSetChanged();
                });
            } catch (Exception e) {
                Ui.runMain(() -> Ui.toast(this, e.getMessage() == null ? "发送失败" : e.getMessage()));
            }
        });
    }

    static class UserAdapter extends RecyclerView.Adapter<UserAdapter.VH> {
        interface OnAdd {
            void onAdd(Models.FriendResult r);
        }

        private final List<Models.FriendResult> data = new ArrayList<>();
        private final OnAdd onAdd;

        UserAdapter(OnAdd onAdd) {
            this.onAdd = onAdd;
        }

        void setData(List<Models.FriendResult> list) {
            data.clear();
            data.addAll(list);
            notifyDataSetChanged();
        }

        @NonNull
        @Override
        public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            return new VH(LayoutInflater.from(parent.getContext())
                    .inflate(R.layout.item_search_user, parent, false));
        }

        @Override
        public void onBindViewHolder(@NonNull VH h, int position) {
            Models.FriendResult r = data.get(position);
            Models.User u = r.user;
            h.avatar.bind(u.displayName(), u.avatar, u.online);
            h.name.setText(u.displayName());
            String sub = "ID " + u.id;
            if (!TextUtils.isEmpty(u.email)) sub += " · " + u.email;
            h.sub.setText(sub);

            if (r.isFriend) {
                h.action.setText("已是好友");
                h.action.setTextColor(0xFF6E7793);
                h.action.setEnabled(false);
            } else if (r.pendingDirection != null) {
                h.action.setText("已申请");
                h.action.setTextColor(0xFF6E7793);
                h.action.setEnabled(false);
            } else {
                h.action.setText("添加");
                h.action.setTextColor(0xFF9DB6FF);
                h.action.setEnabled(true);
                h.action.setOnClickListener(v -> onAdd.onAdd(r));
            }
        }

        @Override
        public int getItemCount() {
            return data.size();
        }

        static class VH extends RecyclerView.ViewHolder {
            AvatarView avatar;
            TextView name, sub, action;

            VH(@NonNull View v) {
                super(v);
                avatar = v.findViewById(R.id.avatar);
                name = v.findViewById(R.id.tvName);
                sub = v.findViewById(R.id.tvSub);
                action = v.findViewById(R.id.btnAction);
            }
        }
    }
}
