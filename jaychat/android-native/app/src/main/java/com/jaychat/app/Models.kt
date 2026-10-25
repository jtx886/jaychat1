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
) {
    val displayName: String get() = remark.ifBlank { username }
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

fun JSONArray.toList(): List<JSONObject> = (0 until length()).mapNotNull { optJSONObject(it) }
