package com.jaychat.app

import org.json.JSONArray
import org.json.JSONObject

data class User(
    val id: Int,
    val username: String,
    val avatar: String,
    val email: String = "",
    val bio: String = "",
    val isOfficial: Boolean = false,
    val role: String = "user",
    val online: Boolean = false,
    val remark: String = "",
    val isAdmin: Boolean = false,
) {
    val displayName: String get() = remark.ifBlank { username }
    val canAdmin: Boolean get() = isAdmin || role == "admin" || isOfficial
}

data class Group(
    val id: Int,
    val name: String,
    val avatar: String,
    val memberCount: Int = 0,
    val onlineCount: Int = 0,
    val myRole: String = "member",
    val dnd: Boolean = false,
)

data class Conversation(
    val key: String,
    val type: String,
    val id: String,
    val name: String,
    val avatar: String,
    val peer: User?,
    val online: Boolean,
    val unread: Int,
    val mention: Int,
    val dnd: Boolean,
    val lastText: String,
    val lastType: String,
    val lastTime: Long,
    val pinned: Boolean,
    val memberCount: Int,
    val isOfficial: Boolean,
    val dissolved: Boolean,
) {
    val isGroup: Boolean get() = type == "group"
}

data class Message(
    val id: Long,
    val convType: String,
    val convId: String,
    val senderId: Int,
    val senderName: String,
    val senderAvatar: String,
    val type: String,
    val content: String,
    val mediaUrl: String,
    val createdAt: Long,
    val recalled: Boolean,
    val readCount: Int,
)

data class FriendResult(
    val user: User,
    val isFriend: Boolean,
    val pendingDirection: String?, // "out" / "in" / null
)

fun parseUser(o: JSONObject?): User? {
    if (o == null || o === JSONObject.NULL) return null
    return User(
        id = o.optInt("id", 0),
        username = o.optString("username", ""),
        avatar = o.optString("avatar", ""),
        email = o.optString("email", ""),
        bio = o.optString("bio", ""),
        isOfficial = o.optBoolean("is_official", false),
        role = o.optString("role", "user"),
        online = o.optBoolean("online", false),
        remark = o.optString("remark", ""),
        isAdmin = o.optBoolean("is_admin", false),
    )
}

fun parseConversation(o: JSONObject): Conversation {
    val last = o.optJSONObject("last")
    return Conversation(
        key = o.optString("key", ""),
        type = o.optString("conv_type", "dm"),
        id = o.optString("conv_id", ""),
        name = o.optString("name", ""),
        avatar = o.optString("avatar", ""),
        peer = parseUser(o.optJSONObject("peer")),
        online = o.optBoolean("online", false),
        unread = o.optInt("unread", 0),
        mention = o.optInt("mention", 0),
        dnd = o.optBoolean("dnd", false),
        lastText = last?.optString("text", "") ?: "",
        lastType = last?.optString("msg_type", "") ?: "",
        lastTime = last?.optLong("created_at", 0L) ?: 0L,
        pinned = o.optLong("pinned", 0L) > 0L,
        memberCount = o.optInt("member_count", 0),
        isOfficial = o.optBoolean("is_official", false),
        dissolved = o.optBoolean("dissolved", false),
    )
}

fun parseMessage(o: JSONObject): Message {
    val sender = o.optJSONObject("sender")
    return Message(
        id = o.optLong("id", 0L),
        convType = o.optString("conv_type", ""),
        convId = o.optString("conv_id", ""),
        senderId = o.optInt("sender_id", 0),
        senderName = sender?.optString("username", "") ?: "",
        senderAvatar = sender?.optString("avatar", "") ?: "",
        type = o.optString("msg_type", "text"),
        content = o.optString("content", ""),
        mediaUrl = o.optString("media_url", ""),
        createdAt = o.optLong("created_at", 0L),
        recalled = o.optBoolean("recalled", false),
        readCount = o.optInt("read_count", 0),
    )
}

fun parseGroup(o: JSONObject): Group = Group(
    id = o.optInt("id", 0),
    name = o.optString("name", ""),
    avatar = o.optString("avatar", ""),
    memberCount = o.optInt("member_count", 0),
    onlineCount = o.optInt("online_count", 0),
    myRole = o.optString("my_role", "member"),
    dnd = o.optBoolean("dnd", false),
)

/* ------------------------------ 动态 ------------------------------ */

data class MomentMedia(val url: String, val type: String, val thumb: String) {
    val isVideo: Boolean get() = type == "video"
    val preview: String get() = thumb.ifBlank { url }
}

data class MomentLike(val user: User?, val createdAt: Long)

data class MomentComment(
    val id: Long,
    val user: User?,
    val content: String,
    val msgType: String,
    val mediaUrl: String,
    val mediaThumb: String,
    val replyToUser: User?,
    val createdAt: Long,
    val isMine: Boolean,
)

data class Moment(
    val id: Long,
    val author: User?,
    val text: String,
    val media: List<MomentMedia>,
    val visibility: String,
    val createdAt: Long,
    val likes: List<MomentLike>,
    val liked: Boolean,
    val comments: List<MomentComment>,
    val isMine: Boolean,
)

fun parseMoment(o: JSONObject): Moment {
    val mediaArr = o.optJSONArray("media")
    val media = mediaArr?.toList()?.map {
        MomentMedia(
            url = it.optString("url", ""),
            type = it.optString("type", "image"),
            thumb = it.optString("thumb", ""),
        )
    } ?: emptyList()
    val likesArr = o.optJSONArray("likes")
    val likes = likesArr?.toList()?.map {
        MomentLike(parseUser(it.optJSONObject("user")), it.optLong("created_at", 0L))
    } ?: emptyList()
    val commentsArr = o.optJSONArray("comments")
    val comments = commentsArr?.toList()?.map {
        MomentComment(
            id = it.optLong("id", 0L),
            user = parseUser(it.optJSONObject("user")),
            content = it.optString("content", ""),
            msgType = it.optString("msg_type", "text"),
            mediaUrl = it.optString("media_url", ""),
            mediaThumb = it.optString("media_thumb", ""),
            replyToUser = parseUser(it.optJSONObject("reply_to_user")),
            createdAt = it.optLong("created_at", 0L),
            isMine = it.optBoolean("is_mine", false),
        )
    } ?: emptyList()
    return Moment(
        id = o.optLong("id", 0L),
        author = parseUser(o.optJSONObject("author")),
        text = o.optString("text", ""),
        media = media,
        visibility = o.optString("visibility", "public"),
        createdAt = o.optLong("created_at", 0L),
        likes = likes,
        liked = o.optBoolean("liked", false),
        comments = comments,
        isMine = o.optBoolean("is_mine", false),
    )
}

fun momentVisibilityLabel(v: String): String = when (v) {
    "private" -> "仅自己可见"
    "friends" -> "好友可见"
    "custom" -> "部分好友可见"
    "exclude" -> "部分好友不可见"
    else -> "公开"
}

/* ------------------------------ 表情包 ------------------------------ */

data class Sticker(val id: String, val url: String, val thumb: String, val label: String)

fun parseSticker(o: JSONObject): Sticker = Sticker(
    id = o.optString("id", ""),
    url = o.optString("url", ""),
    thumb = o.optString("thumb", "").ifBlank { o.optString("url", "") },
    label = o.optString("label", ""),
)

/* ------------------------------ 后台 ------------------------------ */

data class AdminStats(
    val totalUsers: Int,
    val todayUsers: Int,
    val weekUsers: Int,
    val onlineUsers: Int,
    val groups: Int,
    val messages: Int,
    val todayMessages: Int,
    val moments: Int,
    val banned: Int,
    val muted: Int,
)

data class AdminDay(val label: String, val users: Int, val messages: Int)

data class AdminUser(
    val id: Int,
    val username: String,
    val email: String,
    val avatar: String,
    val role: String,
    val isOfficial: Boolean,
    val isAdmin: Boolean,
    val online: Boolean,
    val lastSeen: Long,
    val createdAt: Long,
    val banned: Boolean,
    val bannedUntil: Long,
    val muted: Boolean,
    val mutedUntil: Long,
) {
    val displayName: String get() = username
    val canOperate: Boolean get() = !isAdmin && !isOfficial
}

data class AdminOverview(
    val stats: AdminStats,
    val days: List<AdminDay>,
    val recentUsers: List<AdminUser>,
)

fun parseAdminUser(o: JSONObject): AdminUser = AdminUser(
    id = o.optInt("id", 0),
    username = o.optString("username", ""),
    email = o.optString("email", ""),
    avatar = o.optString("avatar", ""),
    role = o.optString("role", "user"),
    isOfficial = o.optBoolean("is_official", false),
    isAdmin = o.optBoolean("is_admin", false),
    online = o.optBoolean("online", false),
    lastSeen = o.optLong("last_seen", 0L),
    createdAt = o.optLong("created_at", 0L),
    banned = o.optBoolean("banned", false),
    bannedUntil = o.optLong("banned_until", 0L),
    muted = o.optBoolean("muted", false),
    mutedUntil = o.optLong("muted_until", 0L),
)

private fun parseAdminStats(o: JSONObject?): AdminStats = AdminStats(
    totalUsers = o?.optInt("total_users", 0) ?: 0,
    todayUsers = o?.optInt("today_users", 0) ?: 0,
    weekUsers = o?.optInt("week_users", 0) ?: 0,
    onlineUsers = o?.optInt("online_users", 0) ?: 0,
    groups = o?.optInt("groups", 0) ?: 0,
    messages = o?.optInt("messages", 0) ?: 0,
    todayMessages = o?.optInt("today_messages", 0) ?: 0,
    moments = o?.optInt("moments", 0) ?: 0,
    banned = o?.optInt("banned", 0) ?: 0,
    muted = o?.optInt("muted", 0) ?: 0,
)

fun parseAdminOverview(o: JSONObject): AdminOverview {
    val days = o.optJSONArray("days")?.toList()?.map {
        AdminDay(
            label = it.optString("label", ""),
            users = it.optInt("users", 0),
            messages = it.optInt("messages", 0),
        )
    } ?: emptyList()
    val recent = o.optJSONArray("recent_users")?.toList()?.map { parseAdminUser(it) } ?: emptyList()
    return AdminOverview(parseAdminStats(o.optJSONObject("stats")), days, recent)
}

fun JSONArray.toList(): List<JSONObject> = (0 until length()).mapNotNull { optJSONObject(it) }
