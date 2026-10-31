package com.jaychat.app.ui

import android.widget.Toast
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.jaychat.app.Net
import com.jaychat.app.Sticker
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

private val HotKeywords = listOf("开心", "无语", "打工人", "猫猫", "生气", "加油")

/** 独立表情包页面：浏览、搜索、收藏 */
@Composable
fun StickersScreen(onBack: () -> Unit) {
    StickerPicker(title = "表情包", onBack = onBack, onPick = null)
}

/**
 * 表情选择器。
 * onPick 为空时为「浏览/收藏」模式（点击切换收藏）；不为空时为「发送」模式（点击发送、长按收藏）。
 */
@OptIn(ExperimentalFoundationApi::class)
@Composable
fun StickerPicker(
    title: String,
    onBack: () -> Unit,
    onPick: ((Sticker) -> Unit)? = null,
) {
    val ctx = LocalContext.current
    val scope = rememberCoroutineScope()
    var mode by remember { mutableStateOf(0) }
    var favs by remember { mutableStateOf<List<Sticker>>(emptyList()) }
    var results by remember { mutableStateOf<List<Sticker>>(emptyList()) }
    var query by remember { mutableStateOf("") }
    var page by remember { mutableStateOf(1) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    val favSet = remember(favs) { favs.map { it.url }.toSet() }

    LaunchedEffect(Unit) {
        try {
            favs = withContext(Dispatchers.IO) { Net.api.stickerFavs() }
        } catch (e: Exception) {
            error = e.message ?: "加载失败"
        }
    }

    fun toggleFav(s: Sticker) {
        if (busy) return
        busy = true
        scope.launch {
            try {
                val list = withContext(Dispatchers.IO) {
                    if (favSet.contains(s.url)) Net.api.removeStickerFav(s.url)
                    else Net.api.addStickerFav(s.url, s.label)
                }
                favs = list
            } catch (e: Exception) {
                Toast.makeText(ctx, e.message ?: "操作失败", Toast.LENGTH_SHORT).show()
            } finally {
                busy = false
            }
        }
    }

    fun search(nextPage: Boolean) {
        val kw = query.trim()
        if (kw.isEmpty()) {
            Toast.makeText(ctx, "请输入搜索关键词", Toast.LENGTH_SHORT).show()
            return
        }
        if (loading) return
        val target = if (nextPage) page + 1 else 1
        loading = true
        error = null
        scope.launch {
            try {
                val list = withContext(Dispatchers.IO) { Net.api.searchStickers(kw, target) }
                if (nextPage) {
                    if (list.isEmpty()) {
                        Toast.makeText(ctx, "没有更多表情了", Toast.LENGTH_SHORT).show()
                    } else {
                        results = (results + list).distinctBy { it.url }
                        page = target
                    }
                } else {
                    results = list
                    page = 1
                }
                if (list.isEmpty() && !nextPage) error = "没有找到相关表情，换个关键词试试"
            } catch (e: Exception) {
                error = e.message ?: "搜索失败"
            } finally {
                loading = false
            }
        }
    }

    Column(Modifier.fillMaxSize().background(Bg)) {
        ScreenHeader(title = title, subtitle = if (mode == 0) "${favs.size} 个收藏" else "搜索表情", onBack = onBack)

        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 14.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            ModeChip("我的添加", selected = mode == 0) { mode = 0 }
            Spacer(Modifier.width(8.dp))
            ModeChip("搜索", selected = mode == 1) { mode = 1 }
        }

        if (mode == 1) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    placeholder = { Text("输入关键词，如：开心", color = TextSub, fontSize = 13.sp) },
                    singleLine = true,
                    shape = RoundedCornerShape(12.dp),
                    modifier = Modifier.weight(1f)
                )
                IconButton(onClick = { search(false) }, enabled = !loading) {
                    Icon(Icons.Default.Search, contentDescription = "搜索", tint = TextMain)
                }
            }
            LazyRow(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 14.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(HotKeywords) { kw ->
                    Text(
                        kw,
                        color = TextSub,
                        fontSize = 12.sp,
                        modifier = Modifier
                            .clip(RoundedCornerShape(12.dp))
                            .background(Card2)
                            .clickable { query = kw; search(false) }
                            .padding(horizontal = 10.dp, vertical = 5.dp)
                    )
                }
            }
            Spacer(Modifier.height(4.dp))
        }

        if (loading) {
            Box(Modifier.fillMaxWidth().padding(top = 8.dp), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = Primary, strokeWidth = 2.dp, modifier = Modifier.size(24.dp))
            }
        }

        val list = if (mode == 0) favs else results
        when {
            mode == 0 && list.isEmpty() -> EmptyState("还没有收藏，去搜索页长按表情收藏吧")
            mode == 1 && error != null && list.isEmpty() -> EmptyState(error!!)
            list.isEmpty() -> EmptyState("输入关键词开始搜索")
            else -> LazyVerticalGrid(
                columns = GridCells.Fixed(3),
                modifier = Modifier.weight(1f),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(12.dp)
            ) {
                items(list, key = { it.url }) { s ->
                    StickerCell(
                        s = s,
                        fav = favSet.contains(s.url),
                        onTap = {
                            if (onPick != null) onPick(s) else toggleFav(s)
                        },
                        onLongPress = { toggleFav(s) }
                    )
                }
            }
        }

        if (mode == 1 && list.isNotEmpty()) {
            Row(
                Modifier.fillMaxWidth().padding(vertical = 4.dp),
                horizontalArrangement = Arrangement.Center
            ) {
                TextButton(onClick = { search(true) }, enabled = !loading) {
                    Text("换一批", color = Primary, fontSize = 13.sp)
                }
            }
        }
    }
}

@Composable
private fun ModeChip(text: String, selected: Boolean, onClick: () -> Unit) {
    Text(
        text,
        color = if (selected) Color.White else TextSub,
        fontSize = 13.sp,
        modifier = Modifier
            .clip(RoundedCornerShape(14.dp))
            .background(if (selected) Primary else Card2)
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 6.dp)
    )
}

@OptIn(ExperimentalFoundationApi::class)
@Composable
private fun StickerCell(
    s: Sticker,
    fav: Boolean,
    onTap: () -> Unit,
    onLongPress: () -> Unit,
) {
    Box(
        Modifier
            .padding(4.dp)
            .aspectRatio(1f)
            .clip(RoundedCornerShape(10.dp))
            .background(Card2)
            .combinedClickable(onClick = onTap, onLongClick = onLongPress)
    ) {
        AsyncImage(
            model = s.thumb,
            contentDescription = s.label,
            contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxSize().padding(6.dp)
        )
        if (fav) {
            Box(
                Modifier
                    .align(Alignment.TopEnd)
                    .padding(6.dp)
                    .size(18.dp)
                    .clip(CircleShape)
                    .background(Primary),
                contentAlignment = Alignment.Center
            ) {
                Text("✓", color = Color.White, fontSize = 10.sp)
            }
        }
        if (s.label.isNotBlank()) {
            Text(
                s.label,
                color = TextSub,
                fontSize = 10.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier
                    .align(Alignment.BottomStart)
                    .fillMaxWidth()
                    .background(Color(0xAA000000))
                    .padding(horizontal = 6.dp, vertical = 2.dp)
            )
        }
    }
}
