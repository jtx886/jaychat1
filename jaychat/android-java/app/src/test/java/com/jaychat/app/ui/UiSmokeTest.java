package com.jaychat.app.ui;

import static org.junit.Assert.assertNotNull;

import android.app.Application;
import android.widget.FrameLayout;

import androidx.test.core.app.ApplicationProvider;

import com.jaychat.app.AuthActivity;
import com.jaychat.app.Models;
import com.jaychat.app.R;
import com.jaychat.app.Store;

import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;

import java.util.ArrayList;
import java.util.List;

/** 在 JVM 上真实创建 Activity / 绑定列表，提前发现启动闪退类问题 */
@RunWith(RobolectricTestRunner.class)
@Config(sdk = 35, application = UiSmokeTest.TestApp.class)
public class UiSmokeTest {

    public static class TestApp extends Application {
        @Override
        public void onCreate() {
            super.onCreate();
            Store.init(this);
        }
    }

    private AuthActivity activity;
    private FrameLayout parent;

    @Before
    public void setUp() {
        activity = Robolectric.buildActivity(AuthActivity.class).setup().get();
        parent = new FrameLayout(activity);
    }

    @Test
    public void authActivity_inflates() {
        assertNotNull(activity);
        assertNotNull(activity.findViewById(R.id.btnSubmit));
    }

    @Test
    public void mainActivity_starts() {
        Store.init(ApplicationProvider.getApplicationContext());
        Store.setToken("test-token");
        Store.setUserJson("{\"id\":1,\"username\":\"me\",\"avatar\":\"\",\"email\":\"a@b.c\",\"bio\":\"\"}");
        ActivityController<MainActivity> c = Robolectric.buildActivity(MainActivity.class).setup();
        assertNotNull(c.get());
    }

    @Test
    public void allActivities_inflate() {
        Store.init(ApplicationProvider.getApplicationContext());
        Store.setToken("test-token");
        Store.setUserJson("{\"id\":1,\"username\":\"me\",\"avatar\":\"\",\"email\":\"a@b.c\",\"bio\":\"\"}");
        Class<? extends android.app.Activity>[] screens = new Class[]{
                MainActivity.class, ChatActivity.class, PostMomentActivity.class,
                AddFriendActivity.class, EditProfileActivity.class, StickersActivity.class,
                NotificationsActivity.class, ServerSettingsActivity.class, AdminActivity.class,
                CreateGroupActivity.class, GroupInfoActivity.class, FriendInfoActivity.class,
                BlacklistActivity.class, MomentDetailActivity.class, UserMomentsActivity.class
        };
        for (Class<? extends android.app.Activity> cls : screens) {
            Robolectric.buildActivity(cls).setup();
        }
    }

    @Test
    public void contactAdapter_bindsSectionGroupUser() {
        Models.Group g = new Models.Group();
        g.id = 1;
        g.name = "测试群";
        g.avatar = "";
        Models.User u = new Models.User();
        u.id = 2;
        u.username = "测试好友";
        u.avatar = "";

        ContactAdapter.Item s = new ContactAdapter.Item();
        s.type = ContactAdapter.TYPE_SECTION;
        s.section = "群聊";
        ContactAdapter.Item gi = new ContactAdapter.Item();
        gi.type = ContactAdapter.TYPE_GROUP;
        gi.group = g;
        ContactAdapter.Item ui = new ContactAdapter.Item();
        ui.type = ContactAdapter.TYPE_USER;
        ui.user = u;

        ContactAdapter a = new ContactAdapter(item -> {
        }, item -> {
        });
        List<ContactAdapter.Item> list = new ArrayList<>();
        list.add(s);
        list.add(gi);
        list.add(ui);
        a.setData(list);

        for (int i = 0; i < list.size(); i++) {
            ContactAdapter.VH h = a.onCreateViewHolder(parent, a.getItemViewType(i));
            a.onBindViewHolder(h, i);
        }
    }

    @Test
    public void conversationAdapter_bindsDmAndGroup() {
        Models.Conversation dm = new Models.Conversation();
        dm.id = "1_2";
        dm.type = "dm";
        dm.name = "好友";
        dm.avatar = "";
        dm.lastText = "你好";
        dm.lastTime = System.currentTimeMillis();
        dm.unread = 2;
        Models.Conversation gp = new Models.Conversation();
        gp.id = "5";
        gp.type = "group";
        gp.name = "群聊";
        gp.avatar = "";
        gp.lastText = "消息";
        gp.lastTime = System.currentTimeMillis();
        gp.memberCount = 8;

        ConversationsFragment.ConversationAdapter a =
                new ConversationsFragment.ConversationAdapter(c -> {
                }, (c, anchor) -> {
                });
        List<Models.Conversation> list = new ArrayList<>();
        list.add(dm);
        list.add(gp);
        a.setData(list);
        for (int i = 0; i < list.size(); i++) {
            ConversationsFragment.ConversationAdapter.VH h =
                    a.onCreateViewHolder(parent, a.getItemViewType(i));
            a.onBindViewHolder(h, i);
        }
    }

    @Test
    public void momentAdapter_bindsCardWithLikesAndComments() {
        Models.User author = new Models.User();
        author.id = 1;
        author.username = "作者";
        author.avatar = "";
        Models.Moment m = new Models.Moment();
        m.id = 10;
        m.author = author;
        m.text = "动态内容";
        m.createdAt = System.currentTimeMillis();
        m.visibility = "public";
        m.isMine = true;
        Models.MomentLike like = new Models.MomentLike();
        like.user = author;
        m.likes.add(like);
        Models.MomentComment cm = new Models.MomentComment();
        cm.id = 1;
        cm.user = author;
        cm.content = "评论";
        cm.msgType = "text";
        m.comments.add(cm);

        MomentAdapter a = new MomentAdapter(new MomentAdapter.Listener() {
            @Override
            public void onLike(Models.Moment mm) {
            }

            @Override
            public void onComment(Models.Moment mm) {
            }

            @Override
            public void onMore(Models.Moment mm, android.view.View anchor) {
            }

            @Override
            public void onMedia(Models.MomentMedia media) {
            }

            @Override
            public void onCommentLong(Models.Moment mm, Models.MomentComment c) {
            }

            @Override
            public void onOpen(Models.Moment mm) {
            }
        });
        List<Models.Moment> list = new ArrayList<>();
        list.add(m);
        a.setData(list);
        MomentAdapter.VH h = a.onCreateViewHolder(parent, 0);
        a.onBindViewHolder(h, 0);
    }

    @Test
    public void messageAdapter_bindsTextAndRecalled() {
        Models.Message t = new Models.Message();
        t.id = 1;
        t.senderId = 9;
        t.senderName = "我";
        t.senderAvatar = "";
        t.type = "text";
        t.content = "你好";
        t.createdAt = System.currentTimeMillis();
        Models.Message rc = new Models.Message();
        rc.id = 2;
        rc.senderId = 1;
        rc.senderName = "对方";
        rc.type = "text";
        rc.recalled = true;

        MessageAdapter a = new MessageAdapter(1, false, new MessageAdapter.Listener() {
            @Override
            public void onLongPress(Models.Message m, android.view.View anchor) {
            }

            @Override
            public void onMedia(Models.Message m) {
            }
        });
        List<Models.Message> list = new ArrayList<>();
        list.add(t);
        list.add(rc);
        a.setData(list);
        for (int i = 0; i < list.size(); i++) {
            MessageAdapter.VH h = a.onCreateViewHolder(parent, a.getItemViewType(i));
            a.onBindViewHolder(h, i);
        }
    }
}
