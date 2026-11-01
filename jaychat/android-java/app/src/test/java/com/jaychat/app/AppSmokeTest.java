package com.jaychat.app;

import static org.junit.Assert.assertNotNull;

import androidx.test.core.app.ApplicationProvider;

import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

/** 使用真实的 Application（含 Glide 初始化），验证进程启动不崩溃 */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35)
public class AppSmokeTest {

    @Test
    public void application_starts() {
        assertNotNull(ApplicationProvider.getApplicationContext());
        assertNotNull(Api.api().client);
    }
}
