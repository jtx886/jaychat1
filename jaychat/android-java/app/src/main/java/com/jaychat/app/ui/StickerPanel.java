package com.jaychat.app.ui;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.text.Editable;
import android.text.TextUtils;
import android.text.TextWatcher;
import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.EditText;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.bumptech.glide.Glide;
import com.bumptech.glide.load.engine.DiskCacheStrategy;
import com.google.android.material.bottomsheet.BottomSheetDialog;
import com.jaychat.app.Api;
import com.jaychat.app.MediaUtil;
import com.jaychat.app.Models;
import com.jaychat.app.R;
import com.jaychat.app.Ui;

import java.util.ArrayList;
import java.util.List;

/** 聊天表情面板：表情包搜索 / 收藏 / 发送，以及常用 emoji */
public final class StickerPanel {

    public interface Listener {
        void onSticker(String url, String label);

        void onEmoji(String emoji);
    }

    private static final String[] EMOJIS = {
            "😀", "😁", "😂", "🤣", "😊", "😍", "😘", "😎", "🤔", "😴",
            "😭", "😡", "👍", "👎", "🙏", "👏", "💪", "🎉", "❤️", "🔥",
            "✨", "🌙", "⭐", "🍀", "🌸", "🦋", "🚀", "🐱", "🐶", "🥳"
    };

    private StickerPanel() {
    }

    public static void show(Context ctx, Listener listener) {
        BottomSheetDialog dialog = new BottomSheetDialog(ctx);
        View root = LayoutInflater.from(ctx).inflate(R.layout.sheet_sticker, null);
        dialog.setContentView(root);

        EditText etSearch = root.findViewById(R.id.etSearch);
        RecyclerView recycler = root.findViewById(R.id.recycler);
        TextView tvEmpty = root.findViewById(R.id.tvEmpty);
        LinearLayout emojiRow = root.findViewById(R.id.emojiRow);

        StickerAdapter adapter = new StickerAdapter();
        adapter.setListener(new StickerAdapter.Listener() {
            @Override
            public void onTap(Models.Sticker s) {
                listener.onSticker(s.url, s.label);
                dialog.dismiss();
            }

            @Override
            public void onLongPress(Models.Sticker s) {
                boolean fav = adapter.isFav(s.url);
                Ui.runIo(() -> {
                    try {
                        List<Models.Sticker> favs = fav
                                ? Api.api().removeStickerFav(s.url)
                                : Api.api().addStickerFav(s.url, s.label);
                        Ui.runMain(() -> {
                            adapter.setFavs(favs);
                            Ui.toast(ctx, fav ? "已取消收藏" : "已收藏");
                        });
                    } catch (Exception e) {
                        Ui.toast(ctx, e.getMessage() == null ? "操作失败" : e.getMessage());
                    }
                });
            }
        });
        recycler.setLayoutManager(new GridLayoutManager(ctx, 4));
        recycler.setAdapter(adapter);

        for (String e : EMOJIS) {
            TextView tv = new TextView(ctx);
            tv.setText(e);
            tv.setTextSize(26);
            int p = Ui.dp(ctx, 6);
            tv.setPadding(p, p, p, p);
            tv.setOnClickListener(v -> {
                listener.onEmoji(e);
                dialog.dismiss();
            });
            emojiRow.addView(tv);
        }

        Handler handler = new Handler(Looper.getMainLooper());
        final Runnable[] searchTask = new Runnable[1];
        etSearch.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {
            }

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
            }

            @Override
            public void afterTextChanged(Editable s) {
                if (searchTask[0] != null) handler.removeCallbacks(searchTask[0]);
                String kw = s.toString().trim();
                searchTask[0] = () -> search(ctx, adapter, tvEmpty, kw);
                handler.postDelayed(searchTask[0], 350);
            }
        });

        tvEmpty.setVisibility(View.GONE);
        recycler.setVisibility(View.VISIBLE);
        Ui.runIo(() -> {
            List<Models.Sticker> favs = new ArrayList<>();
            try {
                favs = Api.api().stickerFavs();
            } catch (Exception ignored) {
            }
            final List<Models.Sticker> list = favs;
            Ui.runMain(() -> {
                adapter.setFavs(list);
                tvEmpty.setVisibility(list.isEmpty() ? View.VISIBLE : View.GONE);
                if (list.isEmpty()) tvEmpty.setText("还没有收藏，搜索后长按可收藏");
            });
        });

        dialog.setOnDismissListener(d -> handler.removeCallbacksAndMessages(null));
        dialog.show();
    }

    private static void search(Context ctx, StickerAdapter adapter, TextView tvEmpty, String kw) {
        if (TextUtils.isEmpty(kw)) {
            Ui.runIo(() -> {
                List<Models.Sticker> favs = new ArrayList<>();
                try {
                    favs = Api.api().stickerFavs();
                } catch (Exception ignored) {
                }
                final List<Models.Sticker> list = favs;
                Ui.runMain(() -> {
                    adapter.setFavs(list);
                    tvEmpty.setVisibility(list.isEmpty() ? View.VISIBLE : View.GONE);
                    if (list.isEmpty()) tvEmpty.setText("还没有收藏，搜索后长按可收藏");
                });
            });
            return;
        }
        Ui.runIo(() -> {
            try {
                List<Models.Sticker> list = Api.api().searchStickers(kw, 1);
                Ui.runMain(() -> {
                    adapter.setResults(list);
                    tvEmpty.setVisibility(list.isEmpty() ? View.VISIBLE : View.GONE);
                    tvEmpty.setText("没有找到相关表情");
                });
            } catch (Exception e) {
                Ui.toast(ctx, e.getMessage() == null ? "搜索失败" : e.getMessage());
            }
        });
    }

    static class StickerAdapter extends RecyclerView.Adapter<StickerAdapter.VH> {
        interface Listener {
            void onTap(Models.Sticker s);

            void onLongPress(Models.Sticker s);
        }

        private final List<Models.Sticker> data = new ArrayList<>();
        private final List<Models.Sticker> favs = new ArrayList<>();
        private Listener listener;

        StickerAdapter() {
        }

        void setListener(Listener listener) {
            this.listener = listener;
        }

        void setFavs(List<Models.Sticker> list) {
            data.clear();
            data.addAll(list);
            favs.clear();
            favs.addAll(list);
            notifyDataSetChanged();
        }

        void setResults(List<Models.Sticker> list) {
            data.clear();
            data.addAll(list);
            notifyDataSetChanged();
        }

        boolean isFav(String url) {
            for (Models.Sticker s : favs) {
                if (s.url.equals(url)) return true;
            }
            return false;
        }

        @NonNull
        @Override
        public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
            return new VH(LayoutInflater.from(parent.getContext())
                    .inflate(R.layout.item_sticker_cell, parent, false));
        }

        @Override
        public void onBindViewHolder(@NonNull VH h, int position) {
            Models.Sticker s = data.get(position);
            String url = MediaUtil.mediaUrl(s.thumb.isEmpty() ? s.url : s.thumb);
            Glide.with(h.iv).load(url)
                    .diskCacheStrategy(DiskCacheStrategy.ALL)
                    .into(h.iv);
            h.iv.setOnClickListener(v -> listener.onTap(s));
            h.iv.setOnLongClickListener(v -> {
                listener.onLongPress(s);
                return true;
            });
        }

        @Override
        public int getItemCount() {
            return data.size();
        }

        static class VH extends RecyclerView.ViewHolder {
            ImageView iv;

            VH(@NonNull View v) {
                super(v);
                iv = v.findViewById(R.id.ivSticker);
            }
        }
    }
}
