package com.jaychat.app;

import android.content.Context;
import android.content.SharedPreferences;

/** 本地持久化：服务器地址、登录态、Cookie。升级 App 不会丢登录态。 */
public final class Store {
    public static final String DEFAULT_BASE = "https://jaychat.ct.ws";
    private static final String PREF = "jaychat_prefs";
    private static SharedPreferences sp;

    private Store() {
    }

    public static void init(Context ctx) {
        if (sp == null) {
            sp = ctx.getApplicationContext().getSharedPreferences(PREF, Context.MODE_PRIVATE);
        }
    }

    public static String base() {
        String v = sp.getString("base", DEFAULT_BASE);
        if (v == null || v.trim().isEmpty()) v = DEFAULT_BASE;
        return v.trim();
    }

    public static void setBase(String v) {
        sp.edit().putString("base", v.trim()).apply();
    }

    public static String token() {
        return sp.getString("token", "");
    }

    public static void setToken(String v) {
        sp.edit().putString("token", v == null ? "" : v).apply();
    }

    public static String userJson() {
        return sp.getString("user", "");
    }

    public static void setUserJson(String v) {
        sp.edit().putString("user", v == null ? "" : v).apply();
    }

    public static String cookies() {
        return sp.getString("cookies", "");
    }

    public static void setCookies(String v) {
        sp.edit().putString("cookies", v == null ? "" : v).apply();
    }

    public static void clearLogin() {
        sp.edit().remove("token").remove("user").apply();
    }
}
