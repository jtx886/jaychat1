package com.jaychat.app;

import android.content.Intent;
import android.os.Bundle;
import android.text.TextUtils;
import android.view.View;
import android.widget.EditText;
import android.widget.TextView;

import androidx.appcompat.app.AppCompatActivity;

import com.jaychat.app.ui.MainActivity;

public class AuthActivity extends AppCompatActivity {

    private boolean registerMode = false;
    private boolean busy = false;

    private EditText etAccount, etPassword, etEmail, etCode, etUsername;
    private TextView tvMode, btnSubmit, btnSwitch, btnCode, tvServer;
    private View registerBox;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_auth);

        etAccount = findViewById(R.id.etAccount);
        etPassword = findViewById(R.id.etPassword);
        etEmail = findViewById(R.id.etEmail);
        etCode = findViewById(R.id.etCode);
        etUsername = findViewById(R.id.etUsername);
        tvMode = findViewById(R.id.tvMode);
        btnSubmit = findViewById(R.id.btnSubmit);
        btnSwitch = findViewById(R.id.btnSwitch);
        btnCode = findViewById(R.id.btnCode);
        tvServer = findViewById(R.id.tvServer);
        registerBox = findViewById(R.id.registerBox);

        renderServer();
        btnSwitch.setOnClickListener(v -> {
            registerMode = !registerMode;
            renderMode();
        });
        btnSubmit.setOnClickListener(v -> submit());
        btnCode.setOnClickListener(v -> sendCode());
        tvServer.setOnClickListener(v -> Ui.prompt(this, "服务器地址", "https://jaychat.ct.ws",
                Store.base(), text -> {
                    if (text.isEmpty()) return;
                    if (!text.startsWith("http://") && !text.startsWith("https://")) {
                        Ui.toast(this, "地址需以 http:// 或 https:// 开头");
                        return;
                    }
                    Store.setBase(text);
                    Store.setCookies("");
                    renderServer();
                    Ui.toast(this, "已保存");
                }));

        if (!Store.token().isEmpty()) {
            tvMode.setText("正在恢复登录…");
            btnSubmit.setVisibility(View.GONE);
            Ui.runIo(() -> {
                try {
                    Models.User u = Api.api().me();
                    Ui.runMain(() -> {
                        if (!isFinishing()) {
                            Ui.toast(this, "登录成功");
                            goMain();
                        }
                    });
                } catch (Exception e) {
                    if (e instanceof Api.ApiException && ((Api.ApiException) e).status == 401) {
                        Store.clearLogin();
                    }
                    Ui.runMain(() -> {
                        if (!isFinishing()) {
                            btnSubmit.setVisibility(View.VISIBLE);
                            renderMode();
                        }
                    });
                }
            });
        } else {
            renderMode();
        }
    }

    private void renderServer() {
        tvServer.setText(Store.base());
    }

    private void renderMode() {
        tvMode.setText(registerMode ? "注册新账号" : "登录账号");
        btnSubmit.setText(registerMode ? "注册并登录" : "登录");
        btnSwitch.setText(registerMode ? "已有账号？去登录" : "没有账号？去注册");
        registerBox.setVisibility(registerMode ? View.VISIBLE : View.GONE);
        etAccount.setVisibility(registerMode ? View.GONE : View.VISIBLE);
        etAccount.setHint("用户名或邮箱");
    }

    private void setBusy(boolean b) {
        busy = b;
        btnSubmit.setEnabled(!b);
        btnSubmit.setText(b ? (registerMode ? "注册中…" : "登录中…") : (registerMode ? "注册并登录" : "登录"));
    }

    private void submit() {
        if (busy) return;
        if (registerMode) doRegister();
        else doLogin();
    }

    private void doLogin() {
        String account = etAccount.getText().toString().trim();
        String password = etPassword.getText().toString();
        if (TextUtils.isEmpty(account)) {
            Ui.toast(this, "请输入用户名或邮箱");
            return;
        }
        if (TextUtils.isEmpty(password)) {
            Ui.toast(this, "请输入密码");
            return;
        }
        setBusy(true);
        Ui.runIo(() -> {
            try {
                Api.api().login(account, password);
                Ui.runMain(() -> {
                    if (isFinishing()) return;
                    setBusy(false);
                    Ui.toast(this, "登录成功");
                    goMain();
                });
            } catch (Exception e) {
                Ui.runMain(() -> {
                    if (isFinishing()) return;
                    setBusy(false);
                    Ui.error(this, "登录失败", errorText(e));
                });
            }
        });
    }

    private void doRegister() {
        String email = etEmail.getText().toString().trim();
        String code = etCode.getText().toString().trim();
        String username = etUsername.getText().toString().trim();
        String password = etPassword.getText().toString();
        if (TextUtils.isEmpty(email)) {
            Ui.toast(this, "请输入邮箱");
            return;
        }
        if (TextUtils.isEmpty(code)) {
            Ui.toast(this, "请输入验证码");
            return;
        }
        if (TextUtils.isEmpty(username)) {
            Ui.toast(this, "请输入用户名");
            return;
        }
        if (password.length() < 6) {
            Ui.toast(this, "密码至少 6 位");
            return;
        }
        setBusy(true);
        Ui.runIo(() -> {
            try {
                Api.api().register(email, code, username, password);
                Ui.runMain(() -> {
                    if (isFinishing()) return;
                    setBusy(false);
                    Ui.toast(this, "登录成功");
                    goMain();
                });
            } catch (Exception e) {
                Ui.runMain(() -> {
                    if (isFinishing()) return;
                    setBusy(false);
                    Ui.error(this, "注册失败", errorText(e));
                });
            }
        });
    }

    private static String errorText(Exception e) {
        String m = e.getMessage();
        if (m == null || m.trim().isEmpty()) return e.getClass().getSimpleName();
        if (!(e instanceof Api.ApiException)) m = m + "（" + e.getClass().getSimpleName() + "）";
        return m;
    }

    private void sendCode() {
        String email = etEmail.getText().toString().trim();
        if (TextUtils.isEmpty(email)) {
            Ui.toast(this, "请先输入邮箱");
            return;
        }
        btnCode.setEnabled(false);
        Ui.runIo(() -> {
            try {
                String hint = Api.api().sendCode(email);
                Ui.runMain(() -> {
                    if (isFinishing()) return;
                    btnCode.setEnabled(true);
                    Ui.toast(this, hint);
                });
            } catch (Exception e) {
                Ui.runMain(() -> {
                    if (isFinishing()) return;
                    btnCode.setEnabled(true);
                    Ui.toast(this, e.getMessage() == null ? "发送失败" : e.getMessage());
                });
            }
        });
    }

    private void goMain() {
        startActivity(new Intent(this, MainActivity.class));
        finish();
    }
}
