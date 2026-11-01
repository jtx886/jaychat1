package com.jaychat.app;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.IOException;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import javax.crypto.Cipher;
import javax.crypto.spec.IvParameterSpec;
import javax.crypto.spec.SecretKeySpec;

import okhttp3.Call;
import okhttp3.Cookie;
import okhttp3.CookieJar;
import okhttp3.HttpUrl;
import okhttp3.MediaType;
import okhttp3.MultipartBody;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

/** 服务端接口（纯 Java，OkHttp + org.json） */
public final class Api {

    public static class ApiException extends IOException {
        public final int status;

        public ApiException(int status, String message) {
            super(message);
            this.status = status;
        }
    }

    private static final MediaType JSON_TYPE = MediaType.parse("application/json; charset=utf-8");
    private static final MediaType OCTET = MediaType.parse("application/octet-stream");
    private static final String UA =
            "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) " +
                    "Chrome/120.0.0.0 Mobile Safari/537.36";

    private static Api instance;

    public static synchronized Api api() {
        if (instance == null) instance = new Api();
        return instance;
    }

    private final PersistentCookieJar cookieJar = new PersistentCookieJar();

    public final OkHttpClient client = new OkHttpClient.Builder()
            .cookieJar(cookieJar)
            .protocols(java.util.Collections.singletonList(okhttp3.Protocol.HTTP_1_1))
            .connectTimeout(25, TimeUnit.SECONDS)
            .readTimeout(45, TimeUnit.SECONDS)
            .writeTimeout(120, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .build();

    private Api() {
    }

    /* ------------------------------ Cookie ------------------------------ */

    public static final class PersistentCookieJar implements CookieJar {
        private final Map<String, String> map = new LinkedHashMap<>();

        public PersistentCookieJar() {
            String raw = Store.cookies();
            if (raw == null || raw.isEmpty()) return;
            for (String part : raw.split(";")) {
                int i = part.indexOf('=');
                if (i > 0) {
                    String k = part.substring(0, i).trim();
                    String v = part.substring(i + 1).trim();
                    if (!k.isEmpty() && !v.isEmpty()) map.put(k, v);
                }
            }
        }

        @Override
        public List<Cookie> loadForRequest(HttpUrl url) {
            List<Cookie> list = new ArrayList<>();
            for (Map.Entry<String, String> e : map.entrySet()) {
                list.add(new Cookie.Builder().domain(url.host()).path("/")
                        .name(e.getKey()).value(e.getValue()).build());
            }
            return list;
        }

        @Override
        public void saveFromResponse(HttpUrl url, List<Cookie> cookies) {
            if (cookies.isEmpty()) return;
            for (Cookie c : cookies) map.put(c.name(), c.value());
            StringBuilder sb = new StringBuilder();
            for (Map.Entry<String, String> e : map.entrySet()) {
                if (sb.length() > 0) sb.append(';');
                sb.append(e.getKey()).append('=').append(e.getValue());
            }
            Store.setCookies(sb.toString());
        }

        void put(HttpUrl url, String name, String value) {
            map.put(name, value);
            StringBuilder sb = new StringBuilder();
            for (Map.Entry<String, String> e : map.entrySet()) {
                if (sb.length() > 0) sb.append(';');
                sb.append(e.getKey()).append('=').append(e.getValue());
            }
            Store.setCookies(sb.toString());
        }
    }

    /* ------------------------------ 请求核心 ------------------------------ */

    private JSONObject parseBody(String text) {
        try {
            return new JSONObject(text);
        } catch (Exception e) {
            return null;
        }
    }

    private boolean solveChallenge(String html, HttpUrl url) {
        Matcher m = Pattern.compile("toNumbers\\(\"([0-9a-fA-F]+)\"\\)").matcher(html);
        List<String> nums = new ArrayList<>();
        while (m.find()) nums.add(m.group(1));
        if (nums.size() < 3) return false;
        try {
            Cipher cipher = Cipher.getInstance("AES/CBC/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE,
                    new SecretKeySpec(hexToBytes(nums.get(0)), "AES"),
                    new IvParameterSpec(hexToBytes(nums.get(1))));
            byte[] out = cipher.doFinal(hexToBytes(nums.get(2)));
            StringBuilder sb = new StringBuilder();
            for (byte b : out) sb.append(String.format("%02x", b));
            cookieJar.put(url, "__test", sb.toString());
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static byte[] hexToBytes(String s) {
        byte[] b = new byte[s.length() / 2];
        for (int i = 0; i < b.length; i++) {
            b[i] = (byte) ((Character.digit(s.charAt(i * 2), 16) << 4)
                    | Character.digit(s.charAt(i * 2 + 1), 16));
        }
        return b;
    }

    /**
     * 共享主机会对人机验证做 IP + Cookie 绑定。浏览器是先打开网页拿到 __test 再发接口，
     * 这里在首次请求前也先访问一次站点首页，避免首个 POST 直接撞上验证页。
     */
    private void primeChallenge() {
        if (Store.cookies().contains("__test=")) return;
        try {
            String base = Store.base();
            HttpUrl u = HttpUrl.parse(base.endsWith("/") ? base : base + "/");
            if (u == null) return;
            Request req = new Request.Builder()
                    .url(u)
                    .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
                    .header("Accept-Language", "zh-CN,zh;q=0.9")
                    .header("User-Agent", UA)
                    .get()
                    .build();
            Response res = client.newCall(req).execute();
            try {
                String type = res.body() != null && res.body().contentType() != null
                        ? res.body().contentType().toString() : "";
                if (type.contains("text/html") && res.body() != null) {
                    String html = res.peekBody(400_000).string();
                    if (html.contains("toNumbers(")) solveChallenge(html, u);
                }
            } finally {
                res.close();
            }
            client.connectionPool().evictAll();
        } catch (Exception ignored) {
        }
    }

    private JSONObject exec(String path, String method, JSONObject json,
                            RequestBody body, Map<String, String> headers) throws IOException {
        String base = Store.base();
        if (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        primeChallenge();
        Request.Builder builder = new Request.Builder()
                .url(base + path)
                .header("Accept", "application/json, text/plain, */*")
                .header("Accept-Language", "zh-CN,zh;q=0.9")
                .header("Referer", base + "/")
                .header("Sec-Fetch-Site", "same-origin")
                .header("Sec-Fetch-Mode", "cors")
                .header("Sec-Fetch-Dest", "empty")
                .header("User-Agent", UA);
        if (!"GET".equals(method) && !"HEAD".equals(method)) builder.header("Origin", base);
        String tk = Store.token();
        if (tk != null && !tk.isEmpty()) builder.header("Authorization", "Bearer " + tk);
        if (headers != null) {
            for (Map.Entry<String, String> e : headers.entrySet()) builder.header(e.getKey(), e.getValue());
        }
        if ("GET".equals(method) || "HEAD".equals(method)) {
            builder.get();
        } else {
            RequestBody rb = body;
            if (rb == null) {
                rb = RequestBody.create((json == null ? new JSONObject() : json).toString(), JSON_TYPE);
            }
            builder.method(method, rb);
        }

        // 共享主机可能在任何请求上返回人机验证页：解出 __test 后按浏览器方式带 ?i=1 重发。
        for (int attempt = 0; attempt < 6; attempt++) {
            Call call = client.newCall(builder.build());
            Response res = call.execute();
            HttpUrl reqUrl = res.request().url();
            String type = res.body() != null && res.body().contentType() != null
                    ? res.body().contentType().toString() : "";
            if (type.contains("text/html")) {
                String html;
                try {
                    html = res.peekBody(400_000).string();
                } catch (Exception e) {
                    html = "";
                }
                if (html.contains("toNumbers(") && solveChallenge(html, reqUrl)) {
                    res.close();
                    client.connectionPool().evictAll();
                    String s = reqUrl.toString();
                    HttpUrl next = HttpUrl.parse(s + (s.contains("?") ? "&i=1" : "?i=1"));
                    if (next != null) builder.url(next);
                    continue;
                }
            }
            try {
                String text = res.body() != null ? res.body().string() : "";
                JSONObject obj = parseBody(text);
                if (!res.isSuccessful()) {
                    String msg = obj != null ? obj.optString("error", "") : "";
                    if (msg.isEmpty()) {
                        if (text.trim().startsWith("<")) {
                            msg = "服务器验证失败，请检查网络或服务器地址（HTTP " + res.code() + "）";
                        } else {
                            String snip = text.trim().replaceAll("\\s+", " ");
                            if (snip.length() > 60) snip = snip.substring(0, 60);
                            msg = "请求失败（HTTP " + res.code() + "）" + (snip.isEmpty() ? "" : "：" + snip);
                        }
                    }
                    throw new ApiException(res.code(), msg);
                }
                if (obj == null) throw new ApiException(res.code(), "服务器返回异常（可能触发了主机人机验证）");
                return obj;
            } finally {
                res.close();
            }
        }
        throw new ApiException(500, "服务器验证失败，请稍后重试");
    }

    private JSONObject get(String path) throws IOException {
        return exec(path, "GET", null, null, null);
    }

    private JSONObject post(String path, JSONObject json) throws IOException {
        return exec(path, "POST", json, null, null);
    }

    private static String q(String v) {
        try {
            return URLEncoder.encode(v == null ? "" : v, "UTF-8");
        } catch (Exception e) {
            return "";
        }
    }

    /* ------------------------------ 账号 ------------------------------ */

    public Models.User login(String account, String password) throws IOException, JSONException {
        JSONObject body = new JSONObject();
        body.put("account", account);
        body.put("password", password);
        JSONObject o = post("/api/auth/login", body);
        String token = o.optString("token", "");
        JSONObject uj = o.optJSONObject("user");
        if (token.isEmpty() || uj == null) throw new ApiException(500, "登录失败");
        Store.setToken(token);
        Store.setUserJson(uj.toString());
        Models.User u = Models.parseUser(uj);
        if (u == null) throw new ApiException(500, "登录失败");
        return u;
    }

    public Models.User register(String email, String code, String username, String password)
            throws IOException, JSONException {
        JSONObject body = new JSONObject();
        body.put("email", email);
        body.put("code", code);
        body.put("username", username);
        body.put("password", password);
        JSONObject o = post("/api/auth/register", body);
        String token = o.optString("token", "");
        JSONObject uj = o.optJSONObject("user");
        if (token.isEmpty() || uj == null) throw new ApiException(500, "注册失败");
        Store.setToken(token);
        Store.setUserJson(uj.toString());
        Models.User u = Models.parseUser(uj);
        if (u == null) throw new ApiException(500, "注册失败");
        return u;
    }

    public String sendCode(String email) throws IOException, JSONException {
        JSONObject body = new JSONObject();
        body.put("email", email);
        body.put("purpose", "register");
        JSONObject o = post("/api/auth/send-code", body);
        return o.optString("hint", "验证码已发送");
    }

    public JSONObject health() throws IOException {
        return get("/api/health");
    }

    public Models.User me() throws IOException {
        JSONObject o = get("/api/auth/me");
        JSONObject uj = o.optJSONObject("user");
        if (uj == null) throw new ApiException(401, "登录已失效");
        String t = o.optString("token", "");
        if (!t.isEmpty()) Store.setToken(t);
        Store.setUserJson(uj.toString());
        Models.User u = Models.parseUser(uj);
        if (u == null) throw new ApiException(401, "登录已失效");
        return u;
    }

    public void logout() {
        try {
            post("/api/auth/logout", new JSONObject());
        } catch (Exception ignored) {
        }
    }

    /* ------------------------------ 会话 ------------------------------ */

    public List<Models.Conversation> conversations() throws IOException {
        List<Models.Conversation> out = new ArrayList<>();
        for (JSONObject it : Models.toList(get("/api/conversations").optJSONArray("conversations"))) {
            out.add(Models.parseConversation(it));
        }
        return out;
    }

    public List<Models.Message> messages(String convType, String convId, int limit,
                                         long before, boolean markRead) throws IOException {
        String path = "/api/messages?convType=" + convType + "&convId=" + q(convId)
                + "&limit=" + limit + "&markRead=" + markRead;
        if (before > 0) path += "&before=" + before;
        List<Models.Message> out = new ArrayList<>();
        for (JSONObject it : Models.toList(get(path).optJSONArray("messages"))) {
            out.add(Models.parseMessage(it));
        }
        return out;
    }

    public Models.Message sendMessage(String convType, String convId, String msgType,
                                      String content, String mediaUrl) throws IOException, JSONException {
        JSONObject body = new JSONObject();
        body.put("convType", convType);
        body.put("convId", convId);
        body.put("msg_type", msgType);
        body.put("content", content);
        if (mediaUrl != null && !mediaUrl.isEmpty()) body.put("media_url", mediaUrl);
        JSONObject o = post("/api/messages", body);
        JSONObject m = o.optJSONObject("message");
        if (m == null) throw new ApiException(500, "发送失败");
        return Models.parseMessage(m);
    }

    public void recall(long messageId) throws IOException {
        post("/api/messages/" + messageId + "/recall", new JSONObject());
    }

    public void hideMessage(long messageId) throws IOException, JSONException {
        JSONArray ids = new JSONArray();
        ids.put(messageId);
        JSONObject body = new JSONObject();
        body.put("ids", ids);
        post("/api/messages/hide", body);
    }

    public void markRead(long messageId) throws IOException {
        post("/api/messages/" + messageId + "/read", new JSONObject());
    }

    /* ------------------------------ 通讯录 ------------------------------ */

    public List<Models.User> friends() throws IOException {
        List<Models.User> out = new ArrayList<>();
        for (JSONObject it : Models.toList(get("/api/friends").optJSONArray("friends"))) {
            Models.User u = Models.parseUser(it);
            if (u != null) out.add(u);
        }
        return out;
    }

    public List<Models.Group> groups() throws IOException {
        List<Models.Group> out = new ArrayList<>();
        for (JSONObject it : Models.toList(get("/api/groups").optJSONArray("groups"))) {
            out.add(Models.parseGroup(it));
        }
        return out;
    }

    public List<Models.FriendResult> searchUsers(String keyword) throws IOException {
        List<Models.FriendResult> out = new ArrayList<>();
        for (JSONObject it : Models.toList(get("/api/users/search?q=" + q(keyword)).optJSONArray("users"))) {
            Models.User u = Models.parseUser(it);
            if (u == null) continue;
            Models.FriendResult r = new Models.FriendResult();
            r.user = u;
            r.isFriend = it.optBoolean("is_friend", false);
            JSONObject req = it.optJSONObject("request");
            if (req != null) {
                String dir = req.optString("direction", "");
                r.pendingDirection = dir.isEmpty() ? null : dir;
            }
            out.add(r);
        }
        return out;
    }

    public void requestFriend(int toUserId, String message) throws IOException, JSONException {
        JSONObject body = new JSONObject();
        body.put("toUserId", toUserId);
        if (message != null && !message.trim().isEmpty()) body.put("message", message);
        post("/api/friends/request", body);
    }

    /* ------------------------------ 动态 ------------------------------ */

    public List<Models.Moment> moments(String scope) throws IOException {
        List<Models.Moment> out = new ArrayList<>();
        for (JSONObject it : Models.toList(get("/api/moments?scope=" + scope).optJSONArray("moments"))) {
            out.add(Models.parseMoment(it));
        }
        return out;
    }

    public List<Models.Moment> myMoments() throws IOException {
        List<Models.Moment> out = new ArrayList<>();
        for (JSONObject it : Models.toList(get("/api/moments/mine").optJSONArray("moments"))) {
            out.add(Models.parseMoment(it));
        }
        return out;
    }

    public Models.Moment createMoment(String text, List<Models.MomentMedia> media, String visibility)
            throws IOException, JSONException {
        return createMoment(text, media, visibility, null, null);
    }

    public Models.Moment createMoment(String text, List<Models.MomentMedia> media, String visibility,
                                      List<Integer> allowIds, List<Integer> denyIds)
            throws IOException, JSONException {
        JSONArray arr = new JSONArray();
        for (Models.MomentMedia mm : media) {
            JSONObject o = new JSONObject();
            o.put("url", mm.url);
            o.put("type", mm.type);
            o.put("thumb", mm.thumb);
            arr.put(o);
        }
        JSONObject body = new JSONObject();
        body.put("text", text);
        body.put("media", arr);
        body.put("visibility", visibility);
        if (allowIds != null && !allowIds.isEmpty()) {
            JSONArray allow = new JSONArray();
            for (Integer id : allowIds) allow.put(id);
            body.put("allowIds", allow);
        }
        if (denyIds != null && !denyIds.isEmpty()) {
            JSONArray deny = new JSONArray();
            for (Integer id : denyIds) deny.put(id);
            body.put("denyIds", deny);
        }
        JSONObject o = post("/api/moments", body);
        JSONObject m = o.optJSONObject("moment");
        if (m == null) throw new ApiException(500, "发布失败");
        return Models.parseMoment(m);
    }

    public Models.Moment updateMomentText(long id, String content) throws IOException, JSONException {
        JSONObject body = new JSONObject();
        body.put("content", content);
        JSONObject o = exec("/api/moments/" + id, "PATCH", body, null, null);
        JSONObject m = o.optJSONObject("moment");
        if (m == null) throw new ApiException(500, "保存失败");
        return Models.parseMoment(m);
    }

    public Models.Moment updateMomentVisibility(long id, String visibility,
                                               List<Integer> allowIds, List<Integer> denyIds)
            throws IOException, JSONException {
        JSONObject body = new JSONObject();
        body.put("visibility", visibility);
        JSONArray allow = new JSONArray();
        for (Integer i : allowIds) allow.put(i);
        JSONArray deny = new JSONArray();
        for (Integer i : denyIds) deny.put(i);
        body.put("allowIds", allow);
        body.put("denyIds", deny);
        JSONObject o = exec("/api/moments/" + id, "PATCH", body, null, null);
        JSONObject m = o.optJSONObject("moment");
        if (m == null) throw new ApiException(500, "保存失败");
        return Models.parseMoment(m);
    }

    public void deleteMoment(long id) throws IOException {
        exec("/api/moments/" + id, "DELETE", new JSONObject(), null, null);
    }

    public Models.Moment likeMoment(long id) throws IOException {
        JSONObject o = post("/api/moments/" + id + "/like", new JSONObject());
        JSONObject m = o.optJSONObject("moment");
        if (m == null) throw new ApiException(500, "操作失败");
        return Models.parseMoment(m);
    }

    public Models.Moment commentMoment(long id, String content) throws IOException, JSONException {
        JSONObject body = new JSONObject();
        body.put("content", content);
        body.put("msg_type", "text");
        JSONObject o = post("/api/moments/" + id + "/comments", body);
        JSONObject m = o.optJSONObject("moment");
        if (m == null) throw new ApiException(500, "评论失败");
        return Models.parseMoment(m);
    }

    public Models.Moment deleteMomentComment(long momentId, long commentId) throws IOException {
        JSONObject o = exec("/api/moments/" + momentId + "/comments/" + commentId, "DELETE",
                new JSONObject(), null, null);
        JSONObject m = o.optJSONObject("moment");
        if (m == null) throw new ApiException(500, "删除失败");
        return Models.parseMoment(m);
    }

    /* ------------------------------ 表情包 ------------------------------ */

    public List<Models.Sticker> searchStickers(String keyword, int page) throws IOException {
        List<Models.Sticker> out = new ArrayList<>();
        for (JSONObject it : Models.toList(get("/api/stickers/search?q=" + q(keyword) + "&page=" + page)
                .optJSONArray("items"))) {
            out.add(Models.parseSticker(it));
        }
        return out;
    }

    public List<Models.Sticker> stickerFavs() throws IOException {
        List<Models.Sticker> out = new ArrayList<>();
        for (JSONObject it : Models.toList(get("/api/stickers/favs").optJSONArray("items"))) {
            out.add(Models.parseSticker(it));
        }
        return out;
    }

    public List<Models.Sticker> addStickerFav(String url, String label) throws IOException, JSONException {
        JSONObject body = new JSONObject();
        body.put("url", url);
        body.put("label", label);
        List<Models.Sticker> out = new ArrayList<>();
        for (JSONObject it : Models.toList(post("/api/stickers/favs", body).optJSONArray("items"))) {
            out.add(Models.parseSticker(it));
        }
        return out;
    }

    public List<Models.Sticker> removeStickerFav(String url) throws IOException, JSONException {
        JSONObject body = new JSONObject();
        body.put("url", url);
        List<Models.Sticker> out = new ArrayList<>();
        for (JSONObject it : Models.toList(post("/api/stickers/favs/remove", body).optJSONArray("items"))) {
            out.add(Models.parseSticker(it));
        }
        return out;
    }

    /* ------------------------------ 后台管理 ------------------------------ */

    public Models.AdminOverview adminOverview() throws IOException {
        return Models.parseAdminOverview(get("/api/admin/overview"));
    }

    public List<Models.AdminUser> adminUsers(String keyword) throws IOException {
        String path = keyword == null || keyword.trim().isEmpty()
                ? "/api/admin/users" : "/api/admin/users?q=" + q(keyword);
        List<Models.AdminUser> out = new ArrayList<>();
        for (JSONObject it : Models.toList(get(path).optJSONArray("users"))) {
            out.add(Models.parseAdminUser(it));
        }
        return out;
    }

    public Models.AdminUser adminBanUser(int userId, int days) throws IOException, JSONException {
        JSONObject body = new JSONObject();
        body.put("days", days);
        return adminUserOp("/api/admin/users/" + userId + "/ban", body);
    }

    public Models.AdminUser adminUnbanUser(int userId) throws IOException {
        return adminUserOp("/api/admin/users/" + userId + "/unban", new JSONObject());
    }

    public Models.AdminUser adminMuteUser(int userId, int minutes) throws IOException, JSONException {
        JSONObject body = new JSONObject();
        body.put("minutes", minutes);
        return adminUserOp("/api/admin/users/" + userId + "/mute", body);
    }

    public Models.AdminUser adminUnmuteUser(int userId) throws IOException {
        return adminUserOp("/api/admin/users/" + userId + "/unmute", new JSONObject());
    }

    private Models.AdminUser adminUserOp(String path, JSONObject body) throws IOException {
        JSONObject o = post(path, body);
        JSONObject u = o.optJSONObject("user");
        if (u == null) throw new ApiException(500, "操作失败");
        return Models.parseAdminUser(u);
    }

    /* ------------------------------ 资料 / 通知 / 好友申请 ------------------------------ */

    public Models.User updateProfile(JSONObject patch) throws IOException {
        JSONObject o = exec("/api/auth/me", "PATCH", patch, null, null);
        JSONObject uj = o.optJSONObject("user");
        if (uj == null) throw new ApiException(500, "保存失败");
        Store.setUserJson(uj.toString());
        Models.User u = Models.parseUser(uj);
        if (u == null) throw new ApiException(500, "保存失败");
        return u;
    }

    public List<Models.Notification> notifications() throws IOException {
        List<Models.Notification> out = new ArrayList<>();
        for (JSONObject it : Models.toList(get("/api/notifications").optJSONArray("notifications"))) {
            out.add(Models.parseNotification(it));
        }
        return out;
    }

    public void markNotificationsRead() throws IOException {
        post("/api/notifications/read", new JSONObject());
    }

    public void deleteNotification(long id) throws IOException {
        exec("/api/notifications/" + id, "DELETE", new JSONObject(), null, null);
    }

    public List<Models.FriendRequest> friendRequests() throws IOException {
        List<Models.FriendRequest> out = new ArrayList<>();
        for (JSONObject it : Models.toList(get("/api/friends/requests").optJSONArray("requests"))) {
            out.add(Models.parseFriendRequest(it));
        }
        return out;
    }

    public void answerFriendRequest(long requestId, boolean accept) throws IOException {
        post("/api/friends/requests/" + requestId + "/" + (accept ? "accept" : "reject"), new JSONObject());
    }

    public String groupRole(int groupId) throws IOException {
        JSONObject o = get("/api/groups/" + groupId);
        JSONObject g = o.optJSONObject("group");
        return g == null ? "member" : g.optString("my_role", "member");
    }

    /* ------------------------------ 群聊管理 ------------------------------ */

    public Models.GroupDetail groupDetail(int groupId) throws IOException {
        return Models.parseGroupDetail(get("/api/groups/" + groupId));
    }

    public Models.Group createGroup(String name, List<Integer> memberIds)
            throws IOException, JSONException {
        JSONArray ids = new JSONArray();
        for (Integer id : memberIds) ids.put(id);
        JSONObject body = new JSONObject();
        body.put("name", name);
        body.put("memberIds", ids);
        JSONObject o = post("/api/groups", body);
        JSONObject g = o.optJSONObject("group");
        if (g == null) throw new ApiException(500, "创建失败");
        return Models.parseGroup(g);
    }

    public Models.Group updateGroup(int groupId, JSONObject patch) throws IOException {
        JSONObject o = exec("/api/groups/" + groupId, "PATCH", patch, null, null);
        JSONObject g = o.optJSONObject("group");
        if (g == null) throw new ApiException(500, "保存失败");
        return Models.parseGroup(g);
    }

    public void inviteGroup(int groupId, List<Integer> userIds) throws IOException, JSONException {
        JSONArray ids = new JSONArray();
        for (Integer id : userIds) ids.put(id);
        JSONObject body = new JSONObject();
        body.put("userIds", ids);
        post("/api/groups/" + groupId + "/invite", body);
    }

    public void kickMember(int groupId, int userId) throws IOException, JSONException {
        JSONObject body = new JSONObject();
        body.put("userId", userId);
        post("/api/groups/" + groupId + "/kick", body);
    }

    public void setAdmin(int groupId, int userId, boolean admin) throws IOException, JSONException {
        JSONObject body = new JSONObject();
        body.put("userId", userId);
        body.put("admin", admin);
        post("/api/groups/" + groupId + "/set-admin", body);
    }

    public void muteMember(int groupId, int userId, int durationSec) throws IOException, JSONException {
        JSONObject body = new JSONObject();
        body.put("userId", userId);
        body.put("durationSec", durationSec);
        post("/api/groups/" + groupId + "/mute", body);
    }

    public void transferOwner(int groupId, int userId) throws IOException, JSONException {
        JSONObject body = new JSONObject();
        body.put("userId", userId);
        post("/api/groups/" + groupId + "/transfer", body);
    }

    public void quitGroup(int groupId) throws IOException {
        post("/api/groups/" + groupId + "/quit", new JSONObject());
    }

    public void groupDnd(int groupId, boolean dnd) throws IOException, JSONException {
        JSONObject body = new JSONObject();
        body.put("dnd", dnd);
        exec("/api/groups/" + groupId + "/dnd", "PATCH", body, null, null);
    }

    /* ------------------------------ 会话置顶 / 免打扰 ------------------------------ */

    public void pinConversation(String convType, String convId, boolean pinned)
            throws IOException, JSONException {
        JSONObject body = new JSONObject();
        body.put("convType", convType);
        body.put("convId", convId);
        body.put("pinned", pinned);
        exec("/api/conversations/pin", "PATCH", body, null, null);
    }

    public void dmDnd(int peerId, boolean dnd) throws IOException, JSONException {
        JSONObject body = new JSONObject();
        body.put("peerId", peerId);
        body.put("dnd", dnd);
        exec("/api/dm-dnd", "PATCH", body, null, null);
    }

    /* ------------------------------ 用户资料 / 好友关系 ------------------------------ */

    public Models.User user(int userId) throws IOException {
        JSONObject o = get("/api/users/" + userId);
        Models.User u = Models.parseUser(o.optJSONObject("user"));
        if (u == null) throw new ApiException(404, "用户不存在");
        return u;
    }

    public List<Models.Moment> userMoments(int userId) throws IOException {
        List<Models.Moment> out = new ArrayList<>();
        for (JSONObject it : Models.toList(get("/api/users/" + userId + "/moments").optJSONArray("moments"))) {
            out.add(Models.parseMoment(it));
        }
        return out;
    }

    public String setRemark(int userId, String remark) throws IOException, JSONException {
        JSONObject body = new JSONObject();
        body.put("remark", remark);
        JSONObject o = exec("/api/friends/" + userId, "PATCH", body, null, null);
        return o.optString("remark", remark);
    }

    public void deleteFriend(int userId) throws IOException {
        exec("/api/friends/" + userId, "DELETE", new JSONObject(), null, null);
    }

    public void blockUser(int userId) throws IOException, JSONException {
        JSONObject body = new JSONObject();
        body.put("userId", userId);
        post("/api/friends/block", body);
    }

    public List<Models.User> blocks() throws IOException {
        List<Models.User> out = new ArrayList<>();
        for (JSONObject it : Models.toList(get("/api/friends/blocks").optJSONArray("blocks"))) {
            Models.User u = Models.parseUser(it);
            if (u != null) out.add(u);
        }
        return out;
    }

    public void unblockUser(int userId) throws IOException {
        exec("/api/friends/block/" + userId, "DELETE", new JSONObject(), null, null);
    }

    /* ------------------------------ 动态详情 ------------------------------ */

    public Models.Moment moment(long id) throws IOException {
        JSONObject o = get("/api/moments/" + id);
        JSONObject m = o.optJSONObject("moment");
        if (m == null) throw new ApiException(404, "动态不存在或已删除");
        return Models.parseMoment(m);
    }

    public Models.Moment commentMoment(long id, String content, int replyToUserId)
            throws IOException, JSONException {
        return commentMoment(id, content, "text", "", "", replyToUserId);
    }

    public Models.Moment commentMoment(long id, String content, String msgType,
                                       String mediaUrl, String mediaThumb, int replyToUserId)
            throws IOException, JSONException {
        JSONObject body = new JSONObject();
        body.put("content", content == null ? "" : content);
        body.put("msg_type", msgType == null ? "text" : msgType);
        if (mediaUrl != null && !mediaUrl.isEmpty()) body.put("media_url", mediaUrl);
        if (mediaThumb != null && !mediaThumb.isEmpty()) body.put("media_thumb", mediaThumb);
        if (replyToUserId > 0) body.put("replyToUserId", replyToUserId);
        JSONObject o = post("/api/moments/" + id + "/comments", body);
        JSONObject m = o.optJSONObject("moment");
        if (m == null) throw new ApiException(500, "评论失败");
        return Models.parseMoment(m);
    }

    /* ------------------------------ 实时轮询 ------------------------------ */

    public static class PollEvent {
        public String type = "";
        public JSONObject data = new JSONObject();
    }

    public static class PollResult {
        public long cursor;
        public List<PollEvent> events = new ArrayList<>();
    }

    public PollResult poll(long since, int wait) throws IOException {
        String path = since <= 0 ? "/api/poll" : "/api/poll?since=" + since + "&wait=" + wait;
        JSONObject o = get(path);
        PollResult r = new PollResult();
        r.cursor = o.optLong("cursor", since);
        for (JSONObject it : Models.toList(o.optJSONArray("events"))) {
            PollEvent e = new PollEvent();
            e.type = it.optString("type", "");
            JSONObject data = it.optJSONObject("data");
            e.data = data == null ? new JSONObject() : data;
            r.events.add(e);
        }
        return r;
    }

    /* ------------------------------ 上传 ------------------------------ */

    public JSONObject uploadBytes(byte[] bytes, String name, String mime) throws IOException {
        if (bytes.length <= 1_200_000) {
            RequestBody file = RequestBody.create(bytes, MediaType.parse(
                    mime == null || mime.isEmpty() ? "application/octet-stream" : mime));
            MultipartBody body = new MultipartBody.Builder()
                    .setType(MultipartBody.FORM)
                    .addFormDataPart("file", name, file)
                    .build();
            return exec("/api/upload", "POST", null, body, null);
        }
        return uploadChunks(bytes, name);
    }

    private JSONObject uploadChunks(byte[] bytes, String name) throws IOException {
        int chunkSize = 900 * 1024;
        int total = (bytes.length + chunkSize - 1) / chunkSize;
        if (total > 400) throw new ApiException(400, "文件过大（最多约 360MB）");
        String uploadId = MediaUtil.randomHex(24);
        String encName = q(name);
        for (int i = 0; i < total; i++) {
            int start = i * chunkSize;
            int end = Math.min(bytes.length, start + chunkSize);
            byte[] part = new byte[end - start];
            System.arraycopy(bytes, start, part, 0, part.length);
            Map<String, String> headers = new LinkedHashMap<>();
            headers.put("X-Upload-Id", uploadId);
            headers.put("X-Chunk-Index", String.valueOf(i));
            headers.put("X-Chunk-Total", String.valueOf(total));
            headers.put("X-File-Name", encName);
            JSONObject o = exec("/api/upload/chunk", "POST", null,
                    RequestBody.create(part, OCTET), headers);
            if (o.has("url")) return o;
        }
        throw new ApiException(500, "上传失败");
    }

    /** 视频等大文件：边读边传，避免整个文件读进内存 */
    public JSONObject uploadStream(InputStream in, long size, String name) throws IOException {
        if (size > 0 && size <= 1_200_000) {
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) > 0) bos.write(buf, 0, n);
            in.close();
            return uploadBytes(bos.toByteArray(), name, "application/octet-stream");
        }
        int chunkSize = 900 * 1024;
        int total = size > 0 ? (int) ((size + chunkSize - 1) / chunkSize) : 0;
        if (total <= 0 || total > 400) {
            try {
                in.close();
            } catch (Exception ignored) {
            }
            throw new ApiException(400, "文件过大或无法读取");
        }
        String uploadId = MediaUtil.randomHex(24);
        String encName = q(name);
        byte[] buf = new byte[chunkSize];
        try {
            for (int i = 0; i < total; i++) {
                int read = 0;
                while (read < chunkSize) {
                    int n = in.read(buf, read, chunkSize - read);
                    if (n <= 0) break;
                    read += n;
                }
                if (read <= 0) break;
                byte[] part = new byte[read];
                System.arraycopy(buf, 0, part, 0, read);
                Map<String, String> headers = new LinkedHashMap<>();
                headers.put("X-Upload-Id", uploadId);
                headers.put("X-Chunk-Index", String.valueOf(i));
                headers.put("X-Chunk-Total", String.valueOf(total));
                headers.put("X-File-Name", encName);
                JSONObject o = exec("/api/upload/chunk", "POST", null,
                        RequestBody.create(part, OCTET), headers);
                if (o.has("url")) return o;
            }
        } finally {
            try {
                in.close();
            } catch (Exception ignored) {
            }
        }
        throw new ApiException(500, "上传失败");
    }
}
