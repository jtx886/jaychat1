package com.jaychat.app.ui;

import android.content.Context;
import android.content.Intent;
import android.os.Bundle;
import android.text.Editable;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
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

import java.util.ArrayList;
import java.util.List;

public class ContactsFragment extends Fragment {

    private RecyclerView recycler;
    private SwipeRefreshLayout swipe;
    private TextView tvSub;
    private EditText etSearch;
    private ContactAdapter adapter;

    private final List<Models.Group> groups = new ArrayList<>();
    private final List<Models.User> friends = new ArrayList<>();

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_contacts, container, false);
        recycler = root.findViewById(R.id.recycler);
        swipe = root.findViewById(R.id.swipe);
        tvSub = root.findViewById(R.id.tvSub);
        etSearch = root.findViewById(R.id.etSearch);

        adapter = new ContactAdapter(item -> {
            if (getActivity() == null) return;
            if (item.type == ContactAdapter.TYPE_GROUP) {
                ChatActivity.startGroup(getActivity(), item.group);
            } else {
                ChatActivity.startDm(getActivity(), item.user);
            }
        }, item -> {
            if (getActivity() == null) return;
            if (item.type == ContactAdapter.TYPE_GROUP) {
                GroupInfoActivity.start(getActivity(), item.group.id);
            } else {
                FriendInfoActivity.start(getActivity(), item.user.id);
            }
        });
        recycler.setLayoutManager(new LinearLayoutManager(getContext()));
        recycler.setAdapter(adapter);

        swipe.setColorSchemeColors(0xFF6D8CFF, 0xFF35C6FF);
        swipe.setOnRefreshListener(this::load);
        root.findViewById(R.id.btnAdd).setOnClickListener(v -> {
            if (getActivity() != null) {
                startActivity(new Intent(getActivity(), AddFriendActivity.class));
            }
        });
        etSearch.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {
            }

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
            }

            @Override
            public void afterTextChanged(Editable s) {
                render();
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

    private void load() {
        Ui.runIo(() -> {
            List<Models.Group> g = new ArrayList<>();
            List<Models.User> f = new ArrayList<>();
            try {
                g = Api.api().groups();
            } catch (Exception ignored) {
            }
            try {
                f = Api.api().friends();
            } catch (Exception ignored) {
            }
            final List<Models.Group> gg = g;
            final List<Models.User> ff = f;
            Ui.runMain(() -> {
                if (!isAdded()) return;
                groups.clear();
                groups.addAll(gg);
                friends.clear();
                friends.addAll(ff);
                swipe.setRefreshing(false);
                tvSub.setText(groups.size() + " 个群聊 · " + friends.size() + " 位好友");
                render();
            });
        });
    }

    private void render() {
        String kw = etSearch == null ? "" : etSearch.getText().toString().trim();
        List<ContactAdapter.Item> items = new ArrayList<>();
        List<Models.Group> gs = new ArrayList<>();
        List<Models.User> fs = new ArrayList<>();
        for (Models.Group g : groups) {
            if (kw.isEmpty() || g.name.toLowerCase().contains(kw.toLowerCase())
                    || String.valueOf(g.id).equals(kw)) gs.add(g);
        }
        for (Models.User u : friends) {
            if (kw.isEmpty() || u.displayName().toLowerCase().contains(kw.toLowerCase())
                    || String.valueOf(u.id).equals(kw)) fs.add(u);
        }
        if (!gs.isEmpty()) {
            ContactAdapter.Item sec = new ContactAdapter.Item();
            sec.type = ContactAdapter.TYPE_SECTION;
            sec.section = "群聊";
            items.add(sec);
            for (Models.Group g : gs) {
                ContactAdapter.Item it = new ContactAdapter.Item();
                it.type = ContactAdapter.TYPE_GROUP;
                it.group = g;
                items.add(it);
            }
        }
        if (!fs.isEmpty()) {
            ContactAdapter.Item sec = new ContactAdapter.Item();
            sec.type = ContactAdapter.TYPE_SECTION;
            sec.section = "好友";
            items.add(sec);
            for (Models.User u : fs) {
                ContactAdapter.Item it = new ContactAdapter.Item();
                it.type = ContactAdapter.TYPE_USER;
                it.user = u;
                items.add(it);
            }
        }
        adapter.setData(items);
    }

    /** ChatActivity 打开私聊所需的 conversation key */
    public static String dmKey(int myId, int peerId) {
        return "dm_" + Math.min(myId, peerId) + "_" + Math.max(myId, peerId);
    }
}
