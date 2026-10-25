package com.jaychat.app.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Bg = Color(0xFF070B18)
val Card = Color(0xFF0F1628)
val Card2 = Color(0xFF151D33)
val Primary = Color(0xFF3B6DFF)
val TextMain = Color(0xFFE8EEFF)
val TextSub = Color(0xFF8A9ABE)
val Line = Color(0xFF1E2942)
val Danger = Color(0xFFFF5D6C)
val Green = Color(0xFF2FD07B)
val BubbleMine = Color(0xFF2F5BFF)
val BubbleOther = Color(0xFF182038)

@Composable
fun JayChatTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Primary,
            onPrimary = Color.White,
            background = Bg,
            onBackground = TextMain,
            surface = Card,
            onSurface = TextMain,
            surfaceVariant = Card2,
            onSurfaceVariant = TextSub,
            error = Danger,
            outline = Line,
        ),
        content = content
    )
}
