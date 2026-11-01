package com.jaychat.app;

import android.app.Application;

import com.bumptech.glide.Glide;
import com.bumptech.glide.Registry;
import com.bumptech.glide.integration.okhttp3.OkHttpUrlLoader;
import com.bumptech.glide.load.model.GlideUrl;

import java.io.InputStream;

public class JayChatApp extends Application {

    @Override
    public void onCreate() {
        super.onCreate();
        Store.init(this);
        // 图片/表情也走同一个带验证 Cookie 的客户端，避免共享主机人机验证导致图片加载失败
        Registry registry = Glide.get(this).getRegistry();
        registry.replace(GlideUrl.class, InputStream.class,
                new OkHttpUrlLoader.Factory(Api.api().client));
    }
}
