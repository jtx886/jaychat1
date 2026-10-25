package com.jaychat.app

import okhttp3.Cookie
import okhttp3.CookieJar
import okhttp3.HttpUrl
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import org.json.JSONObject
import java.io.IOException
import java.io.InputStream
import java.net.URLEncoder
import java.util.concurrent.TimeUnit
import javax.crypto.Cipher
import javax.crypto.spec.IvParameterSpec
import javax.crypto.spec.SecretKeySpec
import kotlin.math.min

class ApiException(val status: Int, override val message: String) : IOException(message)

private val JSON = "application/json; charset=utf-8".toMediaType()
private val OCTET = "application/octet-stream".toMediaType()

private const val UA =
    "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) " +
        "Chrome/120.0.0.0 Mobile Safari/537.36"

/**
 * 共享主机（InfinityFree）会在纯 HTTP 客户端上返回一段 JS 人机验证页：
 *   var a=toNumbers(".."),b=toNumbers(".."),c=toNumbers("..");
 *   document.cookie="__test="+toHex(slowAES.decrypt(c,2,a,b))+...
 * 这里用同样的算法（AES-128-CBC、无 padding）算出 __test 并写入 Cookie 后重放请求。
 */
class PersistentCookieJar : CookieJar {
    private val map = LinkedHashMap<String, String>()

    init {
        Store.cookies.split(';').forEach { part ->
            val i = part.indexOf('=')
            if (i > 0) {
                val k = part.substring(0, i).trim()
                val v = part.substring(i + 1).trim()
                if (k.isNotEmpty() && v.isNotEmpty()) map[k] = v
            }
        }
    }

    override fun loadForRequest(url: HttpUrl): List<Cookie> =
        map.map { (k, v) ->
            Cookie.Builder().domain(url.host).path("/").name(k).value(v).build()
        }

    override fun saveFromResponse(url: HttpUrl, cookies: List<Cookie>) {
        if (cookies.isEmpty()) return
        cookies.forEach { map[it.name] = it.value }
        Store.cookies = map.entries.joinToString(";") { "${it.key}=${it.value}" }
    }

    fun put(url: HttpUrl, name: String, value: String) {
        saveFromResponse(url, listOf(Cookie.Builder().domain(url.host).path("/").name(name).value(value).build()))
    }
}

class ChallengeInterceptor(private val jar: PersistentCookieJar) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        var request = chain.request()
        var response = chain.proceed(request)
        var attempt = 0
        while (attempt < 2) {
            val type = response.body?.contentType()?.toString() ?: ""
            if (!type.contains("text/html")) break
            val html = try {
                response.peekBody(400_000).string()
            } catch (e: Exception) {
                ""
            }
            if (!html.contains("toNumbers(")) break
            response.close()
            if (!solve(html, request.url)) break
            request = request.newBuilder().build()
            response = chain.proceed(request)
            attempt++
        }
        return response
    }

    private fun solve(html: String, url: HttpUrl): Boolean {
        val nums = Regex("toNumbers\\(\"([0-9a-fA-F]+)\"\\)")
            .findAll(html).map { it.groupValues[1] }.toList()
        if (nums.size < 3) return false
        return try {
            val cipher = Cipher.getInstance("AES/CBC/NoPadding")
            cipher.init(
                Cipher.DECRYPT_MODE,
                SecretKeySpec(hexToBytes(nums[0]), "AES"),
                IvParameterSpec(hexToBytes(nums[1]))
            )
            val out = cipher.doFinal(hexToBytes(nums[2]))
            val token = out.joinToString("") { "%02x".format(it) }
            jar.put(url, "__test", token)
            true
        } catch (e: Exception) {
            false
        }
    }

    private fun hexToBytes(s: String): ByteArray =
        ByteArray(s.length / 2) {
            ((Character.digit(s[it * 2], 16) shl 4) or Character.digit(s[it * 2 + 1], 16)).toByte()
        }
}

class Api {
    private val cookieJar = PersistentCookieJar()

    val client: OkHttpClient = OkHttpClient.Builder()
        .cookieJar(cookieJar)
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(45, TimeUnit.SECONDS)
        .writeTimeout(120, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .addInterceptor(ChallengeInterceptor(cookieJar))
        .build()

    private fun parseBody(text: String): JSONObject? = try {
        JSONObject(text)
    } catch (e: Exception) {
        null
    }

    private fun exec(
        path: String,
        method: String = "GET",
        json: JSONObject? = null,
        body: RequestBody? = null,
        headers: Map<String, String> = emptyMap(),
    ): JSONObject {
        val url = Store.base.trimEnd('/') + path
        val builder = Request.Builder()
            .url(url)
            .header("Accept", "application/json, text/plain, */*")
            .header("Accept-Language", "zh-CN,zh;q=0.9")
            .header("User-Agent", UA)

        val tk = Store.token
        if (tk.isNotEmpty()) builder.header("Authorization", "Bearer $tk")
        headers.forEach { (k, v) -> builder.header(k, v) }

        if (method == "GET") {
            builder.get()
        } else {
            val rb = body ?: (json ?: JSONObject()).toString().toRequestBody(JSON)
            builder.method(method, rb)
        }

        client.newCall(builder.build()).execute().use { res ->
            val text = res.body?.string() ?: ""
            val obj = parseBody(text)
            if (!res.isSuccessful) {
                val msg = obj?.optString("error")?.takeIf { it.isNotBlank() }
                    ?: if (text.startsWith("<")) "服务器验证失败，请检查网络或服务器地址"
                    else "请求失败（HTTP ${res.code}）"
                throw ApiException(res.code, msg)
            }
            return obj ?: throw ApiException(res.code, "服务器返回异常（可能触发了主机人机验证）")
        }
    }

    private fun q(v: String): String = URLEncoder.encode(v, "UTF-8")

    /* ------------------------------ 账号 ------------------------------ */

    fun login(account: String, password: String): User {
        val o = exec(
            "/api/auth/login", "POST",
            JSONObject().put("account", account).put("password", password)
        )
        val token = o.optString("token", "")
        val uj = o.optJSONObject("user")
        if (token.isBlank() || uj == null) throw ApiException(500, "登录失败")
        Store.token = token
        Store.userJson = uj.toString()
        return parseUser(uj) ?: throw ApiException(500, "登录失败")
    }

    fun register(email: String, code: String, username: String, password: String): User {
        val o = exec(
            "/api/auth/register", "POST",
            JSONObject()
                .put("email", email)
                .put("code", code)
                .put("username", username)
                .put("password", password)
        )
        val token = o.optString("token", "")
        val uj = o.optJSONObject("user")
        if (token.isBlank() || uj == null) throw ApiException(500, "注册失败")
        Store.token = token
        Store.userJson = uj.toString()
        return parseUser(uj) ?: throw ApiException(500, "注册失败")
    }

    /** 发送邮箱验证码，返回给用户看的提示 */
    fun sendCode(email: String, purpose: String = "register"): String {
        val o = exec(
            "/api/auth/send-code", "POST",
            JSONObject().put("email", email).put("purpose", purpose)
        )
        return o.optString("hint", "验证码已发送")
    }

    fun me(): User {
        val o = exec("/api/auth/me")
        val uj = o.optJSONObject("user") ?: throw ApiException(401, "登录已失效")
        val t = o.optString("token", "")
        if (t.isNotBlank()) Store.token = t
        Store.userJson = uj.toString()
        return parseUser(uj) ?: throw ApiException(401, "登录已失效")
    }

    fun logout() {
        try {
            exec("/api/auth/logout", "POST", JSONObject())
        } catch (e: Exception) {
            // 本地退出即可，忽略网络异常
        }
    }

    /* ------------------------------ 会话 ------------------------------ */

    fun conversations(): List<Conversation> {
        val o = exec("/api/conversations")
        val arr = o.optJSONArray("conversations") ?: return emptyList()
        return arr.toList().map { parseConversation(it) }
    }

    fun messages(
        convType: String,
        convId: String,
        limit: Int = 80,
        before: Long = 0L,
        markRead: Boolean = true,
    ): List<Message> {
        var path = "/api/messages?convType=$convType&convId=${q(convId)}&limit=$limit&markRead=$markRead"
        if (before > 0) path += "&before=$before"
        val o = exec(path)
        val arr = o.optJSONArray("messages") ?: return emptyList()
        return arr.toList().map { parseMessage(it) }
    }

    fun sendMessage(
        convType: String,
        convId: String,
        msgType: String,
        content: String,
        mediaUrl: String = "",
    ): Message {
        val body = JSONObject()
            .put("convType", convType)
            .put("convId", convId)
            .put("msg_type", msgType)
            .put("content", content)
        if (mediaUrl.isNotBlank()) body.put("media_url", mediaUrl)
        val o = exec("/api/messages", "POST", body)
        val m = o.optJSONObject("message") ?: throw ApiException(500, "发送失败")
        return parseMessage(m)
    }

    fun recall(messageId: Long) {
        exec("/api/messages/$messageId/recall", "POST", JSONObject())
    }

    fun hideMessage(messageId: Long) {
        exec(
            "/api/messages/hide", "POST",
            JSONObject().put("ids", org.json.JSONArray().put(messageId))
        )
    }

    /* ------------------------------ 通讯录 ------------------------------ */

    fun friends(): List<User> {
        val o = exec("/api/friends")
        val arr = o.optJSONArray("friends") ?: return emptyList()
        return arr.toList().mapNotNull { parseUser(it) }
    }

    fun groups(): List<Group> {
        val o = exec("/api/groups")
        val arr = o.optJSONArray("groups") ?: return emptyList()
        return arr.toList().map { parseGroup(it) }
    }

    fun myGroupRole(groupId: Int): String {
        return try {
            val o = exec("/api/groups/$groupId")
            o.optString("my_role", "member")
        } catch (e: Exception) {
            "member"
        }
    }

    fun searchUsers(keyword: String): List<FriendResult> {
        val o = exec("/api/users/search?q=${q(keyword)}")
        val arr = o.optJSONArray("users") ?: return emptyList()
        return arr.toList().mapNotNull { item ->
            val u = parseUser(item) ?: return@mapNotNull null
            val req = item.optJSONObject("request")
            FriendResult(
                user = u,
                isFriend = item.optBoolean("is_friend", false),
                pendingDirection = req?.optString("direction")?.takeIf { it.isNotBlank() },
            )
        }
    }

    fun requestFriend(toUserId: Int, message: String = ""): String {
        val body = JSONObject().put("toUserId", toUserId)
        if (message.isNotBlank()) body.put("message", message)
        exec("/api/friends/request", "POST", body)
        return "好友申请已发送"
    }

    /* ------------------------------ 实时 ------------------------------ */

    data class PollEvent(val type: String, val data: JSONObject)
    data class PollResult(val cursor: Long, val events: List<PollEvent>)

    fun poll(since: Long, waitSeconds: Int = 8): PollResult {
        val path = if (since <= 0) "/api/poll"
        else "/api/poll?since=$since&wait=$waitSeconds"
        val o = exec(path)
        val arr = o.optJSONArray("events")
        val list = ArrayList<PollEvent>()
        if (arr != null) {
            for (i in 0 until arr.length()) {
                val e = arr.optJSONObject(i) ?: continue
                list.add(PollEvent(e.optString("type", ""), e.optJSONObject("data") ?: JSONObject()))
            }
        }
        return PollResult(o.optLong("cursor", since), list)
    }

    fun markRead(messageId: Long) {
        exec("/api/messages/$messageId/read", "POST", JSONObject())
    }

    /* ------------------------------ 上传 ------------------------------ */

    fun uploadBytes(bytes: ByteArray, name: String, mime: String): JSONObject {
        if (bytes.size <= 1_200_000) {
            val body = MultipartBody.Builder().setType(MultipartBody.FORM)
                .addFormDataPart("file", name, bytes.toRequestBody(mime.toMediaTypeOrNull()))
                .build()
            return exec("/api/upload", "POST", body = body)
        }
        return uploadChunks(bytes, name)
    }

    private fun uploadChunks(bytes: ByteArray, name: String): JSONObject {
        val chunkSize = 900 * 1024
        val total = (bytes.size + chunkSize - 1) / chunkSize
        if (total > 400) throw ApiException(400, "文件过大（最多约 360MB）")
        val uploadId = randomHex(24)
        val encName = q(name)
        for (i in 0 until total) {
            val start = i * chunkSize
            val end = min(bytes.size, start + chunkSize)
            val part = bytes.copyOfRange(start, end)
            val o = exec(
                "/api/upload/chunk", "POST",
                body = part.toRequestBody(OCTET),
                headers = mapOf(
                    "X-Upload-Id" to uploadId,
                    "X-Chunk-Index" to i.toString(),
                    "X-Chunk-Total" to total.toString(),
                    "X-File-Name" to encName,
                )
            )
            if (o.has("url")) return o
        }
        throw ApiException(500, "上传失败")
    }

    /** 视频等大文件：边读边传，避免整个文件读进内存 */
    fun uploadStream(input: InputStream, size: Long, name: String): JSONObject {
        if (size in 1..1_200_000L) {
            val bytes = input.use { it.readBytes() }
            return uploadBytes(bytes, name, "application/octet-stream")
        }
        val chunkSize = 900 * 1024
        val total = if (size > 0) ((size + chunkSize - 1) / chunkSize).toInt() else 0
        if (total <= 0 || total > 400) throw ApiException(400, "文件过大或无法读取")
        val uploadId = randomHex(24)
        val encName = q(name)
        input.use { stream ->
            val buf = ByteArray(chunkSize)
            for (i in 0 until total) {
                var read = 0
                while (read < chunkSize) {
                    val n = stream.read(buf, read, chunkSize - read)
                    if (n <= 0) break
                    read += n
                }
                if (read <= 0) break
                val part = buf.copyOf(read)
                val o = exec(
                    "/api/upload/chunk", "POST",
                    body = part.toRequestBody(OCTET),
                    headers = mapOf(
                        "X-Upload-Id" to uploadId,
                        "X-Chunk-Index" to i.toString(),
                        "X-Chunk-Total" to total.toString(),
                        "X-File-Name" to encName,
                    )
                )
                if (o.has("url")) return o
            }
        }
        throw ApiException(500, "上传失败")
    }
}

private fun randomHex(len: Int): String {
    val chars = "0123456789abcdef"
    val sb = StringBuilder(len)
    repeat(len) { sb.append(chars[(Math.random() * 16).toInt()]) }
    return sb.toString()
}

/** 全局单例：UI 与图片加载共用同一个带验证 Cookie 的客户端 */
object Net {
    val api: Api by lazy { Api() }
}
