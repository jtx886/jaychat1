package com.jaychat.app.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.jaychat.app.Conversation
import com.jaychat.app.Message
import com.jaychat.app.Net
import com.jaychat.app.User
import com.jaychat.app.compressImage
import com.jaychat.app.isVideoUri
import com.jaychat.app.mediaUrl
import com.jaychat.app.openStream
import com.jaychat.app.queryDisplayName
import com.jaychat.app.querySize
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalFoundationApi::class, ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(conv: Conversation, me: User, vm: com.jaychat.app.MainViewModel, onBack: () -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    val messages = remember(conv.key) { mutableStateListOf<Message>() }
    val listState = rememberLazyListState()
    var loading by remember { mutableStateOf(true) }
    var fatal by remember { mutableStateOf<String?>(null) }
    var input by remember { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    var uploading by remember { mutableStateOf(false) }
    var sheetOpen by remember { mutableStateOf(false) }
    var actionMsg by remember { mutableStateOf<Message?>(null) }
    var viewerUrl by remember { mutableStateOf<String?>(null) }
    var myRole by remember { mutableStateOf("member") }

    suspend fun pull(markRead: Boolean): List<Message> = withContext(Dispatchers.IO) {
        Net.api.messages(conv.type, conv.id, limit = 80, markRead = markRead)
    }

    fun merge(incoming: List<Message>) {
        if (incoming.isEmpty() && messages.isNotEmpty()) return
        val map = LinkedHashMap<Long, Message>()
        messages.forEach { map[it.id] = it }
        incoming.forEach { map[it.id] = it }
        val merged = map.values.sortedBy { it.id }
        if (merged.size == messages.size && merged.indices.all { merged[it] == messages[it] }) return
        messages.clear()
        messages.addAll(merged)
    }

    LaunchedEffect(conv.key) {
        if (conv.isGroup) {
            myRole = withContext(Dispatchers.IO) { Net.api.myGroupRole(conv.id.toIntOrNull() ?: 0) }
        }
        // 首次进入：拉取历史并标记已读
        try {
            merge(pull(true))
            fatal = null
        } catch (e: Exception) {
            fatal = e.message ?: "加载失败"
        }
        loading = false

        // 低频兜底刷新（事件丢失时补齐）；共享主机上避免高频翻历史
        launch {
            while (true) {
                delay(60000)
                try {
                    merge(pull(true))
                } catch (e: Exception) {
                }
            }
        }

        // 实时事件：新消息 / 撤回
        vm.eventFlow.collect { (type, data) ->
            when (type) {
                "message" -> {
                    if (data.optString("conv_type") == conv.type && data.optString("conv_id") == conv.id) {
                        val m = com.jaychat.app.parseMessage(data)
                        if (messages.none { it.id == m.id }) {
                            messages.add(m)
                            if (m.senderId != me.id) {
                                launch(Dispatchers.IO) { runCatching { Net.api.markRead(m.id) } }
                            }
                        }
                    }
                }

                "message:recall" -> {
                    if (data.optString("convType") == conv.type && data.optString("convId") == conv.id) {
                        val id = data.optLong("id", 0L)
                        val idx = messages.indexOfFirst { it.id == id }
                        if (idx >= 0) {
                            messages[idx] = messages[idx].copy(recalled = true, content = "", mediaUrl = "")
                        }
                    }
                }
            }
        }
    }

    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) listState.scrollToItem(messages.size - 1)
    }

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.PickVisualMedia()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            uploading = true
            try {
                val video = isVideoUri(ctx, uri)
                val name = queryDisplayName(ctx, uri, if (video) "video.mp4" else "image.jpg")
                val res = withContext(Dispatchers.IO) {
                    if (video) {
                        val size = querySize(ctx, uri)
                        val stream = openStream(ctx, uri) ?: throw IllegalStateException("无法读取视频")
                        Net.api.uploadStream(stream, size, name)
                    } else {
                        val bytes = compressImage(ctx, uri) ?: throw IllegalStateException("无法读取图片")
                        Net.api.uploadBytes(bytes, name, "image/jpeg")
                    }
                }
                val url = res.optString("url", "")
                if (url.isBlank()) throw IllegalStateException("上传失败")
                val kind = if (video) "video" else "image"
                val m = withContext(Dispatchers.IO) {
                    Net.api.sendMessage(conv.type, conv.id, kind, "", url)
                }
                messages.add(m)
            } catch (e: Exception) {
                Toast.makeText(ctx, e.message ?: "上传失败", Toast.LENGTH_SHORT).show()
            } finally {
                uploading = false
            }
        }
    }

    fun sendText() {
        val text = input.trim()
        if (text.isEmpty() || sending || uploading) return
        sending = true
        scope.launch {
            try {
                val m = withContext(Dispatchers.IO) {
                    Net.api.sendMessage(conv.type, conv.id, "text", text)
                }
                messages.add(m)
                input = ""
            } catch (e: Exception) {
                Toast.makeText(ctx, e.message ?: "发送失败", Toast.LENGTH_SHORT).show()
            } finally {
                sending = false
            }
        }
    }

    val subtitle = if (conv.isGroup) {
        buildString {
            append("${conv.memberCount} 人")
            if (myRole == "owner") append(" · 群主")
            else if (myRole == "admin") append(" · 管理员")
        }
    } else if (conv.online) "在线" else "离线"

    Column(Modifier.fillMaxSize().background(Bg).imePadding()) {
        ScreenHeader(title = conv.name, subtitle = subtitle, onBack = onBack) {
            if (conv.dissolved) {
                Text("已解散", color = TextSub, fontSize = 12.sp, modifier = Modifier.padding(end = 12.dp))
            }
        }

        if (uploading) {
            LinearProgressIndicator(modifier = Modifier.fillMaxWidth().height(2.dp), color = Primary)
        }

        Box(Modifier.weight(1f).fillMaxWidth()) {
            when {
                loading && messages.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(color = Primary, strokeWidth = 2.dp)
                }
                fatal != null && messages.isEmpty() -> EmptyState(fatal!!)
                messages.isEmpty() -> EmptyState("还没有消息，打个招呼吧")
                else -> LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 12.dp, vertical = 12.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    itemsIndexed(messages, key = { _, m -> m.id }) { index, m ->
                        val prev = messages.getOrNull(index - 1)
                        val showTime = prev == null || m.createdAt - prev.createdAt > 5 * 60 * 1000L
                        val showName = conv.isGroup && (prev == null || prev.senderId != m.senderId)
                        MessageRow(
                            m = m,
                            mine = m.senderId == me.id,
                            showName = showName,
                            meName = me.username,
                            meAvatar = me.avatar,
                            showTime = showTime,
                            onLongPress = {
                                actionMsg = m
                                sheetOpen = true
                            },
                            onImage = { viewerUrl = it }
                        )
                    }
                }
            }
        }

        Row(
            Modifier
                .fillMaxWidth()
                .background(Card)
                .navigationBarsPadding()
                .padding(horizontal = 8.dp, vertical = 8.dp),
            verticalAlignment = Alignment.Bottom
        ) {
            IconButton(
                onClick = {
                    picker.launch(
                        PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageAndVideo)
                    )
                },
                enabled = !uploading && !sending
            ) {
                Icon(Icons.Default.Add, contentDescription = "发送图片/视频", tint = TextSub)
            }
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                placeholder = { Text("发消息…", color = TextSub, fontSize = 14.sp) },
                maxLines = 4,
                shape = RoundedCornerShape(20.dp),
                modifier = Modifier.weight(1f)
            )
            Spacer(Modifier.width(6.dp))
            IconButton(
                onClick = { sendText() },
                enabled = input.trim().isNotEmpty() && !sending && !uploading
            ) {
                Icon(
                    Icons.Default.Send,
                    contentDescription = "发送",
                    tint = if (input.trim().isNotEmpty()) Primary else TextSub
                )
            }
        }
    }

    if (sheetOpen && actionMsg != null) {
        val m = actionMsg!!
        val canRecall = !m.recalled && (m.senderId == me.id || (conv.isGroup && myRole == "owner"))
        ModalBottomSheet(
            onDismissRequest = { sheetOpen = false },
            containerColor = Card
        ) {
            HandleBar()
            MenuRow("复制") {
                sheetOpen = false
                val text = when (m.type) {
                    "text", "sticker" -> m.content
                    "image" -> "[图片]"
                    "video" -> "[视频]"
                    else -> m.content
                }
                val cm = ctx.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                cm.setPrimaryClip(ClipData.newPlainText("消息", text))
                Toast.makeText(ctx, "已复制", Toast.LENGTH_SHORT).show()
            }
            if (canRecall) {
                MenuRow("撤回") {
                    sheetOpen = false
                    scope.launch {
                        try {
                            withContext(Dispatchers.IO) { Net.api.recall(m.id) }
                            val idx = messages.indexOfFirst { it.id == m.id }
                            if (idx >= 0) messages[idx] = messages[idx].copy(recalled = true, content = "")
                        } catch (e: Exception) {
                            Toast.makeText(ctx, e.message ?: "撤回失败", Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            }
            MenuRow("删除", danger = true) {
                sheetOpen = false
                scope.launch {
                    try {
                        withContext(Dispatchers.IO) { Net.api.hideMessage(m.id) }
                        messages.removeAll { it.id == m.id }
                    } catch (e: Exception) {
                        Toast.makeText(ctx, e.message ?: "删除失败", Toast.LENGTH_SHORT).show()
                    }
                }
            }
            Spacer(Modifier.height(24.dp))
        }
    }

    if (viewerUrl != null) {
        Dialog(
            onDismissRequest = { viewerUrl = null },
            properties = DialogProperties(usePlatformDefaultWidth = false)
        ) {
            Box(
                Modifier
                    .fillMaxSize()
                    .background(Color.Black)
                    .combinedClickable(onClick = { viewerUrl = null }, onLongClick = {}),
                contentAlignment = Alignment.Center
            ) {
                AsyncImage(
                    model = viewerUrl,
                    contentDescription = null,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxSize()
                )
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun MessageRow(
    m: Message,
    mine: Boolean,
    showName: Boolean,
    showTime: Boolean,
    meName: String,
    meAvatar: String,
    onLongPress: () -> Unit,
    onImage: (String) -> Unit,
) {
    val ctx = LocalContext.current
    Column(Modifier.fillMaxWidth()) {
        if (showTime) {
            Text(
                formatTime(m.createdAt),
                color = TextSub,
                fontSize = 10.sp,
                modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
        }
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = if (mine) Arrangement.End else Arrangement.Start,
            verticalAlignment = Alignment.Top
        ) {
            if (!mine) {
                Avatar(name = m.senderName, avatar = m.senderAvatar, size = 36.dp)
                Spacer(Modifier.width(8.dp))
            }
            Column(horizontalAlignment = if (mine) Alignment.End else Alignment.Start) {
                if (showName && !mine) {
                    Text(
                        m.senderName,
                        color = TextSub,
                        fontSize = 11.sp,
                        modifier = Modifier.padding(start = 4.dp, bottom = 3.dp)
                    )
                }
                if (m.recalled) {
                    Text(
                        if (mine) "你撤回了一条消息" else "对方撤回了一条消息",
                        color = TextSub,
                        fontSize = 12.sp,
                        fontStyle = FontStyle.Italic,
                        modifier = Modifier.padding(6.dp)
                    )
                } else {
                    val bubbleColor = if (mine) BubbleMine else BubbleOther
                    Box(
                        Modifier
                            .widthIn(max = 250.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(bubbleColor)
                            .combinedClickable(onClick = {}, onLongClick = onLongPress)
                            .padding(horizontal = if (m.type == "image" || m.type == "video") 3.dp else 11.dp,
                                vertical = if (m.type == "image" || m.type == "video") 3.dp else 8.dp)
                    ) {
                        when (m.type) {
                            "image" -> AsyncImage(
                                model = mediaUrl(m.mediaUrl),
                                contentDescription = null,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier
                                    .widthIn(max = 240.dp, min = 120.dp)
                                    .height(180.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .combinedClickable(
                                        onClick = { onImage(mediaUrl(m.mediaUrl)) },
                                        onLongClick = onLongPress
                                    )
                            )
                            "video" -> Box(
                                Modifier
                                    .size(220.dp, 140.dp)
                                    .clip(RoundedCornerShape(12.dp))
                                    .background(Color.Black)
                                    .combinedClickable(
                                        onClick = {
                                            try {
                                                ctx.startActivity(
                                                    Intent(Intent.ACTION_VIEW, Uri.parse(mediaUrl(m.mediaUrl)))
                                                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                                                )
                                            } catch (e: Exception) {
                                                Toast.makeText(ctx, "没有可播放视频的应用", Toast.LENGTH_SHORT).show()
                                            }
                                        },
                                        onLongClick = onLongPress
                                    ),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    Icons.Default.PlayArrow,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(44.dp)
                                )
                            }
                            "forward" -> Text("[聊天记录]", color = TextMain, fontSize = 15.sp)
                            else -> Text(
                                m.content,
                                color = Color.White,
                                fontSize = 15.sp,
                                maxLines = 60,
                                overflow = TextOverflow.Visible
                            )
                        }
                    }
                }
            }
            if (mine) {
                Spacer(Modifier.width(8.dp))
                Avatar(name = meName, avatar = meAvatar, size = 36.dp)
            }
        }
    }
}
