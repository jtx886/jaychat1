package com.jaychat.app.ui;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.Gravity;
import android.view.View;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import com.jaychat.app.Api;
import com.jaychat.app.AvatarView;
import com.jaychat.app.MediaUtil;
import com.jaychat.app.Models;
import com.jaychat.app.R;
import com.jaychat.app.Store;
import com.jaychat.app.Ui;

import org.json.JSONObject;

/** 编辑资料：昵称 / 个性签名 / 预设头像 / 上传头像 */
public class EditProfileActivity extends AppCompatActivity {

    private static final int REQ_IMAGE = 2001;

    private AvatarView avatar;
    private EditText etName, etBio;
    private TextView tvEmail;
    private String avatarValue = "";

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_edit_profile);

        avatar = findViewById(R.id.avatar);
        etName = findViewById(R.id.etName);
        etBio = findViewById(R.id.etBio);
        tvEmail = findViewById(R.id.tvEmail);

        findViewById(R.id.btnBack).setOnClickListener(v -> finish());
        findViewById(R.id.avatar).setOnClickListener(v -> pickImage());
        findViewById(R.id.btnSave).setOnClickListener(v -> save());

        buildPresetRow();
        render(loadLocalUser());
    }

    private Models.User loadLocalUser() {
        try {
            return Models.parseUser(new JSONObject(Store.userJson()));
        } catch (Exception e) {
            return null;
        }
    }

    private void render(Models.User u) {
        if (u == null) return;
        avatarValue = u.avatar == null ? "" : u.avatar;
        avatar.bind(u.displayName(), avatarValue, null);
        etName.setText(u.username);
        etBio.setText(u.bio);
        tvEmail.setText(TextUtils.isEmpty(u.email) ? "" : u.email);
    }

    private void buildPresetRow() {
        LinearLayout row = findViewById(R.id.presetRow);
        row.removeAllViews();
        for (int i = 0; i < 12; i++) {
            TextView tv = new TextView(this);
            final int idx = i;
            int size = Ui.dp(this, 46);
            LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(size, size);
            lp.rightMargin = Ui.dp(this, 10);
            tv.setLayoutParams(lp);
            tv.setGravity(Gravity.CENTER);
            AvatarView.applyPreset(tv, i);
            tv.setOnClickListener(v -> saveAvatar("preset:" + idx));
            row.addView(tv);
        }
    }

    private void saveAvatar(String value) {
        Ui.runIo(() -> {
            try {
                JSONObject body = new JSONObject();
                body.put("avatar", value);
                Models.User u = Api.api().updateProfile(body);
                Ui.runMain(() -> {
                    avatarValue = u.avatar;
                    avatar.bind(u.displayName(), avatarValue, null);
                    Ui.toast(this, "头像已更新");
                });
            } catch (Exception e) {
                Ui.runMain(() -> Ui.toast(this, e.getMessage() == null ? "保存失败" : e.getMessage()));
            }
        });
    }

    private void save() {
        String name = etName.getText().toString().trim();
        String bio = etBio.getText().toString().trim();
        if (name.length() < 1 || name.length() > 6) {
            Ui.toast(this, "昵称只能为 1-6 个字符");
            return;
        }
        Ui.hideKeyboard(this);
        Ui.runIo(() -> {
            try {
                JSONObject body = new JSONObject();
                body.put("username", name);
                body.put("bio", bio);
                Models.User u = Api.api().updateProfile(body);
                Ui.runMain(() -> {
                    etName.setText(u.username);
                    etBio.setText(u.bio);
                    avatar.bind(u.displayName(), u.avatar, null);
                    Ui.toast(this, "保存成功");
                });
            } catch (Exception e) {
                Ui.runMain(() -> Ui.toast(this, e.getMessage() == null ? "保存失败" : e.getMessage()));
            }
        });
    }

    private void pickImage() {
        Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("image/*");
        startActivityForResult(i, REQ_IMAGE);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, @Nullable Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_IMAGE || resultCode != RESULT_OK || data == null) return;
        Uri uri = data.getData();
        if (uri == null) return;
        Ui.runIo(() -> {
            try {
                byte[] bytes = MediaUtil.compressImage(this, uri);
                if (bytes == null) throw new IllegalStateException("无法读取图片");
                String name = MediaUtil.queryDisplayName(this, uri, "avatar.jpg");
                String url = Api.api().uploadBytes(bytes, name, "image/jpeg").optString("url", "");
                if (TextUtils.isEmpty(url)) throw new IllegalStateException("上传失败");
                JSONObject body = new JSONObject();
                body.put("avatar", url);
                Models.User u = Api.api().updateProfile(body);
                Ui.runMain(() -> {
                    avatarValue = u.avatar;
                    avatar.bind(u.displayName(), avatarValue, null);
                    Ui.toast(this, "头像已更新");
                });
            } catch (Exception e) {
                Ui.runMain(() -> Ui.toast(this, e.getMessage() == null ? "上传失败" : e.getMessage()));
            }
        });
    }
}
