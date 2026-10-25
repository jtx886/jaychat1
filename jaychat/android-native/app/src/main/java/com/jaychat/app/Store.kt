package com.jaychat.app

import android.content.Context
import android.content.SharedPreferences

/** 本地持久化：服务器地址、登录态、Cookie。升级 App 不会丢登录态。 */
object Store {
    private const val PREF = "jaychat_prefs"
    const val DEFAULT_BASE = "https://jaychat.ct.ws"

    private lateinit var sp: SharedPreferences

    fun init(ctx: Context) {
        if (!::sp.isInitialized) {
            sp = ctx.applicationContext.getSharedPreferences(PREF, Context.MODE_PRIVATE)
        }
    }

    var base: String
        get() = (sp.getString("base", DEFAULT_BASE) ?: DEFAULT_BASE).ifBlank { DEFAULT_BASE }
        set(v) = sp.edit().putString("base", v.trim().trimEnd('/')).apply()

    var token: String
        get() = sp.getString("token", "") ?: ""
        set(v) = sp.edit().putString("token", v).apply()

    var userJson: String
        get() = sp.getString("user", "") ?: ""
        set(v) = sp.edit().putString("user", v).apply()

    /** 形如 "__test=xxxx;PHPSESSID=yyyy" */
    var cookies: String
        get() = sp.getString("cookies", "") ?: ""
        set(v) = sp.edit().putString("cookies", v).apply()

    fun clearLogin() {
        sp.edit().remove("token").remove("user").apply()
    }
}
