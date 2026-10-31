package com.jaychat.app

import android.app.Application
import android.os.Build
import coil.ImageLoader
import coil.ImageLoaderFactory
import coil.decode.GifDecoder
import coil.decode.ImageDecoderDecoder

class JayChatApp : Application(), ImageLoaderFactory {
    override fun onCreate() {
        super.onCreate()
        Store.init(this)
    }

    /**
     * 图片也走同一个 OkHttp 客户端：共享主机的 __test 验证 Cookie 才能一并带上，
     * 否则头像 / 聊天图片会被验证页拦截显示不出来。
     */
    override fun newImageLoader(): ImageLoader =
        ImageLoader.Builder(this)
            .okHttpClient(Net.api.client)
            .crossfade(true)
            .components {
                // 动画表情（GIF）播放支持
                if (Build.VERSION.SDK_INT >= 28) {
                    add(ImageDecoderDecoder.Factory())
                } else {
                    add(GifDecoder.Factory())
                }
            }
            .build()
}
