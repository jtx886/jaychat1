package com.jaychat.app;

import android.app.Activity;
import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.text.InputType;
import android.widget.EditText;
import android.widget.Toast;

import androidx.appcompat.app.AlertDialog;

import java.util.Calendar;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** 通用 UI 小工具（纯 Java） */
public final class Ui {

    public static final Handler MAIN = new Handler(Looper.getMainLooper());
    public static final ExecutorService IO = Executors.newFixedThreadPool(4);

    private Ui() {
    }

    public static int dp(Context ctx, float v) {
        return (int) (v * ctx.getResources().getDisplayMetrics().density + 0.5f);
    }

    public static void toast(Context ctx, String msg) {
        if (ctx == null || msg == null) return;
        MAIN.post(() -> Toast.makeText(ctx.getApplicationContext(), msg, Toast.LENGTH_SHORT).show());
    }

    public static void runMain(Runnable r) {
        MAIN.post(r);
    }

    public static void runIo(Runnable r) {
        IO.execute(r);
    }

    public static String pad2(int v) {
        return v < 10 ? "0" + v : String.valueOf(v);
    }

    /** 会话列表时间：今天 HH:mm，昨天，今年 MM-dd，跨年 yyyy-MM-dd */
    public static String timeText(long ts) {
        if (ts <= 0) return "";
        Calendar now = Calendar.getInstance();
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(ts * 1000);
        int nowY = now.get(Calendar.YEAR), nowD = now.get(Calendar.DAY_OF_YEAR);
        int y = c.get(Calendar.YEAR), d = c.get(Calendar.DAY_OF_YEAR);
        if (nowY == y && nowD == d) return pad2(c.get(Calendar.HOUR_OF_DAY)) + ":" + pad2(c.get(Calendar.MINUTE));
        if (nowY == y && nowD - d == 1) return "昨天";
        if (nowY == y) return pad2(c.get(Calendar.MONTH) + 1) + "-" + pad2(c.get(Calendar.DAY_OF_MONTH));
        return y + "-" + pad2(c.get(Calendar.MONTH) + 1) + "-" + pad2(c.get(Calendar.DAY_OF_MONTH));
    }

    /** 动态相对时间 */
    public static String relative(long ts) {
        if (ts <= 0) return "";
        long diff = System.currentTimeMillis() / 1000 - ts;
        if (diff < 60) return "刚刚";
        if (diff < 3600) return (diff / 60) + " 分钟前";
        if (diff < 86400) return (diff / 3600) + " 小时前";
        Calendar now = Calendar.getInstance();
        Calendar c = Calendar.getInstance();
        c.setTimeInMillis(ts * 1000);
        if (now.get(Calendar.DAY_OF_YEAR) - c.get(Calendar.DAY_OF_YEAR) == 1) return "昨天";
        return pad2(c.get(Calendar.MONTH) + 1) + "-" + pad2(c.get(Calendar.DAY_OF_MONTH)) + " "
                + pad2(c.get(Calendar.HOUR_OF_DAY)) + ":" + pad2(c.get(Calendar.MINUTE));
    }

    public static String lastPreview(String type, String text) {
        if (text == null) text = "";
        switch (type == null ? "" : type) {
            case "image": return "[图片]";
            case "video": return "[视频]";
            case "sticker": return "[表情]";
            case "voice": return "[语音]";
            default: return text;
        }
    }

    public static void alert(Context ctx, String title, String msg) {
        new AlertDialog.Builder(ctx)
                .setTitle(title)
                .setMessage(msg)
                .setPositiveButton("知道了", null)
                .show();
    }

    /** 失败详情弹窗（可复制），避免一闪而过的提示看不清原因 */
    public static void error(Activity a, String title, String msg) {
        if (a == null || a.isFinishing() || msg == null) return;
        new AlertDialog.Builder(a)
                .setTitle(title)
                .setMessage(msg)
                .setPositiveButton("复制", (d, w) -> {
                    try {
                        android.content.ClipboardManager cm = (android.content.ClipboardManager)
                                a.getSystemService(Context.CLIPBOARD_SERVICE);
                        cm.setPrimaryClip(android.content.ClipData.newPlainText("error", msg));
                    } catch (Exception ignored) {
                    }
                })
                .setNegativeButton("关闭", null)
                .show();
    }

    public interface Confirm {
        void onConfirm();
    }

    public static void confirm(Context ctx, String title, String msg, Confirm cb) {
        new AlertDialog.Builder(ctx)
                .setTitle(title)
                .setMessage(msg)
                .setNegativeButton("取消", null)
                .setPositiveButton("确定", (d, w) -> cb.onConfirm())
                .show();
    }

    public interface TextCallback {
        void onText(String text);
    }

    public static void prompt(Context ctx, String title, String hint, String def, TextCallback cb) {
        EditText et = new EditText(ctx);
        et.setHint(hint);
        et.setText(def == null ? "" : def);
        et.setInputType(InputType.TYPE_CLASS_TEXT | InputType.TYPE_TEXT_FLAG_MULTI_LINE);
        et.setTextColor(0xFFEEF3FF);
        et.setHintTextColor(0xFF6E7793);
        int p = dp(ctx, 16);
        et.setPadding(p, p, p, p);
        new AlertDialog.Builder(ctx)
                .setTitle(title)
                .setView(et)
                .setNegativeButton("取消", null)
                .setPositiveButton("确定", (d, w) -> cb.onText(et.getText().toString().trim()))
                .show();
    }

    public static void hideKeyboard(Activity a) {
        try {
            android.view.inputmethod.InputMethodManager im =
                    (android.view.inputmethod.InputMethodManager) a.getSystemService(Context.INPUT_METHOD_SERVICE);
            if (im != null && a.getCurrentFocus() != null) {
                im.hideSoftInputFromWindow(a.getCurrentFocus().getWindowToken(), 0);
            }
        } catch (Exception ignored) {
        }
    }
}
