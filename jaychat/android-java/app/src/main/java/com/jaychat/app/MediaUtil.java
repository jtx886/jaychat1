package com.jaychat.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.net.Uri;
import android.provider.OpenableColumns;

import androidx.exifinterface.media.ExifInterface;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URLEncoder;
import java.util.Random;

/** 地址拼接、图片压缩、文件信息等工具 */
public final class MediaUtil {

    private MediaUtil() {
    }

    /** 后端返回 /uploads/... 相对地址，统一走 /api/media（正确 MIME + Range） */
    public static String mediaUrl(String raw) {
        String v = raw == null ? "" : raw.trim();
        if (v.isEmpty()) return "";
        if (v.startsWith("http://") || v.startsWith("https://")) return v;
        String base = Store.base();
        if (base.endsWith("/")) base = base.substring(0, base.length() - 1);
        String clean = v;
        int hash = clean.indexOf('#');
        if (hash >= 0) clean = clean.substring(0, hash);
        if (clean.startsWith("/uploads/")) {
            try {
                return base + "/api/media?f=" + URLEncoder.encode(clean.substring(8), "UTF-8");
            } catch (Exception e) {
                return base + clean;
            }
        }
        return base + clean;
    }

    public static String avatarUrl(String raw) {
        String v = raw == null ? "" : raw.trim();
        if (v.isEmpty() || v.startsWith("preset:") || v.startsWith("data:")) return "";
        return mediaUrl(v);
    }

    public static String queryDisplayName(Context ctx, Uri uri, String fallback) {
        try {
            android.database.Cursor c = ctx.getContentResolver()
                    .query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null);
            if (c != null) {
                try {
                    if (c.moveToFirst()) {
                        int i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                        if (i >= 0) {
                            String v = c.getString(i);
                            if (v != null && !v.trim().isEmpty()) return v;
                        }
                    }
                } finally {
                    c.close();
                }
            }
        } catch (Exception ignored) {
        }
        return fallback;
    }

    public static long querySize(Context ctx, Uri uri) {
        try {
            android.content.res.AssetFileDescriptor fd = ctx.getContentResolver()
                    .openAssetFileDescriptor(uri, "r");
            if (fd != null) {
                try {
                    return fd.getLength();
                } finally {
                    fd.close();
                }
            }
        } catch (Exception ignored) {
        }
        return -1L;
    }

    public static InputStream openStream(Context ctx, Uri uri) {
        try {
            return ctx.getContentResolver().openInputStream(uri);
        } catch (Exception e) {
            return null;
        }
    }

    public static boolean isVideoUri(Context ctx, Uri uri) {
        String t = null;
        try {
            t = ctx.getContentResolver().getType(uri);
        } catch (Exception ignored) {
        }
        return t != null && t.startsWith("video/");
    }

    /** 图片压缩：最长边 1600、JPEG 86 */
    public static byte[] compressImage(Context ctx, Uri uri) {
        try {
            BitmapFactory.Options bounds = new BitmapFactory.Options();
            bounds.inJustDecodeBounds = true;
            InputStream in = openStream(ctx, uri);
            if (in != null) {
                try {
                    BitmapFactory.decodeStream(in, null, bounds);
                } finally {
                    in.close();
                }
            }
            if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;

            int sample = 1;
            while (bounds.outWidth / sample > 1600 || bounds.outHeight / sample > 1600) sample *= 2;

            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inSampleSize = sample;
            Bitmap bmp;
            in = openStream(ctx, uri);
            if (in == null) return null;
            try {
                bmp = BitmapFactory.decodeStream(in, null, opts);
            } finally {
                in.close();
            }
            if (bmp == null) return null;

            int rotation = 0;
            if (android.os.Build.VERSION.SDK_INT >= 24) {
                try {
                    in = openStream(ctx, uri);
                    if (in != null) {
                        ExifInterface exif = new ExifInterface(in);
                        rotation = exif.getRotationDegrees();
                        in.close();
                    }
                } catch (Exception ignored) {
                }
            }
            if (rotation != 0) {
                Matrix m = new Matrix();
                m.postRotate(rotation);
                Bitmap rotated = Bitmap.createBitmap(bmp, 0, 0, bmp.getWidth(), bmp.getHeight(), m, true);
                if (rotated != bmp) bmp = rotated;
            }

            int maxSide = Math.max(bmp.getWidth(), bmp.getHeight());
            if (maxSide > 1600) {
                float scale = 1600f / maxSide;
                bmp = Bitmap.createScaledBitmap(bmp,
                        Math.max(1, (int) (bmp.getWidth() * scale)),
                        Math.max(1, (int) (bmp.getHeight() * scale)), true);
            }
            ByteArrayOutputStream out = new ByteArrayOutputStream();
            bmp.compress(Bitmap.CompressFormat.JPEG, 86, out);
            return out.toByteArray();
        } catch (Exception e) {
            return null;
        }
    }

    public static String randomHex(int len) {
        String chars = "0123456789abcdef";
        Random r = new Random();
        StringBuilder sb = new StringBuilder(len);
        for (int i = 0; i < len; i++) sb.append(chars.charAt(r.nextInt(16)));
        return sb.toString();
    }
}
