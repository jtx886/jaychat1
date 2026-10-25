package com.jaychat.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.jaychat.app.ui.AuthScreen
import com.jaychat.app.ui.Bg
import com.jaychat.app.ui.ChatScreen
import com.jaychat.app.ui.JayChatTheme
import com.jaychat.app.ui.MainScreen
import com.jaychat.app.ui.Primary

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            JayChatTheme {
                AppRoot()
            }
        }
    }
}

@Composable
private fun AppRoot() {
    val vm: MainViewModel = viewModel()
    var chat by remember { mutableStateOf<Conversation?>(null) }

    when {
        !vm.ready -> Box(
            Modifier.fillMaxSize().background(Bg),
            contentAlignment = Alignment.Center
        ) {
            CircularProgressIndicator(color = Primary, strokeWidth = 2.dp)
        }

        vm.me == null -> AuthScreen(vm)

        else -> {
            val current = chat
            if (current != null) {
                BackHandler {
                    chat = null
                    vm.refreshConversations()
                }
                ChatScreen(
                    conv = current,
                    me = vm.me!!,
                    vm = vm,
                    onBack = {
                        chat = null
                        vm.refreshConversations()
                    }
                )
            } else {
                MainScreen(vm = vm, onOpenChat = { chat = it })
            }
        }
    }
}
