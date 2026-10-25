package com.jaychat.app

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.net.Uri
import android.provider.OpenableColumns
import androidx.exifinterface.media.ExifInterface
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.URLEncoder

/** 后端返回的是 /uploads/... 相对地址，统一走 /api/media（正确 MIME + Range） */
fun mediaUrl(raw: String): String {
    val v = raw.trim()
    if (v.isEmpty()) return ""
    if (v.startsWith("http://") || v.startsWith("https://")) return v
    val base = Store.base.trimEnd('/')
    val clean = v.substringBefore('#')
    return if (clean.startsWith("/uploads/")) {
        base + "/api/media?f=" + URLEncoder.encode(clean.removePrefix("/uploads/"), "UTF-8")
    } else {
        base + clean
    }
}

fun avatarUrl(raw: String): String {
    val v = raw.trim()
    if (v.isEmpty() || v.startsWith("preset:") || v.startsWith("data:")) return ""
    return mediaUrl(v)
}

fun presetIndexOf(raw: String): Int {
    if (raw.startsWith("preset:")) {
        return raw.removePrefix("preset:").toIntOrNull() ?: 0
    }
    return 0
}

fun queryDisplayName(ctx: Context, uri: Uri, fallback: String): String {
    return try {
        ctx.contentResolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
            if (c.moveToFirst()) {
                val i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (i >= 0) c.getString(i)?.takeIf { it.isNotBlank() } ?: fallback else fallback
            } else fallback
        } ?: fallback
    } catch (e: Exception) {
        fallback
    }
}

fun querySize(ctx: Context, uri: Uri): Long {
    return try {
        ctx.contentResolver.openAssetFileDescriptor(uri, "r")?.use { it.length } ?: -1L
    } catch (e: Exception) {
        -1L
    }
}

fun openStream(ctx: Context, uri: Uri): InputStream? = try {
    ctx.contentResolver.openInputStream(uri)
} catch (e: Exception) {
    null
}

/** 图片压缩：最长边 1600，JPEG 86，体积通常 100~500KB，避开主机上传限制 */
fun compressImage(ctx: Context, uri: Uri): ByteArray? {
    val resolver = ctx.contentResolver
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
    if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null

    var sample = 1
    while (bounds.outWidth / sample > 1600 || bounds.outHeight / sample > 1600) sample *= 2

    var bmp: Bitmap = resolver.openInputStream(uri)?.use {
        BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
    } ?: return null

    val rotation = try {
        resolver.openInputStream(uri)?.use { ExifInterface(it).rotationDegrees } ?: 0
    } catch (e: Exception) {
        0
    }
    if (rotation != 0) {
        val m = Matrix().apply { postRotate(rotation.toFloat()) }
        bmp = Bitmap.createBitmap(bmp, 0, 0, bmp.width, bmp.height, m, true)
    }

    val maxSide = maxOf(bmp.width, bmp.height)
    if (maxSide > 1600) {
        val scale = 1600f / maxSide
        bmp = Bitmap.createScaledBitmap(
            bmp,
            (bmp.width * scale).toInt().coerceAtLeast(1),
            (bmp.height * scale).toInt().coerceAtLeast(1),
            true
        )
    }

    val out = ByteArrayOutputStream()
    bmp.compress(Bitmap.CompressFormat.JPEG, 86, out)
    return out.toByteArray()
}

fun isVideoUri(ctx: Context, uri: Uri): Boolean {
    return (ctx.contentResolver.getType(uri) ?: "").startsWith("video/")
}
