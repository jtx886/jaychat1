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
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.ExitToApp
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
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
import com.jaychat.app.Conversation
import com.jaychat.app.FriendResult
import com.jaychat.app.Group
import com.jaychat.app.MainViewModel
import com.jaychat.app.Net
import com.jaychat.app.User
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun MainScreen(vm: MainViewModel, onOpenChat: (Conversation) -> Unit) {
    var tab by remember { mutableIntStateOf(0) }

    Scaffold(
        containerColor = Bg,
        bottomBar = {
            NavigationBar(containerColor = Card, tonalElevation = 0.dp) {
                NavigationBarItem(
                    selected = tab == 0,
                    onClick = { tab = 0 },
                    icon = { Icon(Icons.Default.Email, contentDescription = null) },
                    label = { Text("消息", fontSize = 11.sp) }
                )
                NavigationBarItem(
                    selected = tab == 1,
                    onClick = { tab = 1 },
                    icon = { Icon(Icons.Default.Person, contentDescription = null) },
                    label = { Text("通讯录", fontSize = 11.sp) }
                )
                NavigationBarItem(
                    selected = tab == 2,
                    onClick = { tab = 2 },
                    icon = { Icon(Icons.Default.Settings, contentDescription = null) },
                    label = { Text("我", fontSize = 11.sp) }
                )
            }
        }
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            when (tab) {
                0 -> ConversationsTab(vm, onOpenChat)
                1 -> ContactsTab(vm, onOpenChat)
                else -> MeTab(vm)
            }
        }
    }
}

/* ------------------------------- 消息 ------------------------------- */

@Composable
private fun ConversationsTab(vm: MainViewModel, onOpenChat: (Conversation) -> Unit) {
    ScreenHeader(
        title = "Jay Chat",
        subtitle = if (vm.conversations.isEmpty()) "暂无会话" else "${vm.conversations.size} 个会话"
    ) {
        IconButton(onClick = { vm.refreshAll() }) {
            Icon(Icons.Default.Refresh, contentDescription = "刷新", tint = TextSub)
        }
    }
    if (vm.conversations.isEmpty()) {
        EmptyState("还没有聊天，去通讯录找好友吧")
        return
    }
    LazyColumn(Modifier.fillMaxSize()) {
        items(vm.conversations, key = { it.key }) { c ->
            ConversationRow(c) { onOpenChat(c) }
            DividerLine(Modifier.padding(start = 74.dp))
        }
    }
}

@Composable
private fun ConversationRow(c: Conversation, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(if (c.pinned) Card2 else Color.Transparent)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 11.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Avatar(
            name = c.name,
            avatar = c.avatar,
            size = 48.dp,
            online = if (!c.isGroup) c.online else null
        )
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    c.name,
                    color = TextMain,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f, fill = false)
                )
                if (c.pinned) {
                    Spacer(Modifier.width(6.dp))
                    Box(
                        Modifier
                            .clip(RoundedCornerShape(4.dp))
                            .background(Color(0xFF213159))
                            .padding(horizontal = 4.dp, vertical = 1.dp)
                    ) {
                        Text("置顶", color = Color(0xFF7FA3FF), fontSize = 9.sp)
                    }
                }
                Spacer(Modifier.weight(1f))
                Text(formatTime(c.lastTime), color = TextSub, fontSize = 11.sp)
            }
            Spacer(Modifier.height(5.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = if (c.lastText.isBlank()) "开始聊天吧" else c.lastText,
                    color = TextSub,
                    fontSize = 13.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f)
                )
                if (c.unread > 0) {
                    Spacer(Modifier.width(8.dp))
                    if (c.dnd) {
                        // 免打扰：灰点（像 QQ），不显示数字
                        Box(
                            Modifier
                                .size(9.dp)
                                .clip(CircleShape)
                                .background(Color(0xFF5B6479))
                        )
                    } else {
                        Box(
                            Modifier
                                .clip(CircleShape)
                                .background(Danger)
                                .padding(horizontal = 6.dp, vertical = 2.dp)
                        ) {
                            Text(
                                if (c.unread > 99) "99+" else c.unread.toString(),
                                color = Color.White,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }
            }
        }
    }
}

/* ------------------------------- 通讯录 ------------------------------- */

@Composable
private fun ContactsTab(vm: MainViewModel, onOpenChat: (Conversation) -> Unit) {
    val me = vm.me ?: return
    var keyword by remember { mutableStateOf("") }
    var showAdd by remember { mutableStateOf(false) }

    ScreenHeader(title = "通讯录", subtitle = "${vm.groups.size} 个群聊 · ${vm.friends.size} 位好友") {
        IconButton(onClick = { showAdd = true }) {
            Icon(Icons.Default.Add, contentDescription = "添加好友", tint = TextMain)
        }
    }

    val filteredFriends = remember(keyword, vm.friends) {
        if (keyword.isBlank()) vm.friends
        else vm.friends.filter { it.displayName.contains(keyword, true) || it.id.toString() == keyword.trim() }
    }
    val filteredGroups = remember(keyword, vm.groups) {
        if (keyword.isBlank()) vm.groups
        else vm.groups.filter { it.name.contains(keyword, true) || it.id.toString() == keyword.trim() }
    }

    OutlinedTextField(
        value = keyword,
        onValueChange = { keyword = it },
        placeholder = { Text("搜索好友 / 群聊", color = TextSub, fontSize = 13.sp) },
        leadingIcon = { Icon(Icons.Default.Search, contentDescription = null, tint = TextSub) },
        singleLine = true,
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 14.dp, vertical = 8.dp)
    )

    fun openDm(friend: User) {
        val cid = "${minOf(me.id, friend.id)}_${maxOf(me.id, friend.id)}"
        val existing = vm.conversations.firstOrNull { it.key == "dm_$cid" }
        onOpenChat(
            existing ?: Conversation(
                key = "dm_$cid", type = "dm", id = cid, name = friend.displayName,
                avatar = friend.avatar, peer = friend, online = friend.online,
                unread = 0, mention = 0, dnd = false, lastText = "", lastType = "",
                lastTime = 0, pinned = false, memberCount = 0, isOfficial = false, dissolved = false
            )
        )
    }

    fun openGroup(g: Group) {
        val existing = vm.conversations.firstOrNull { it.key == "group_${g.id}" }
        onOpenChat(
            existing ?: Conversation(
                key = "group_${g.id}", type = "group", id = g.id.toString(), name = g.name,
                avatar = g.avatar, peer = null, online = false, unread = 0, mention = 0,
                dnd = g.dnd, lastText = "", lastType = "", lastTime = 0, pinned = false,
                memberCount = g.memberCount, isOfficial = false, dissolved = false
            )
        )
    }

    if (filteredFriends.isEmpty() && filteredGroups.isEmpty()) {
        EmptyState(if (keyword.isBlank()) "暂无好友和群聊" else "没有找到匹配的结果")
        return
    }

    LazyColumn(Modifier.fillMaxSize()) {
        if (filteredGroups.isNotEmpty()) {
            item { SectionHeader("群聊") }
            items(filteredGroups, key = { "g_${it.id}" }) { g ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clickable { openGroup(g) }
                        .padding(horizontal = 14.dp, vertical = 9.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Avatar(name = g.name, avatar = g.avatar, size = 44.dp)
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(g.name, color = TextMain, fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text("${g.memberCount} 人 · 群 ID ${g.id}", color = TextSub, fontSize = 11.sp)
                    }
                }
                DividerLine(Modifier.padding(start = 70.dp))
            }
        }
        if (filteredFriends.isNotEmpty()) {
            item { SectionHeader("好友") }
            items(filteredFriends, key = { "f_${it.id}" }) { f ->
                Row(
                    Modifier
                        .fillMaxWidth()
                        .clickable { openDm(f) }
                        .padding(horizontal = 14.dp, vertical = 9.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Avatar(name = f.displayName, avatar = f.avatar, size = 44.dp, online = f.online)
                    Spacer(Modifier.width(12.dp))
                    Column {
                        Text(f.displayName, color = TextMain, fontSize = 15.sp, maxLines = 1)
                        Text(
                            if (f.isOfficial) "官方" else "ID ${f.id}",
                            color = TextSub,
                            fontSize = 11.sp
                        )
                    }
                }
                DividerLine(Modifier.padding(start = 70.dp))
            }
        }
        item { Spacer(Modifier.height(20.dp)) }
    }

    if (showAdd) AddFriendDialog(vm) { showAdd = false }
}

@Composable
private fun AddFriendDialog(vm: MainViewModel, onDismiss: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var keyword by remember { mutableStateOf("") }
    var searching by remember { mutableStateOf(false) }
    var results by remember { mutableStateOf<List<FriendResult>>(emptyList()) }
    var searched by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun search() {
        val q = keyword.trim()
        if (q.isEmpty()) {
            error = "请输入昵称或用户 ID"
            return
        }
        searching = true
        error = null
        scope.launch {
            try {
                results = withContext(Dispatchers.IO) { Net.api.searchUsers(q) }
                searched = true
            } catch (e: Exception) {
                error = e.message ?: "搜索失败"
            } finally {
                searching = false
            }
        }
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = Card,
        title = { Text("添加好友", color = TextMain, fontSize = 17.sp) },
        text = {
            Column {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    OutlinedTextField(
                        value = keyword,
                        onValueChange = { keyword = it; error = null },
                        placeholder = { Text("昵称 / 用户 ID", color = TextSub, fontSize = 13.sp) },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    Spacer(Modifier.width(8.dp))
                    Button(
                        onClick = { search() },
                        enabled = !searching,
                        shape = RoundedCornerShape(10.dp),
                        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp, vertical = 10.dp)
                    ) {
                        Text(if (searching) "…" else "搜索", fontSize = 13.sp)
                    }
                }
                if (error != null) {
                    Text(error!!, color = Danger, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
                }
                Spacer(Modifier.height(8.dp))
                LazyColumn(Modifier.heightIn(max = 320.dp)) {
                    items(results, key = { it.user.id }) { r ->
                        Row(
                            Modifier.fillMaxWidth().padding(vertical = 8.dp),
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Avatar(r.user.displayName, r.user.avatar, size = 40.dp)
                            Spacer(Modifier.width(10.dp))
                            Column(Modifier.weight(1f)) {
                                Text(r.user.displayName, color = TextMain, fontSize = 14.sp, maxLines = 1)
                                Text("ID ${r.user.id}", color = TextSub, fontSize = 11.sp)
                            }
                            when {
                                r.isFriend -> Text("已是好友", color = TextSub, fontSize = 12.sp)
                                r.pendingDirection == "out" -> Text("已申请", color = TextSub, fontSize = 12.sp)
                                r.pendingDirection == "in" -> Text("待你同意", color = Primary, fontSize = 12.sp)
                                else -> Button(
                                    onClick = {
                                        scope.launch {
                                            try {
                                                val msg = withContext(Dispatchers.IO) {
                                                    Net.api.requestFriend(r.user.id)
                                                }
                                                Toast.makeText(ctx, msg, Toast.LENGTH_SHORT).show()
                                                results = results.map {
                                                    if (it.user.id == r.user.id) it.copy(pendingDirection = "out") else it
                                                }
                                            } catch (e: Exception) {
                                                Toast.makeText(ctx, e.message ?: "发送失败", Toast.LENGTH_SHORT).show()
                                            }
                                        }
                                    },
                                    shape = RoundedCornerShape(10.dp),
                                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                                ) {
                                    Text("加好友", fontSize = 12.sp)
                                }
                            }
                        }
                    }
                }
                if (searched && results.isEmpty() && error == null) {
                    Text("没有找到用户", color = TextSub, fontSize = 12.sp)
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("关闭", color = TextSub) }
        }
    )
}

/* ------------------------------- 我 ------------------------------- */

@Composable
private fun MeTab(vm: MainViewModel) {
    val me = vm.me ?: return
    val ctx = LocalContext.current
    var showServer by remember { mutableStateOf(false) }

    ScreenHeader(title = "我的")

    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier
                .fillMaxWidth()
                .background(Card)
                .padding(horizontal = 18.dp, vertical = 20.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Avatar(name = me.username, avatar = me.avatar, size = 66.dp)
            Spacer(Modifier.width(16.dp))
            Column {
                Text(me.username, color = TextMain, fontSize = 19.sp, fontWeight = FontWeight.SemiBold)
                Spacer(Modifier.height(3.dp))
                Text("ID ${me.id}", color = TextSub, fontSize = 12.sp)
                if (me.email.isNotBlank()) {
                    Text(me.email, color = TextSub, fontSize = 12.sp)
                }
                if (me.bio.isNotBlank()) {
                    Text(me.bio, color = TextSub, fontSize = 12.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
        }

        Spacer(Modifier.height(12.dp))
        Column(Modifier.background(Card)) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .clickable { showServer = true }
                    .padding(horizontal = 18.dp, vertical = 16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("服务器地址", color = TextMain, fontSize = 15.sp, modifier = Modifier.weight(1f))
                Text(vm.serverBase, color = TextSub, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
            DividerLine(Modifier.padding(start = 18.dp))
            Row(
                Modifier
                    .fillMaxWidth()
                    .clickable { vm.refreshAll() }
                    .padding(horizontal = 18.dp, vertical = 16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("刷新数据", color = TextMain, fontSize = 15.sp, modifier = Modifier.weight(1f))
                Icon(Icons.Default.Refresh, contentDescription = null, tint = TextSub, modifier = Modifier.size(18.dp))
            }
            DividerLine(Modifier.padding(start = 18.dp))
            Row(
                Modifier
                    .fillMaxWidth()
                    .clickable {
                        vm.logout()
                        Toast.makeText(ctx, "已退出登录", Toast.LENGTH_SHORT).show()
                    }
                    .padding(horizontal = 18.dp, vertical = 16.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text("退出登录", color = Danger, fontSize = 15.sp, modifier = Modifier.weight(1f))
                Icon(Icons.Default.ExitToApp, contentDescription = null, tint = Danger, modifier = Modifier.size(18.dp))
            }
        }

        Spacer(Modifier.height(24.dp))
        Text(
            "Jay Chat 安卓原生版 2.0.0",
            color = TextSub,
            fontSize = 11.sp,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp)
        )
        Spacer(Modifier.height(16.dp))
    }

    if (showServer) {
        var input by remember { mutableStateOf(vm.serverBase) }
        var err by remember { mutableStateOf<String?>(null) }
        AlertDialog(
            onDismissRequest = { showServer = false },
            containerColor = Card,
            title = { Text("服务器地址", color = TextMain, fontSize = 17.sp) },
            text = {
                Column {
                    OutlinedTextField(
                        value = input,
                        onValueChange = { input = it; err = null },
                        singleLine = true,
                        placeholder = { Text("https://jaychat.ct.ws", color = TextSub, fontSize = 13.sp) },
                        modifier = Modifier.fillMaxWidth()
                    )
                    if (err != null) {
                        Text(err!!, color = Danger, fontSize = 12.sp, modifier = Modifier.padding(top = 8.dp))
                    }
                    Text("修改后请重新登录", color = TextSub, fontSize = 11.sp, modifier = Modifier.padding(top = 8.dp))
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    vm.saveServer(input) { e ->
                        err = e
                        if (e == null) {
                            showServer = false
                            Toast.makeText(ctx, "已保存", Toast.LENGTH_SHORT).show()
                        }
                    }
                }) { Text("保存", color = Primary) }
            },
            dismissButton = {
                TextButton(onClick = { showServer = false }) { Text("取消", color = TextSub) }
            }
        )
    }
}
