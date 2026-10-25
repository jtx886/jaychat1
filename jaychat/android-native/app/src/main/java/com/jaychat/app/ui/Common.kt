package com.jaychat.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.jaychat.app.avatarUrl
import com.jaychat.app.presetIndexOf
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import kotlin.math.abs

private val Gradients = listOf(
    Color(0xFF5B9DFF) to Color(0xFF3B6DFF),
    Color(0xFF7A5CFF) to Color(0xFF5236E8),
    Color(0xFFFF7A8A) to Color(0xFFE8435F),
    Color(0xFF2FD07B) to Color(0xFF12A05C),
    Color(0xFFFFB020) to Color(0xFFF08A00),
    Color(0xFF3AD0E0) to Color(0xFF1A9DBF),
    Color(0xFFFF8FD0) to Color(0xFFE0559F),
    Color(0xFF8F9BFF) to Color(0xFF5F6AE0),
)

@Composable
fun Avatar(
    name: String,
    avatar: String,
    size: Dp = 46.dp,
    online: Boolean? = null,
) {
    val idx = if (avatar.startsWith("preset:")) presetIndexOf(avatar) else abs(name.hashCode()) % Gradients.size
    val g = Gradients[((idx % Gradients.size) + Gradients.size) % Gradients.size]
    Box(Modifier.size(size)) {
        Box(
            Modifier
                .fillMaxSize()
                .clip(CircleShape)
                .background(Brush.linearGradient(listOf(g.first, g.second))),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = name.trim().take(1).ifBlank { "J" },
                color = Color.White,
                fontSize = (size.value * 0.42f).sp,
                fontWeight = FontWeight.SemiBold
            )
        }
        val url = avatarUrl(avatar)
        if (url.isNotBlank()) {
            AsyncImage(
                model = url,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize().clip(CircleShape)
            )
        }
        if (online != null) {
            Box(
                Modifier
                    .align(Alignment.BottomEnd)
                    .size(size * 0.3f)
                    .clip(CircleShape)
                    .background(if (online) Green else Color(0xFF465270))
                    .border(2.dp, Bg, CircleShape)
            )
        }
    }
}

@Composable
fun ScreenHeader(
    title: String,
    subtitle: String? = null,
    onBack: (() -> Unit)? = null,
    actions: @Composable RowScope.() -> Unit = {},
) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(Card)
            .statusBarsPadding()
            .height(58.dp)
            .padding(horizontal = 6.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (onBack != null) {
            IconButton(onClick = onBack) {
                Icon(Icons.Default.ArrowBack, contentDescription = "返回", tint = TextMain)
            }
        }
        Column(Modifier.weight(1f).padding(start = if (onBack == null) 14.dp else 0.dp)) {
            Text(
                title,
                color = TextMain,
                fontSize = 17.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            if (!subtitle.isNullOrBlank()) {
                Text(subtitle, color = TextSub, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        actions()
    }
}

@Composable
fun EmptyState(text: String, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        Text(text, color = TextSub, fontSize = 14.sp)
    }
}

@Composable
fun SectionHeader(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        color = TextSub,
        fontSize = 12.sp,
        modifier = modifier.padding(start = 16.dp, top = 14.dp, bottom = 6.dp)
    )
}

@Composable
fun HandleBar() {
    Box(
        Modifier
            .fillMaxWidth()
            .padding(top = 10.dp, bottom = 6.dp),
        contentAlignment = Alignment.Center
    ) {
        Box(
            Modifier
                .size(38.dp, 4.dp)
                .clip(CircleShape)
                .background(Color(0xFF33405F))
        )
    }
}

fun formatTime(ms: Long): String {
    if (ms <= 0L) return ""
    val now = System.currentTimeMillis()
    val diff = now - ms
    if (diff < 60_000L) return "刚刚"
    if (diff < 3_600_000L) return "${diff / 60_000L}分钟前"

    val c = Calendar.getInstance().apply { timeInMillis = ms }
    val today = Calendar.getInstance()
    if (c.get(Calendar.YEAR) == today.get(Calendar.YEAR) && c.get(Calendar.DAY_OF_YEAR) == today.get(Calendar.DAY_OF_YEAR)) {
        return SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(ms))
    }
    val y = Calendar.getInstance()
    y.add(Calendar.DAY_OF_YEAR, -1)
    if (c.get(Calendar.YEAR) == y.get(Calendar.YEAR) && c.get(Calendar.DAY_OF_YEAR) == y.get(Calendar.DAY_OF_YEAR)) {
        return "昨天"
    }
    return SimpleDateFormat("MM-dd", Locale.getDefault()).format(Date(ms))
}

fun formatClock(ms: Long): String = SimpleDateFormat("HH:mm", Locale.getDefault()).format(Date(ms))

@Composable
fun DividerLine(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth().height(1.dp).background(Line))
}

@Composable
fun MenuRow(label: String, danger: Boolean = false, onClick: () -> Unit) {
    Row(
        Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 20.dp, vertical = 16.dp),
        horizontalArrangement = Arrangement.Start
    ) {
        Text(label, color = if (danger) Danger else TextMain, fontSize = 15.sp)
    }
}
