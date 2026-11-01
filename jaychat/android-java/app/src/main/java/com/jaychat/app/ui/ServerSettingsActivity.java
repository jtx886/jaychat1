package com.jaychat.app.ui;

import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.widget.EditText;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;

import com.jaychat.app.Api;
import com.jaychat.app.AuthActivity;
import com.jaychat.app.R;
import com.jaychat.app.Store;
import com.jaychat.app.Ui;

/** 服务器地址设置（切换服务器后需要重新登录） */
public class ServerSettingsActivity extends AppCompatActivity {

    private EditText etBase;
    private TextView tvAccount;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_server_settings);

        etBase = findViewById(R.id.etBase);
        tvAccount = findViewById(R.id.tvAccount);
        findViewById(R.id.btnBack).setOnClickListener(v -> finish());
        findViewById(R.id.btnSave).setOnClickListener(v -> save());
        findViewById(R.id.btnReset).setOnClickListener(v -> {
            etBase.setText(Store.DEFAULT_BASE);
            save();
        });

        etBase.setText(Store.base());
        String account = "";
        try {
            org.json.JSONObject o = new org.json.JSONObject(Store.userJson());
            account = "当前账号：" + o.optString("username", "") + "（ID " + o.optInt("id", 0) + "）";
        } catch (Exception ignored) {
        }
        tvAccount.setText(account);
    }

    private void save() {
        String base = etBase.getText().toString().trim();
        if (TextUtils.isEmpty(base)) {
            Ui.toast(this, "请输入服务器地址");
            return;
        }
        if (!base.startsWith("http://") && !base.startsWith("https://")) {
            Ui.toast(this, "地址需以 http:// 或 https:// 开头");
            return;
        }
        final String old = Store.base();
        final boolean changed = !base.equals(old);
        Ui.hideKeyboard(this);
        Ui.runIo(() -> {
            Store.setBase(base);
            if (changed) {
                Store.setCookies("");
                Store.clearLogin();
            }
            try {
                Api.api().health();
                Ui.runMain(() -> {
                    Ui.toast(this, "连接成功");
                    if (changed) {
                        Intent i = new Intent(this, AuthActivity.class);
                        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
                        startActivity(i);
                        finish();
                    }
                });
            } catch (Exception e) {
                Ui.runMain(() -> Ui.toast(this, "无法连接：" + (e.getMessage() == null ? "请检查地址" : e.getMessage())));
            }
        });
    }
}
