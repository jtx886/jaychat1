package com.jaychat.app

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class MainViewModel(app: Application) : AndroidViewModel(app) {

    var me by mutableStateOf<User?>(null)
        private set
    var ready by mutableStateOf(false)
        private set
    var conversations by mutableStateOf<List<Conversation>>(emptyList())
        private set
    var friends by mutableStateOf<List<User>>(emptyList())
        private set
    var groups by mutableStateOf<List<Group>>(emptyList())
        private set
    var busy by mutableStateOf(false)
        private set
    var serverBase by mutableStateOf(Store.base)
        private set

    /** 实时事件流：聊天页直接消费，避免高频拉取整段消息历史 */
    val eventFlow = MutableSharedFlow<Pair<String, JSONObject>>(extraBufferCapacity = 128)

    private var pollJob: Job? = null
    private var tickJob: Job? = null
    private var since = 0L

    init {
        viewModelScope.launch {
            if (Store.token.isNotEmpty()) {
                try {
                    me = withContext(Dispatchers.IO) { Net.api.me() }
                } catch (e: ApiException) {
                    if (e.status == 401) {
                        Store.clearLogin()
                    } else {
                        me = cachedUser()
                    }
                } catch (e: Exception) {
                    me = cachedUser()
                }
            }
            ready = true
            if (me != null) {
                refreshAll()
                startRealtime()
            }
        }
    }

    private fun cachedUser(): User? = try {
        val raw = Store.userJson
        if (raw.isBlank()) null else parseUser(JSONObject(raw))
    } catch (e: Exception) {
        null
    }

    fun refreshAll() {
        viewModelScope.launch {
            try {
                val convs = withContext(Dispatchers.IO) { Net.api.conversations() }
                conversations = convs
            } catch (e: Exception) {
                // 网络异常时保留旧数据
            }
            try {
                val f = withContext(Dispatchers.IO) { Net.api.friends() }
                friends = f
            } catch (e: Exception) {
            }
            try {
                val g = withContext(Dispatchers.IO) { Net.api.groups() }
                groups = g
            } catch (e: Exception) {
            }
        }
    }

    fun refreshConversations() {
        viewModelScope.launch {
            try {
                conversations = withContext(Dispatchers.IO) { Net.api.conversations() }
            } catch (e: Exception) {
            }
        }
    }

    fun login(account: String, password: String, onDone: (String?) -> Unit) {
        if (busy) return
        busy = true
        viewModelScope.launch {
            try {
                val u = withContext(Dispatchers.IO) { Net.api.login(account.trim(), password) }
                me = u
                busy = false
                refreshAll()
                startRealtime()
                onDone(null)
            } catch (e: Exception) {
                busy = false
                onDone(e.message ?: "登录失败")
            }
        }
    }

    fun register(email: String, code: String, username: String, password: String, onDone: (String?) -> Unit) {
        if (busy) return
        busy = true
        viewModelScope.launch {
            try {
                val u = withContext(Dispatchers.IO) { Net.api.register(email.trim(), code.trim(), username.trim(), password) }
                me = u
                busy = false
                refreshAll()
                startRealtime()
                onDone(null)
            } catch (e: Exception) {
                busy = false
                onDone(e.message ?: "注册失败")
            }
        }
    }

    fun sendCode(email: String, onDone: (String?, String?) -> Unit) {
        viewModelScope.launch {
            try {
                val hint = withContext(Dispatchers.IO) { Net.api.sendCode(email.trim()) }
                onDone(hint, null)
            } catch (e: Exception) {
                onDone(null, e.message ?: "发送失败")
            }
        }
    }

    fun saveServer(url: String, onDone: (String?) -> Unit) {
        val v = url.trim().trimEnd('/')
        if (v.isNotEmpty() && !v.startsWith("https://") && !v.startsWith("http://")) {
            onDone("地址需以 http:// 或 https:// 开头")
            return
        }
        Store.base = v.ifBlank { Store.DEFAULT_BASE }
        serverBase = Store.base
        onDone(null)
    }

    fun logout() {
        stopRealtime()
        viewModelScope.launch {
            if (Store.token.isNotEmpty()) {
                withContext(Dispatchers.IO) { Net.api.logout() }
            }
            Store.clearLogin()
            me = null
            conversations = emptyList()
            friends = emptyList()
            groups = emptyList()
            since = 0L
        }
    }

    private fun startRealtime() {
        stopRealtime()
        since = 0L
        pollJob = viewModelScope.launch {
            while (isActive) {
                try {
                    val r = withContext(Dispatchers.IO) { Net.api.poll(since, 8) }
                    since = r.cursor
                    if (r.events.isNotEmpty()) {
                        r.events.forEach { e -> eventFlow.tryEmit(e.type to e.data) }
                        refreshConversations()
                    }
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    delay(3000)
                }
            }
        }
        // 兜底刷新：事件偶发丢失时也能同步（最低频，减少共享主机请求量）
        tickJob = viewModelScope.launch {
            while (isActive) {
                delay(60000)
                refreshAll()
            }
        }
    }

    private fun stopRealtime() {
        pollJob?.cancel()
        pollJob = null
        tickJob?.cancel()
        tickJob = null
    }

    override fun onCleared() {
        super.onCleared()
        stopRealtime()
    }
}
