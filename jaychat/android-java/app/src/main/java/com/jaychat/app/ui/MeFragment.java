package com.jaychat.app.ui;

import android.content.Intent;
import android.os.Bundle;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.fragment.app.Fragment;

import com.jaychat.app.Api;
import com.jaychat.app.AuthActivity;
import com.jaychat.app.AvatarView;
import com.jaychat.app.Models;
import com.jaychat.app.R;
import com.jaychat.app.Store;
import com.jaychat.app.Ui;

public class MeFragment extends Fragment {

    private AvatarView avatar;
    private TextView tvName, tvId, tvBio, tvVersion;
    private View rowAdmin;

    @Nullable
    @Override
    public View onCreateView(@NonNull LayoutInflater inflater, @Nullable ViewGroup container,
                             @Nullable Bundle savedInstanceState) {
        View root = inflater.inflate(R.layout.fragment_me, container, false);
        avatar = root.findViewById(R.id.avatar);
        tvName = root.findViewById(R.id.tvName);
        tvId = root.findViewById(R.id.tvId);
        tvBio = root.findViewById(R.id.tvBio);
        tvVersion = root.findViewById(R.id.tvVersion);
        rowAdmin = root.findViewById(R.id.rowAdmin);

        rowAdmin.setOnClickListener(v -> {
            if (getActivity() != null) startActivity(new Intent(getActivity(), AdminActivity.class));
        });
        root.findViewById(R.id.rowProfile).setOnClickListener(v -> {
            if (getActivity() != null) startActivity(new Intent(getActivity(), EditProfileActivity.class));
        });
        root.findViewById(R.id.rowStickers).setOnClickListener(v -> {
            if (getActivity() != null) startActivity(new Intent(getActivity(), StickersActivity.class));
        });
        root.findViewById(R.id.rowMyMoments).setOnClickListener(v -> {
            if (getActivity() != null) UserMomentsActivity.start(getActivity(), 0, "");
        });
        root.findViewById(R.id.rowBlacklist).setOnClickListener(v -> {
            if (getActivity() != null) startActivity(new Intent(getActivity(), BlacklistActivity.class));
        });
        root.findViewById(R.id.rowNotifications).setOnClickListener(v -> {
            if (getActivity() != null) startActivity(new Intent(getActivity(), NotificationsActivity.class));
        });
        root.findViewById(R.id.rowServer).setOnClickListener(v -> {
            if (getActivity() != null) startActivity(new Intent(getActivity(), ServerSettingsActivity.class));
        });
        root.findViewById(R.id.btnLogout).setOnClickListener(v ->
                Ui.confirm(getContext(), "退出登录", "确定退出当前账号？", this::logout));

        tvVersion.setText("Jay Chat 原生版 3.0.2（Java）");
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
            Models.User u = null;
            try {
                u = Api.api().me();
            } catch (Exception ignored) {
                String raw = Store.userJson();
                if (!raw.isEmpty()) {
                    try {
                        u = Models.parseUser(new org.json.JSONObject(raw));
                    } catch (Exception ignored2) {
                    }
                }
            }
            final Models.User user = u;
            Ui.runMain(() -> {
                if (!isAdded() || user == null) return;
                avatar.bind(user.displayName(), user.avatar, null);
                tvName.setText(user.displayName());
                String id = "ID " + user.id;
                if (!user.email.isEmpty()) id += " · " + user.email;
                tvId.setText(id);
                tvBio.setText(user.bio.isEmpty() ? "这个人很神秘，什么都没写" : user.bio);
                rowAdmin.setVisibility(user.canAdmin() ? View.VISIBLE : View.GONE);
            });
        });
    }

    private void logout() {
        Ui.runIo(() -> {
            Api.api().logout();
            Store.clearLogin();
            Ui.runMain(() -> {
                if (getActivity() == null) return;
                Intent i = new Intent(getActivity(), AuthActivity.class);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                startActivity(i);
                getActivity().finish();
            });
        });
    }
}
