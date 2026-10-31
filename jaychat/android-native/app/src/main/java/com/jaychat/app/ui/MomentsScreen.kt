package com.jaychat.app.ui

import android.net.Uri
import android.widget.MediaController
import android.widget.Toast
import android.widget.VideoView
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Refresh
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
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import coil.compose.AsyncImage
import com.jaychat.app.MainViewModel
import com.jaychat.app.Moment
import com.jaychat.app.MomentComment
import com.jaychat.app.MomentMedia
import com.jaychat.app.Net
import com.jaychat.app.User
import com.jaychat.app.compressImage
import com.jaychat.app.mediaUrl
import com.jaychat.app.momentVisibilityLabel
import com.jaychat.app.parseMoment
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalFoundationApi::class)
@Composable
fun MomentsTab(vm: MainViewModel) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var moments by remember { mutableStateOf<List<Moment>>(emptyList()) }
    var loading by remember { mutableStateOf(true) }
    var err by remember { mutableStateOf<String?>(null) }
    var composer by remember { mutableStateOf(false) }
    var viewer by remember { mutableStateOf<String?>(null) }
    var video by remember { mutableStateOf<String?>(null) }
    var commentFor by remember { mutableStateOf<Moment?>(null) }
    var editFor by remember { mutableStateOf<Moment?>(null) }
    var deleteFor by remember { mutableStateOf<Moment?>(null) }
    var deleteComment by remember { mutableStateOf<Pair<Long, Long>?>(null) }

    fun apply(updated: Moment) {
        moments = if (moments.any { it.id == updated.id }) {
            moments.map { if (it.id == updated.id) updated else it }
        } else {
            listOf(updated) + moments
        }
    }

    fun load() {
        scope.launch {
            loading = true
            try {
                moments = withContext(Dispatchers.IO) { Net.api.moments("all") }
                err = null
            } catch (e: Exception) {
                err = e.message ?: "加载失败"
            } finally {
                loading = false
            }
        }
    }

    LaunchedEffect(Unit) { load() }

    LaunchedEffect(Unit) {
        vm.eventFlow.collect { (type, data) ->
            when (type) {
                "moment:new", "moment:update" -> {
                    val m = try {
                        parseMoment(data)
                    } catch (e: Exception) {
                        null
                    } ?: return@collect
                    apply(m)
                }

                "moment:delete" -> {
                    val id = data.optLong("id", 0L)
                    moments = moments.filterNot { it.id == id }
                }
            }
        }
    }

    Column(Modifier.fillMaxSize().background(Bg)) {
        ScreenHeader(
            title = "动态",
            subtitle = if (moments.isEmpty()) "暂无动态" else "${moments.size} 条动态"
        ) {
            IconButton(onClick = { load() }) {
                Icon(Icons.Default.Refresh, contentDescription = "刷新", tint = TextSub)
            }
            IconButton(onClick = { composer = true }) {
                Icon(Icons.Default.Add, contentDescription = "发布动态", tint = TextMain)
            }
        }

        when {
            loading && moments.isEmpty() -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Primary, strokeWidth = 2.dp)
            }

            err != null && moments.isEmpty() -> EmptyState(err!!)

            moments.isEmpty() -> EmptyState("还没有动态，发布第一条吧")

            else -> LazyColumn(Modifier.fillMaxSize()) {
                items(moments, key = { it.id }) { m ->
                    MomentCard(
                        m = m,
                        onLike = {
                            scope.launch {
                                try {
                                    val updated = withContext(Dispatchers.IO) { Net.api.likeMoment(m.id) }
                                    apply(updated)
                                } catch (e: Exception) {
                                    Toast.makeText(ctx, e.message ?: "操作失败", Toast.LENGTH_SHORT).show()
                                }
                            }
                        },
                        onComment = { commentFor = m },
                        onEdit = { editFor = m },
                        onDelete = { deleteFor = m },
                        onImage = { viewer = it },
                        onVideo = { video = it },
                        onDeleteComment = { cid -> deleteComment = m.id to cid }
                    )
                    DividerLine()
                }
                item { Spacer(Modifier.height(24.dp)) }
            }
        }
    }

    if (composer) {
        MomentComposer(
            onClose = { composer = false },
            onPublished = {
                apply(it)
                composer = false
            }
        )
    }

    if (viewer != null) {
        ImagePreview(viewer!!) { viewer = null }
    }

    if (video != null) {
        VideoPreview(video!!) { video = null }
    }

    commentFor?.let { m ->
        CommentDialog(m) { updated ->
            apply(updated)
            commentFor = null
        }
    }

    editFor?.let { m ->
        EditMomentDialog(m) { updated ->
            apply(updated)
            editFor = null
        }
    }

    deleteFor?.let { m ->
        AlertDialog(
            onDismissRequest = { deleteFor = null },
            containerColor = Card,
            title = { Text("删除动态", color = TextMain, fontSize = 17.sp) },
            text = { Text("删除后不可恢复，确定删除这条动态？", color = TextSub, fontSize = 14.sp) },
            confirmButton = {
                TextButton(onClick = {
                    deleteFor = null
                    scope.launch {
                        try {
                            withContext(Dispatchers.IO) { Net.api.deleteMoment(m.id) }
                            moments = moments.filterNot { it.id == m.id }
                            Toast.makeText(ctx, "已删除", Toast.LENGTH_SHORT).show()
                        } catch (e: Exception) {
                            Toast.makeText(ctx, e.message ?: "删除失败", Toast.LENGTH_SHORT).show()
                        }
                    }
                }) { Text("删除", color = Danger) }
            },
            dismissButton = {
                TextButton(onClick = { deleteFor = null }) { Text("取消", color = TextSub) }
            }
        )
    }

    deleteComment?.let { (mid, cid) ->
        AlertDialog(
            onDismissRequest = { deleteComment = null },
            containerColor = Card,
            title = { Text("删除评论", color = TextMain, fontSize = 17.sp) },
            text = { Text("确定删除这条评论？", color = TextSub, fontSize = 14.sp) },
            confirmButton = {
                TextButton(onClick = {
                    deleteComment = null
                    scope.launch {
                        try {
                            val updated = withContext(Dispatchers.IO) { Net.api.deleteMomentComment(mid, cid) }
                            apply(updated)
                        } catch (e: Exception) {
                            Toast.makeText(ctx, e.message ?: "删除失败", Toast.LENGTH_SHORT).show()
                        }
                    }
                }) { Text("删除", color = Danger) }
            },
            dismissButton = {
                TextButton(onClick = { deleteComment = null }) { Text("取消", color = TextSub) }
            }
        )
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun MomentCard(
    m: Moment,
    onLike: () -> Unit,
    onComment: () -> Unit,
    onEdit: () -> Unit,
    onDelete: () -> Unit,
    onImage: (String) -> Unit,
    onVideo: (String) -> Unit,
    onDeleteComment: (Long) -> Unit,
) {
    Column(Modifier.fillMaxWidth().background(Card)) {
        Row(Modifier.padding(start = 14.dp, end = 14.dp, top = 14.dp)) {
            Avatar(
                name = m.author?.displayName ?: "",
                avatar = m.author?.avatar ?: "",
                size = 42.dp
            )
            Spacer(Modifier.width(10.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    m.author?.displayName ?: "用户",
                    color = if (m.author?.isOfficial == true) Color(0xFF7FA3FF) else TextMain,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    formatTime(m.createdAt) + if (m.isMine) " · ${momentVisibilityLabel(m.visibility)}" else "",
                    color = TextSub,
                    fontSize = 11.sp
                )
            }
        }

        if (m.text.isNotBlank()) {
            Text(
                m.text,
                color = TextMain,
                fontSize = 15.sp,
                lineHeight = 22.sp,
                modifier = Modifier.padding(horizontal = 14.dp).padding(top = 10.dp)
            )
        }

        if (m.media.isNotEmpty()) {
            Spacer(Modifier.height(8.dp))
            Column(Modifier.padding(horizontal = 12.dp)) {
                m.media.chunked(3).forEach { row ->
                    Row(Modifier.fillMaxWidth()) {
                        row.forEach { item ->
                            Box(
                                Modifier
                                    .weight(1f)
                                    .padding(2.dp)
                                    .aspectRatio(1f)
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(Card2)
                                    .clickable {
                                        if (item.isVideo) onVideo(mediaUrl(item.url))
                                        else onImage(mediaUrl(item.preview))
                                    },
                                contentAlignment = Alignment.Center
                            ) {
                                AsyncImage(
                                    model = mediaUrl(item.preview),
                                    contentDescription = null,
                                    contentScale = ContentScale.Crop,
                                    modifier = Modifier.fillMaxSize()
                                )
                                if (item.isVideo) {
                                    Icon(
                                        Icons.Default.PlayArrow,
                                        contentDescription = null,
                                        tint = Color.White,
                                        modifier = Modifier.size(36.dp)
                                    )
                                }
                            }
                        }
                        repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
            }
        }

        if (m.likes.isNotEmpty() || m.comments.isNotEmpty()) {
            Column(
                Modifier
                    .padding(horizontal = 12.dp)
                    .padding(top = 10.dp)
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(8.dp))
                    .background(Card2)
                    .padding(horizontal = 10.dp, vertical = 8.dp)
            ) {
                if (m.likes.isNotEmpty()) {
                    Text(
                        "赞：" + m.likes.joinToString("、") { it.user?.displayName ?: "用户" },
                        color = Color(0xFF7FA3FF),
                        fontSize = 12.sp
                    )
                }
                m.comments.forEach { c ->
                    CommentRow(
                        c = c,
                        canDelete = c.isMine || m.isMine,
                        onDelete = { onDeleteComment(c.id) }
                    )
                }
            }
        }

        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                if (m.liked) "已赞" else "赞",
                color = if (m.liked) Primary else TextSub,
                fontSize = 13.sp,
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .clickable(onClick = onLike)
                    .padding(horizontal = 10.dp, vertical = 5.dp)
            )
            Text(
                if (m.comments.isEmpty()) "评论" else "评论 ${m.comments.size}",
                color = TextSub,
                fontSize = 13.sp,
                modifier = Modifier
                    .clip(RoundedCornerShape(6.dp))
                    .clickable(onClick = onComment)
                    .padding(horizontal = 10.dp, vertical = 5.dp)
            )
            Spacer(Modifier.weight(1f))
            if (m.isMine) {
                Text(
                    "编辑",
                    color = TextSub,
                    fontSize = 13.sp,
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .clickable(onClick = onEdit)
                        .padding(horizontal = 10.dp, vertical = 5.dp)
                )
                Text(
                    "删除",
                    color = Danger,
                    fontSize = 13.sp,
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .clickable(onClick = onDelete)
                        .padding(horizontal = 10.dp, vertical = 5.dp)
                )
            }
        }
    }
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun CommentRow(c: MomentComment, canDelete: Boolean, onDelete: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(top = 5.dp)
            .combinedClickable(onClick = {}, onLongClick = { if (canDelete) onDelete() })
    ) {
        Text(
            text = (c.user?.displayName ?: "用户") + if (c.msgType != "text" && c.content.isBlank()) "：[动画表情]" else "：${c.content}",
            color = TextMain,
            fontSize = 13.sp,
            lineHeight = 19.sp,
            modifier = Modifier.weight(1f)
        )
    }
}

/* ---------------------------- 发布动态 ---------------------------- */

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun MomentComposer(
    onClose: () -> Unit,
    onPublished: (Moment) -> Unit,
) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var text by remember { mutableStateOf("") }
    var uris by remember { mutableStateOf<List<Uri>>(emptyList()) }
    var visibility by remember { mutableStateOf("public") }
    var publishing by remember { mutableStateOf(false) }

    val picker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickMultipleVisualMedia(9)
    ) { picked ->
        if (picked.isNotEmpty()) {
            uris = (uris + picked).distinct().take(9)
        }
    }

    Dialog(
        onDismissRequest = { if (!publishing) onClose() },
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Column(
            Modifier
                .fillMaxSize()
                .background(Bg)
                .statusBarsPadding()
                .imePadding()
        ) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .height(58.dp)
                    .padding(horizontal = 8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                TextButton(onClick = { if (!publishing) onClose() }) {
                    Text("取消", color = TextSub, fontSize = 15.sp)
                }
                Text(
                    "发布动态",
                    color = TextMain,
                    fontSize = 17.sp,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center
                )
                Text(
                    if (publishing) "发布中…" else "发布",
                    color = if (publishing) TextSub else Primary,
                    fontSize = 15.sp,
                    fontWeight = FontWeight.Medium,
                    modifier = Modifier
                        .clip(RoundedCornerShape(8.dp))
                        .clickable(enabled = !publishing) {
                            val content = text.trim()
                            if (content.isEmpty() && uris.isEmpty()) {
                                Toast.makeText(ctx, "请输入内容或选择图片", Toast.LENGTH_SHORT).show()
                                return@clickable
                            }
                            publishing = true
                            scope.launch {
                                try {
                                    val media = withContext(Dispatchers.IO) {
                                        val list = ArrayList<MomentMedia>()
                                        uris.forEachIndexed { i, uri ->
                                            val bytes = compressImage(ctx, uri)
                                            if (bytes != null) {
                                                val res = Net.api.uploadBytes(
                                                    bytes,
                                                    "moment_${System.currentTimeMillis()}_$i.jpg",
                                                    "image/jpeg"
                                                )
                                                val url = res.optString("url", "")
                                                if (url.isNotBlank()) {
                                                    list.add(MomentMedia(url, "image", ""))
                                                }
                                            }
                                        }
                                        list
                                    }
                                    val m = withContext(Dispatchers.IO) {
                                        Net.api.createMoment(content, media, visibility)
                                    }
                                    Toast.makeText(ctx, "发布成功", Toast.LENGTH_SHORT).show()
                                    onPublished(m)
                                } catch (e: Exception) {
                                    Toast.makeText(ctx, "发布失败", Toast.LENGTH_SHORT).show()
                                } finally {
                                    publishing = false
                                }
                            }
                        }
                        .padding(horizontal = 12.dp, vertical = 8.dp)
                )
            }
            DividerLine()

            OutlinedTextField(
                value = text,
                onValueChange = { text = it },
                placeholder = { Text("这一刻的想法…", color = TextSub, fontSize = 14.sp) },
                minLines = 4,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp, vertical = 12.dp)
            )

            val tiles: List<Uri?> = uris + if (uris.size < 9) listOf(null) else emptyList()
            Column(Modifier.padding(horizontal = 14.dp)) {
                tiles.chunked(3).forEach { row ->
                    Row(Modifier.fillMaxWidth()) {
                        row.forEach { uri ->
                            if (uri == null) {
                                Box(
                                    Modifier
                                        .weight(1f)
                                        .padding(2.dp)
                                        .aspectRatio(1f)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(Card2)
                                        .clickable {
                                            picker.launch(
                                                PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                                            )
                                        },
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        Icons.Default.Add,
                                        contentDescription = "添加图片",
                                        tint = TextSub,
                                        modifier = Modifier.size(30.dp)
                                    )
                                }
                            } else {
                                Box(
                                    Modifier
                                        .weight(1f)
                                        .padding(2.dp)
                                        .aspectRatio(1f)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(Card2)
                                ) {
                                    AsyncImage(
                                        model = uri,
                                        contentDescription = null,
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier.fillMaxSize()
                                    )
                                    Box(
                                        Modifier
                                            .align(Alignment.TopEnd)
                                            .padding(4.dp)
                                            .size(22.dp)
                                            .clip(CircleShape)
                                            .background(Color(0x99000000)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            "×",
                                            color = Color.White,
                                            fontSize = 14.sp,
                                            modifier = Modifier.clickable {
                                                uris = uris.filterNot { it == uri }
                                            }
                                        )
                                    }
                                }
                            }
                        }
                        repeat(3 - row.size) { Spacer(Modifier.weight(1f)) }
                    }
                }
                Text(
                    "${uris.size}/9 张图片",
                    color = TextSub,
                    fontSize = 11.sp,
                    modifier = Modifier.padding(top = 6.dp)
                )
            }

            Spacer(Modifier.height(16.dp))
            Row(Modifier.padding(horizontal = 14.dp), verticalAlignment = Alignment.CenterVertically) {
                Text("谁可以看", color = TextSub, fontSize = 13.sp)
                Spacer(Modifier.width(12.dp))
                listOf("public" to "公开", "friends" to "好友", "private" to "仅自己").forEach { (key, label) ->
                    Text(
                        label,
                        color = if (visibility == key) Color.White else TextSub,
                        fontSize = 13.sp,
                        modifier = Modifier
                            .padding(end = 8.dp)
                            .clip(RoundedCornerShape(14.dp))
                            .background(if (visibility == key) Primary else Card2)
                            .clickable { visibility = key }
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    )
                }
            }
            Spacer(Modifier.weight(1f))
            Spacer(Modifier.navigationBarsPadding())
        }
    }
}

/* ---------------------------- 评论 ---------------------------- */

@Composable
private fun CommentDialog(moment: Moment, onDone: (Moment) -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var input by remember { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = { onDone(moment) },
        containerColor = Card,
        title = { Text("评论", color = TextMain, fontSize = 17.sp) },
        text = {
            Column {
                OutlinedTextField(
                    value = input,
                    onValueChange = { input = it },
                    placeholder = { Text("说点什么…", color = TextSub, fontSize = 13.sp) },
                    maxLines = 4,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            TextButton(
                enabled = input.trim().isNotEmpty() && !sending,
                onClick = {
                    val content = input.trim()
                    if (content.isEmpty()) return@TextButton
                    sending = true
                    scope.launch {
                        try {
                            val updated = withContext(Dispatchers.IO) {
                                Net.api.commentMoment(moment.id, content)
                            }
                            Toast.makeText(ctx, "发送成功", Toast.LENGTH_SHORT).show()
                            onDone(updated)
                        } catch (e: Exception) {
                            Toast.makeText(ctx, "发送失败", Toast.LENGTH_SHORT).show()
                            sending = false
                        }
                    }
                }
            ) { Text(if (sending) "发送中…" else "发送", color = if (input.trim().isEmpty()) TextSub else Primary) }
        },
        dismissButton = {
            TextButton(onClick = { onDone(moment) }) { Text("取消", color = TextSub) }
        }
    )
}

@Composable
private fun EditMomentDialog(moment: Moment, onDone: (Moment) -> Unit) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var input by remember { mutableStateOf(moment.text) }
    var saving by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = { onDone(moment) },
        containerColor = Card,
        title = { Text("编辑动态", color = TextMain, fontSize = 17.sp) },
        text = {
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                placeholder = { Text("这一刻的想法…", color = TextSub, fontSize = 13.sp) },
                maxLines = 8,
                modifier = Modifier.fillMaxWidth()
            )
        },
        confirmButton = {
            TextButton(
                enabled = !saving,
                onClick = {
                    saving = true
                    scope.launch {
                        try {
                            val updated = withContext(Dispatchers.IO) {
                                Net.api.updateMomentText(moment.id, input.trim())
                            }
                            Toast.makeText(ctx, "已保存", Toast.LENGTH_SHORT).show()
                            onDone(updated)
                        } catch (e: Exception) {
                            Toast.makeText(ctx, e.message ?: "保存失败", Toast.LENGTH_SHORT).show()
                            saving = false
                        }
                    }
                }
            ) { Text("保存", color = Primary) }
        },
        dismissButton = {
            TextButton(onClick = { onDone(moment) }) { Text("取消", color = TextSub) }
        }
    )
}

/* ---------------------------- 媒体预览 ---------------------------- */

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun ImagePreview(url: String, onClose: () -> Unit) {
    Dialog(
        onDismissRequest = onClose,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(
            Modifier
                .fillMaxSize()
                .background(Color.Black)
                .combinedClickable(onClick = onClose, onLongClick = {})
        ) {
            AsyncImage(
                model = url,
                contentDescription = null,
                contentScale = ContentScale.Fit,
                modifier = Modifier.fillMaxSize()
            )
        }
    }
}

@Composable
private fun VideoPreview(url: String, onClose: () -> Unit) {
    Dialog(
        onDismissRequest = onClose,
        properties = DialogProperties(usePlatformDefaultWidth = false)
    ) {
        Box(Modifier.fillMaxSize().background(Color.Black)) {
            AndroidView(
                factory = { c ->
                    VideoView(c).apply {
                        setVideoPath(url)
                        val mc = MediaController(c)
                        mc.setAnchorView(this)
                        setMediaController(mc)
                        setOnPreparedListener { mp ->
                            mp.isLooping = false
                            start()
                        }
                        setOnErrorListener { _, _, _ ->
                            Toast.makeText(c, "该视频无法播放（编码不被设备支持）", Toast.LENGTH_LONG).show()
                            true
                        }
                    }
                },
                modifier = Modifier.fillMaxSize(),
                onRelease = { it.stopPlayback() }
            )
            Text(
                "关闭",
                color = Color.White,
                fontSize = 15.sp,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .padding(20.dp)
                    .clip(RoundedCornerShape(20.dp))
                    .background(Color(0x66000000))
                    .clickable { onClose() }
                    .padding(horizontal = 16.dp, vertical = 8.dp)
            )
        }
    }
}
