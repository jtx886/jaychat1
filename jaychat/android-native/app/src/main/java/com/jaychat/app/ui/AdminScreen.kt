package com.jaychat.app.ui

import android.widget.Toast
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.jaychat.app.AdminDay
import com.jaychat.app.AdminOverview
import com.jaychat.app.AdminUser
import com.jaychat.app.Net
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun AdminScreen(onBack: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var overview by remember { mutableStateOf<AdminOverview?>(null) }
    var users by remember { mutableStateOf<List<AdminUser>>(emptyList()) }
    var keyword by remember { mutableStateOf("") }
    var loading by remember { mutableStateOf(true) }
    var err by remember { mutableStateOf<String?>(null) }
    var banTarget by remember { mutableStateOf<AdminUser?>(null) }
    var muteTarget by remember { mutableStateOf<AdminUser?>(null) }

    fun load(kw: String = "") {
        scope.launch {
            loading = true
            try {
                val o = withContext(Dispatchers.IO) { Net.api.adminOverview() }
                val u = withContext(Dispatchers.IO) { Net.api.adminUsers(kw) }
                overview = o
                users = u
                err = null
            } catch (e: Exception) {
                err = e.message ?: "加载失败"
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(Unit) { load() }

    fun replace(u: AdminUser) {
        users = users.map { if (it.id == u.id) u else it }
    }

    Column(Modifier.fillMaxSize().background(Bg)) {
        ScreenHeader(title = "后台管理", subtitle = "仅管理员可见", onBack = onBack) {
            IconButton(onClick = { load(keyword) }) {
                Icon(Icons.Default.Refresh, contentDescription = "刷新", tint = TextSub)
            }
        }

        when {
            loading && overview == null -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Primary, strokeWidth = 2.dp)
            }

            err != null && overview == null -> EmptyState(err!!)

            else -> LazyColumn(Modifier.fillMaxSize()) {
                overview?.let { o ->
                    item {
                        Column(Modifier.padding(horizontal = 14.dp)) {
                            Spacer(Modifier.height(12.dp))
                            Row(Modifier.fillMaxWidth()) {
                                StatCard("总用户", o.stats.totalUsers, Modifier.weight(1f))
                                Spacer(Modifier.width(8.dp))
                                StatCard("在线", o.stats.onlineUsers, Modifier.weight(1f))
                            }
                            Spacer(Modifier.height(8.dp))
                            Row(Modifier.fillMaxWidth()) {
                                StatCard("今日注册", o.stats.todayUsers, Modifier.weight(1f))
                                Spacer(Modifier.width(8.dp))
                                StatCard("今日消息", o.stats.todayMessages, Modifier.weight(1f))
                            }
                            Spacer(Modifier.height(8.dp))
                            Row(Modifier.fillMaxWidth()) {
                                StatCard("群聊", o.stats.groups, Modifier.weight(1f))
                                Spacer(Modifier.width(8.dp))
                                StatCard("动态", o.stats.moments, Modifier.weight(1f))
                            }
                            Spacer(Modifier.height(8.dp))
                            Row(Modifier.fillMaxWidth()) {
                                StatCard("封禁", o.stats.banned, Modifier.weight(1f))
                                Spacer(Modifier.width(8.dp))
                                StatCard("禁言", o.stats.muted, Modifier.weight(1f))
                            }
                        }
                    }
                    item {
                        SectionHeader("近 7 天")
                    }
                    item {
                        val maxMessages = (o.days.maxOfOrNull { it.messages } ?: 0).coerceAtLeast(1)
                        Column(
                            Modifier
                                .padding(horizontal = 14.dp)
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(10.dp))
                                .background(Card)
                                .padding(horizontal = 12.dp, vertical = 8.dp)
                        ) {
                            o.days.forEach { d -> DayRow(d, maxMessages) }
                        }
                    }
                }

                item {
                    SectionHeader("用户管理（${users.size}）")
                }
                item {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 14.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedTextField(
                            value = keyword,
                            onValueChange = { keyword = it },
                            placeholder = { Text("搜索昵称 / 邮箱", color = TextSub, fontSize = 13.sp) },
                            leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextSub) },
                            singleLine = true,
                            shape = RoundedCornerShape(12.dp),
                            modifier = Modifier.weight(1f)
                        )
                        TextButton(onClick = { load(keyword.trim()) }, enabled = !loading) {
                            Text("搜索", color = Primary, fontSize = 13.sp)
                        }
                    }
                }

                items(users, key = { it.id }) { u ->
                    AdminUserRow(
                        u = u,
                        busy = loading,
                        onAction = { kind ->
                            when (kind) {
                                "ban" -> {
                                    if (u.banned) {
                                        scope.launch {
                                            try {
                                                replace(withContext(Dispatchers.IO) { Net.api.adminUnbanUser(u.id) })
                                                Toast.makeText(ctx, "已解封", Toast.LENGTH_SHORT).show()
                                            } catch (e: Exception) {
                                                Toast.makeText(ctx, e.message ?: "操作失败", Toast.LENGTH_SHORT).show()
                                            }
                                        }
                                    } else {
                                        banTarget = u
                                    }
                                }

                                else -> {
                                    if (u.muted) {
                                        scope.launch {
                                            try {
                                                replace(withContext(Dispatchers.IO) { Net.api.adminUnmuteUser(u.id) })
                                                Toast.makeText(ctx, "已解除禁言", Toast.LENGTH_SHORT).show()
                                            } catch (e: Exception) {
                                                Toast.makeText(ctx, e.message ?: "操作失败", Toast.LENGTH_SHORT).show()
                                            }
                                        }
                                    } else {
                                        muteTarget = u
                                    }
                                }
                            }
                        }
                    )
                    DividerLine(Modifier.padding(start = 66.dp))
                }

                item { Spacer(Modifier.height(24.dp)) }
            }
        }
    }

    banTarget?.let { u ->
        AlertDialog(
            onDismissRequest = { banTarget = null },
            containerColor = Card,
            title = { Text("封禁 ${u.username}", color = TextMain, fontSize = 17.sp) },
            text = { Text("封禁后该用户将无法登录。请选择时长：", color = TextSub, fontSize = 14.sp) },
            confirmButton = {
                Column(horizontalAlignment = Alignment.End) {
                    TextButton(onClick = {
                        banTarget = null
                        scope.launch {
                            try {
                                replace(withContext(Dispatchers.IO) { Net.api.adminBanUser(u.id, 1) })
                                Toast.makeText(ctx, "已封禁 1 天", Toast.LENGTH_SHORT).show()
                            } catch (e: Exception) {
                                Toast.makeText(ctx, e.message ?: "操作失败", Toast.LENGTH_SHORT).show()
                            }
                        }
                    }) { Text("封禁 1 天", color = Primary) }
                    TextButton(onClick = {
                        banTarget = null
                        scope.launch {
                            try {
                                replace(withContext(Dispatchers.IO) { Net.api.adminBanUser(u.id, 7) })
                                Toast.makeText(ctx, "已封禁 7 天", Toast.LENGTH_SHORT).show()
                            } catch (e: Exception) {
                                Toast.makeText(ctx, e.message ?: "操作失败", Toast.LENGTH_SHORT).show()
                            }
                        }
                    }) { Text("封禁 7 天", color = Primary) }
                    TextButton(onClick = {
                        banTarget = null
                        scope.launch {
                            try {
                                replace(withContext(Dispatchers.IO) { Net.api.adminBanUser(u.id, 0) })
                                Toast.makeText(ctx, "已永久封禁", Toast.LENGTH_SHORT).show()
                            } catch (e: Exception) {
                                Toast.makeText(ctx, e.message ?: "操作失败", Toast.LENGTH_SHORT).show()
                            }
                        }
                    }) { Text("永久封禁", color = Danger) }
                }
            },
            dismissButton = {
                TextButton(onClick = { banTarget = null }) { Text("取消", color = TextSub) }
            }
        )
    }

    muteTarget?.let { u ->
        AlertDialog(
            onDismissRequest = { muteTarget = null },
            containerColor = Card,
            title = { Text("禁言 ${u.username}", color = TextMain, fontSize = 17.sp) },
            text = { Text("禁言期间该用户无法发送消息。请选择时长：", color = TextSub, fontSize = 14.sp) },
            confirmButton = {
                Column(horizontalAlignment = Alignment.End) {
                    TextButton(onClick = {
                        muteTarget = null
                        scope.launch {
                            try {
                                replace(withContext(Dispatchers.IO) { Net.api.adminMuteUser(u.id, 60) })
                                Toast.makeText(ctx, "已禁言 1 小时", Toast.LENGTH_SHORT).show()
                            } catch (e: Exception) {
                                Toast.makeText(ctx, e.message ?: "操作失败", Toast.LENGTH_SHORT).show()
                            }
                        }
                    }) { Text("禁言 1 小时", color = Primary) }
                    TextButton(onClick = {
                        muteTarget = null
                        scope.launch {
                            try {
                                replace(withContext(Dispatchers.IO) { Net.api.adminMuteUser(u.id, 24 * 60) })
                                Toast.makeText(ctx, "已禁言 1 天", Toast.LENGTH_SHORT).show()
                            } catch (e: Exception) {
                                Toast.makeText(ctx, e.message ?: "操作失败", Toast.LENGTH_SHORT).show()
                            }
                        }
                    }) { Text("禁言 1 天", color = Primary) }
                    TextButton(onClick = {
                        muteTarget = null
                        scope.launch {
                            try {
                                replace(withContext(Dispatchers.IO) { Net.api.adminMuteUser(u.id, 7 * 24 * 60) })
                                Toast.makeText(ctx, "已禁言 7 天", Toast.LENGTH_SHORT).show()
                            } catch (e: Exception) {
                                Toast.makeText(ctx, e.message ?: "操作失败", Toast.LENGTH_SHORT).show()
                            }
                        }
                    }) { Text("禁言 7 天", color = Primary) }
                }
            },
            dismissButton = {
                TextButton(onClick = { muteTarget = null }) { Text("取消", color = TextSub) }
            }
        )
    }
}

@Composable
private fun StatCard(label: String, value: Int, modifier: Modifier = Modifier) {
    Column(
        modifier
            .clip(RoundedCornerShape(10.dp))
            .background(Card)
            .padding(horizontal = 14.dp, vertical = 12.dp)
    ) {
        Text(value.toString(), color = TextMain, fontSize = 22.sp, fontWeight = FontWeight.SemiBold)
        Text(label, color = TextSub, fontSize = 12.sp)
    }
}

@Composable
private fun DayRow(d: AdminDay, maxMessages: Int) {
    Row(
        Modifier.fillMaxWidth().padding(vertical = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(d.label, color = TextSub, fontSize = 12.sp, modifier = Modifier.width(52.dp))
        Box(
            Modifier
                .weight(1f)
                .height(6.dp)
                .clip(RoundedCornerShape(3.dp))
                .background(Card2)
        ) {
            val ratio = (d.messages.toFloat() / maxMessages).coerceIn(0f, 1f)
            Box(
                Modifier
                    .fillMaxWidth(if (ratio <= 0f) 0.001f else ratio)
                    .fillMaxSize()
                    .clip(RoundedCornerShape(3.dp))
                    .background(Primary)
            )
        }
        Spacer(Modifier.width(10.dp))
        Text("${d.users} 注册 / ${d.messages} 消息", color = TextSub, fontSize = 11.sp)
    }
}

@Composable
private fun AdminUserRow(u: AdminUser, busy: Boolean, onAction: (String) -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 14.dp, vertical = 9.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Avatar(name = u.username, avatar = u.avatar, size = 40.dp, online = u.online)
        Spacer(Modifier.width(10.dp))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    u.username,
                    color = TextMain,
                    fontSize = 14.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                if (u.isAdmin) {
                    Spacer(Modifier.width(6.dp))
                    Text(
                        "管理员",
                        color = Color(0xFF7FA3FF),
                        fontSize = 10.sp,
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color(0xFF213159))
                            .padding(horizontal = 4.dp, vertical = 1.dp)
                    )
                }
                if (u.banned) {
                    Spacer(Modifier.width(6.dp))
                    Text(
                        "封禁中",
                        color = Danger,
                        fontSize = 10.sp,
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color(0xFF3A1B24))
                            .padding(horizontal = 4.dp, vertical = 1.dp)
                    )
                }
                if (u.muted) {
                    Spacer(Modifier.width(6.dp))
                    Text(
                        "禁言中",
                        color = Color(0xFFFFB020),
                        fontSize = 10.sp,
                        modifier = Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color(0xFF3A2E16))
                            .padding(horizontal = 4.dp, vertical = 1.dp)
                    )
                }
            }
            Text(
                "ID ${u.id} · ${u.email}",
                color = TextSub,
                fontSize = 11.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
        }
        Spacer(Modifier.width(8.dp))
        if (u.canOperate) {
            Column(horizontalAlignment = Alignment.End) {
                ActionButton(if (u.banned) "解封" else "封禁", u.banned, busy) { onAction("ban") }
                Spacer(Modifier.height(4.dp))
                ActionButton(if (u.muted) "解除" else "禁言", u.muted, busy) { onAction("mute") }
            }
        } else {
            Text("不可操作", color = TextSub, fontSize = 11.sp)
        }
    }
}

@Composable
private fun ActionButton(text: String, active: Boolean, busy: Boolean, onClick: () -> Unit) {
    Text(
        text,
        color = if (active) TextSub else Danger,
        fontSize = 12.sp,
        modifier = Modifier
            .clip(RoundedCornerShape(6.dp))
            .background(Card2)
            .clickable(enabled = !busy, onClick = onClick)
            .padding(horizontal = 10.dp, vertical = 4.dp)
    )
}
