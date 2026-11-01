package com.jaychat.app;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

/** 与服务端 JSON 一一对应的数据模型（纯 Java） */
public final class Models {

    public static class User {
        public int id;
        public String username = "";
        public String avatar = "";
        public String email = "";
        public String bio = "";
        public boolean isOfficial;
        public String role = "user";
        public boolean online;
        public String remark = "";
        public boolean isAdmin;

        public String displayName() {
            return remark == null || remark.trim().isEmpty() ? username : remark;
        }

        public boolean canAdmin() {
            return isAdmin || "admin".equals(role) || isOfficial;
        }
    }

    public static class Group {
        public int id;
        public String name = "";
        public String avatar = "";
        public int memberCount;
        public int onlineCount;
        public String myRole = "member";
        public boolean dnd;
        public int ownerId;
        public String ownerName = "";
        public String announcement = "";
        public boolean isOfficial;
        public boolean dissolved;

        public static final int ROLE_OWNER = 2;
        public static final int ROLE_ADMIN = 1;

        public int roleWeight() {
            return "owner".equals(myRole) ? ROLE_OWNER : "admin".equals(myRole) ? ROLE_ADMIN : 0;
        }

        public boolean canEdit() {
            return roleWeight() >= ROLE_ADMIN;
        }
    }

    public static class GroupMember {
        public User user;
        public String role = "member";
        public long muteUntil;
        public boolean online;

        public boolean isOwner() {
            return "owner".equals(role);
        }

        public boolean isAdmin() {
            return "admin".equals(role);
        }

        public boolean muted() {
            return muteUntil > System.currentTimeMillis();
        }

        public String title() {
            return user == null ? "" : user.displayName();
        }
    }

    public static class GroupDetail {
        public Group group = new Group();
        public List<GroupMember> members = new ArrayList<>();
        public String myRole = "member";
        public int onlineCount;
        public long myMuteUntil;
        public boolean canEdit;
        public boolean canKick;
        public boolean canSetAdmin;
        public boolean canMute;
        public boolean canTransfer;
        public boolean canInvite;
        public boolean canQuit;
        public boolean canDissolve;
    }

    public static class Conversation {
        public String key = "";
        public String type = "dm";
        public String id = "";
        public String name = "";
        public String avatar = "";
        public User peer;
        public boolean online;
        public int unread;
        public int mention;
        public boolean dnd;
        public String lastText = "";
        public String lastType = "";
        public long lastTime;
        public boolean pinned;
        public int memberCount;
        public boolean isOfficial;
        public boolean dissolved;

        public boolean isGroup() {
            return "group".equals(type);
        }
    }

    public static class Message {
        public long id;
        public String convType = "";
        public String convId = "";
        public int senderId;
        public String senderName = "";
        public String senderAvatar = "";
        public String type = "text";
        public String content = "";
        public String mediaUrl = "";
        public long createdAt;
        public boolean recalled;
        public int readCount;
    }

    public static class FriendResult {
        public User user;
        public boolean isFriend;
        public String pendingDirection;
    }

    public static class MomentMedia {
        public String url = "";
        public String type = "image";
        public String thumb = "";

        public boolean isVideo() {
            return "video".equals(type);
        }

        public String preview() {
            return thumb == null || thumb.trim().isEmpty() ? url : thumb;
        }
    }

    public static class MomentLike {
        public User user;
        public long createdAt;
    }

    public static class MomentComment {
        public long id;
        public User user;
        public String content = "";
        public String msgType = "text";
        public String mediaUrl = "";
        public String mediaThumb = "";
        public User replyToUser;
        public long createdAt;
        public boolean isMine;
    }

    public static class Moment {
        public long id;
        public User author;
        public String text = "";
        public List<MomentMedia> media = new ArrayList<>();
        public String visibility = "public";
        public long createdAt;
        public List<MomentLike> likes = new ArrayList<>();
        public boolean liked;
        public List<MomentComment> comments = new ArrayList<>();
        public boolean isMine;
    }

    public static class Sticker {
        public String id = "";
        public String url = "";
        public String thumb = "";
        public String label = "";
    }

    public static class Notification {
        public long id;
        public String type = "";
        public String text = "";
        public User actor;
        public String refType = "";
        public String refId = "";
        public boolean read;
        public long createdAt;
    }

    public static class FriendRequest {
        public long id;
        public String message = "";
        public long createdAt;
        public User from;
    }

    public static class AdminStats {
        public int totalUsers, todayUsers, weekUsers, onlineUsers, groups, messages, todayMessages, moments, banned, muted;
    }

    public static class AdminDay {
        public String label = "";
        public int users;
        public int messages;
    }

    public static class AdminUser {
        public int id;
        public String username = "";
        public String email = "";
        public String avatar = "";
        public String role = "user";
        public boolean isOfficial;
        public boolean isAdmin;
        public boolean online;
        public long lastSeen;
        public long createdAt;
        public boolean banned;
        public long bannedUntil;
        public boolean muted;
        public long mutedUntil;

        public boolean canOperate() {
            return !isAdmin && !isOfficial;
        }
    }

    public static class AdminOverview {
        public AdminStats stats = new AdminStats();
        public List<AdminDay> days = new ArrayList<>();
        public List<AdminUser> recentUsers = new ArrayList<>();
    }

    /* ------------------------------ 解析 ------------------------------ */

    public static List<JSONObject> toList(JSONArray arr) {
        List<JSONObject> out = new ArrayList<>();
        if (arr == null) return out;
        for (int i = 0; i < arr.length(); i++) {
            JSONObject o = arr.optJSONObject(i);
            if (o != null) out.add(o);
        }
        return out;
    }

    public static User parseUser(JSONObject o) {
        if (o == null || o == JSONObject.NULL) return null;
        User u = new User();
        u.id = o.optInt("id", 0);
        u.username = o.optString("username", "");
        u.avatar = o.optString("avatar", "");
        u.email = o.optString("email", "");
        u.bio = o.optString("bio", "");
        u.isOfficial = o.optBoolean("is_official", false);
        u.role = o.optString("role", "user");
        u.online = o.optBoolean("online", false);
        u.remark = o.optString("remark", "");
        u.isAdmin = o.optBoolean("is_admin", false);
        return u;
    }

    public static Conversation parseConversation(JSONObject o) {
        Conversation c = new Conversation();
        JSONObject last = o.optJSONObject("last");
        c.key = o.optString("key", "");
        c.type = o.optString("conv_type", "dm");
        c.id = o.optString("conv_id", "");
        c.name = o.optString("name", "");
        c.avatar = o.optString("avatar", "");
        c.peer = parseUser(o.optJSONObject("peer"));
        c.online = o.optBoolean("online", false);
        c.unread = o.optInt("unread", 0);
        c.mention = o.optInt("mention", 0);
        c.dnd = o.optBoolean("dnd", false);
        c.lastText = last == null ? "" : last.optString("text", "");
        c.lastType = last == null ? "" : last.optString("msg_type", "");
        c.lastTime = last == null ? 0L : last.optLong("created_at", 0L);
        c.pinned = o.optLong("pinned", 0L) > 0L;
        c.memberCount = o.optInt("member_count", 0);
        c.isOfficial = o.optBoolean("is_official", false);
        c.dissolved = o.optBoolean("dissolved", false);
        return c;
    }

    public static Message parseMessage(JSONObject o) {
        JSONObject sender = o.optJSONObject("sender");
        Message m = new Message();
        m.id = o.optLong("id", 0L);
        m.convType = o.optString("conv_type", "");
        m.convId = o.optString("conv_id", "");
        m.senderId = o.optInt("sender_id", 0);
        m.senderName = sender == null ? "" : sender.optString("username", "");
        m.senderAvatar = sender == null ? "" : sender.optString("avatar", "");
        m.type = o.optString("msg_type", "text");
        m.content = o.optString("content", "");
        m.mediaUrl = o.optString("media_url", "");
        m.createdAt = o.optLong("created_at", 0L);
        m.recalled = o.optBoolean("recalled", false);
        m.readCount = o.optInt("read_count", 0);
        return m;
    }

    public static Group parseGroup(JSONObject o) {
        Group g = new Group();
        g.id = o.optInt("id", 0);
        g.name = o.optString("name", "");
        g.avatar = o.optString("avatar", "");
        g.memberCount = o.optInt("member_count", 0);
        g.onlineCount = o.optInt("online_count", 0);
        g.myRole = o.optString("my_role", "member");
        g.dnd = o.optBoolean("dnd", false);
        g.ownerId = o.optInt("owner_id", 0);
        g.announcement = o.optString("announcement", "");
        g.isOfficial = o.optBoolean("is_official", false);
        g.dissolved = o.optBoolean("dissolved", false);
        JSONObject owner = o.optJSONObject("owner");
        if (owner != null) g.ownerName = owner.optString("username", "");
        return g;
    }

    public static GroupDetail parseGroupDetail(JSONObject o) {
        GroupDetail d = new GroupDetail();
        JSONObject gj = o.optJSONObject("group");
        if (gj != null) d.group = parseGroup(gj);
        d.myRole = o.optString("my_role", d.group.myRole);
        d.onlineCount = o.optInt("online_count", 0);
        d.myMuteUntil = o.optLong("my_mute_until", 0L);
        JSONObject can = o.optJSONObject("can");
        if (can != null) {
            d.canEdit = can.optBoolean("edit", false);
            d.canKick = can.optBoolean("kick", false);
            d.canSetAdmin = can.optBoolean("set_admin", false);
            d.canMute = can.optBoolean("mute", false);
            d.canTransfer = can.optBoolean("transfer", false);
            d.canInvite = can.optBoolean("invite", true);
            d.canQuit = can.optBoolean("quit", false);
            d.canDissolve = can.optBoolean("dissolve", false);
        }
        for (JSONObject it : toList(o.optJSONArray("members"))) {
            GroupMember m = new GroupMember();
            m.user = parseUser(it);
            m.role = it.optString("role", "member");
            m.muteUntil = it.optLong("mute_until", 0L);
            m.online = it.optBoolean("online", false);
            if (m.user != null) d.members.add(m);
        }
        return d;
    }

    public static Moment parseMoment(JSONObject o) {
        Moment m = new Moment();
        m.id = o.optLong("id", 0L);
        m.author = parseUser(o.optJSONObject("author"));
        m.text = o.optString("text", "");
        m.visibility = o.optString("visibility", "public");
        m.createdAt = o.optLong("created_at", 0L);
        m.liked = o.optBoolean("liked", false);
        m.isMine = o.optBoolean("is_mine", false);
        for (JSONObject it : toList(o.optJSONArray("media"))) {
            MomentMedia mm = new MomentMedia();
            mm.url = it.optString("url", "");
            mm.type = it.optString("type", "image");
            mm.thumb = it.optString("thumb", "");
            m.media.add(mm);
        }
        for (JSONObject it : toList(o.optJSONArray("likes"))) {
            MomentLike ml = new MomentLike();
            ml.user = parseUser(it.optJSONObject("user"));
            ml.createdAt = it.optLong("created_at", 0L);
            m.likes.add(ml);
        }
        for (JSONObject it : toList(o.optJSONArray("comments"))) {
            MomentComment mc = new MomentComment();
            mc.id = it.optLong("id", 0L);
            mc.user = parseUser(it.optJSONObject("user"));
            mc.content = it.optString("content", "");
            mc.msgType = it.optString("msg_type", "text");
            mc.mediaUrl = it.optString("media_url", "");
            mc.mediaThumb = it.optString("media_thumb", "");
            mc.replyToUser = parseUser(it.optJSONObject("reply_to_user"));
            mc.createdAt = it.optLong("created_at", 0L);
            mc.isMine = it.optBoolean("is_mine", false);
            m.comments.add(mc);
        }
        return m;
    }

    public static String momentVisibilityLabel(String v) {
        if (v == null) return "公开";
        switch (v) {
            case "private": return "仅自己可见";
            case "friends": return "好友可见";
            case "custom": return "部分好友可见";
            case "exclude": return "部分好友不可见";
            default: return "公开";
        }
    }

    public static Sticker parseSticker(JSONObject o) {
        Sticker s = new Sticker();
        s.id = o.optString("id", "");
        s.url = o.optString("url", "");
        s.thumb = o.optString("thumb", "");
        if (s.thumb.trim().isEmpty()) s.thumb = s.url;
        s.label = o.optString("label", "");
        return s;
    }

    public static Notification parseNotification(JSONObject o) {
        Notification n = new Notification();
        n.id = o.optLong("id", 0L);
        n.type = o.optString("type", "");
        n.text = o.optString("text", "");
        n.actor = parseUser(o.optJSONObject("actor"));
        n.refType = o.optString("ref_type", "");
        n.refId = o.optString("ref_id", "");
        n.read = o.optBoolean("read", false);
        n.createdAt = o.optLong("created_at", 0L);
        return n;
    }

    public static FriendRequest parseFriendRequest(JSONObject o) {
        FriendRequest r = new FriendRequest();
        r.id = o.optLong("id", 0L);
        r.message = o.optString("message", "");
        r.createdAt = o.optLong("created_at", 0L);
        r.from = parseUser(o.optJSONObject("from"));
        return r;
    }

    public static AdminUser parseAdminUser(JSONObject o) {
        AdminUser u = new AdminUser();
        u.id = o.optInt("id", 0);
        u.username = o.optString("username", "");
        u.email = o.optString("email", "");
        u.avatar = o.optString("avatar", "");
        u.role = o.optString("role", "user");
        u.isOfficial = o.optBoolean("is_official", false);
        u.isAdmin = o.optBoolean("is_admin", false);
        u.online = o.optBoolean("online", false);
        u.lastSeen = o.optLong("last_seen", 0L);
        u.createdAt = o.optLong("created_at", 0L);
        u.banned = o.optBoolean("banned", false);
        u.bannedUntil = o.optLong("banned_until", 0L);
        u.muted = o.optBoolean("muted", false);
        u.mutedUntil = o.optLong("muted_until", 0L);
        return u;
    }

    public static AdminOverview parseAdminOverview(JSONObject o) {
        AdminOverview ov = new AdminOverview();
        JSONObject s = o.optJSONObject("stats");
        AdminStats st = ov.stats;
        if (s != null) {
            st.totalUsers = s.optInt("total_users", 0);
            st.todayUsers = s.optInt("today_users", 0);
            st.weekUsers = s.optInt("week_users", 0);
            st.onlineUsers = s.optInt("online_users", 0);
            st.groups = s.optInt("groups", 0);
            st.messages = s.optInt("messages", 0);
            st.todayMessages = s.optInt("today_messages", 0);
            st.moments = s.optInt("moments", 0);
            st.banned = s.optInt("banned", 0);
            st.muted = s.optInt("muted", 0);
        }
        for (JSONObject it : toList(o.optJSONArray("days"))) {
            AdminDay d = new AdminDay();
            d.label = it.optString("label", "");
            d.users = it.optInt("users", 0);
            d.messages = it.optInt("messages", 0);
            ov.days.add(d);
        }
        for (JSONObject it : toList(o.optJSONArray("recent_users"))) {
            ov.recentUsers.add(parseAdminUser(it));
        }
        return ov;
    }
}
