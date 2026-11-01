package com.jaychat.app.ui;

import android.os.Bundle;
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
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.recyclerview.widget.GridLayoutManager;
import androidx.recyclerview.widget.RecyclerView;

import com.bumptech.glide.Glide;
import com.bumptech.glide.load.engine.DiskCacheStrategy;
import com.jaychat.app.Api;
import com.jaychat.app.MediaUtil;
import com.jaychat.app.Models;
import com.jaychat.app.R;
import com.jaychat.app.Ui;

import java.util.ArrayList;
import java.util.List;

/** 表情包管理：收藏列表 + 搜索收藏，点击预览，长按取消收藏 */
public class StickersActivity extends AppCompatActivity {

    private EditText etSearch;
    private RecyclerView recycler;
    private TextView tvHint, tvEmpty;
    private StickerAdapter adapter;
    private boolean searchMode;
    private final Handler handler = new Handler(Looper.getMainLooper());

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_stickers);

        etSearch = findViewById(R.id.etSearch);
        recycler = findViewById(R.id.recycler);
        tvHint = findViewById(R.id.tvHint);
        tvEmpty = findViewById(R.id.tvEmpty);

        findViewById(R.id.btnBack).setOnClickListener(v -> finish());

        adapter = new StickerAdapter(new StickerAdapter.Listener() {
            @Override
            public void onTap(Models.Sticker s) {
                if (searchMode) addFav(s);
                else MediaDialogs.showImage(StickersActivity.this, s.url);
            }

            @Override
            public void onLongPress(Models.Sticker s) {
                if (searchMode) return;
                Ui.runIo(() -> {
                    try {
                        List<Models.Sticker> list = Api.api().removeStickerFav(s.url);
                        Ui.runMain(() -> {
                            adapter.setData(list);
                            updateEmpty(list);
                            Ui.toast(StickersActivity.this, "已取消收藏");
                        });
                    } catch (Exception e) {
                        Ui.toast(StickersActivity.this, e.getMessage() == null ? "操作失败" : e.getMessage());
                    }
                });
            }
        });
        recycler.setLayoutManager(new GridLayoutManager(this, 4));
        recycler.setAdapter(adapter);

        final Runnable[] task = new Runnable[1];
        etSearch.addTextChangedListener(new TextWatcher() {
            @Override
            public void beforeTextChanged(CharSequence s, int start, int count, int after) {
            }

            @Override
            public void onTextChanged(CharSequence s, int start, int before, int count) {
            }

            @Override
            public void afterTextChanged(Editable s) {
                if (task[0] != null) handler.removeCallbacks(task[0]);
                String kw = s.toString().trim();
                task[0] = () -> {
                    if (TextUtils.isEmpty(kw)) loadFavs();
                    else search(kw);
                };
                handler.postDelayed(task[0], 350);
            }
        });

        loadFavs();
    }

    private void loadFavs() {
        searchMode = false;
        tvHint.setText("我的收藏 · 点击预览，长按取消收藏");
        Ui.runIo(() -> {
            try {
                List<Models.Sticker> list = Api.api().stickerFavs();
                Ui.runMain(() -> {
                    adapter.setData(list);
                    updateEmpty(list);
                });
            } catch (Exception e) {
                Ui.runMain(() -> Ui.toast(this, e.getMessage() == null ? "加载失败" : e.getMessage()));
            }
        });
    }

    private void search(String kw) {
        searchMode = true;
        tvHint.setText("搜索结果 · 点击收藏");
        Ui.runIo(() -> {
            try {
                List<Models.Sticker> list = Api.api().searchStickers(kw, 1);
                Ui.runMain(() -> {
                    adapter.setData(list);
                    updateEmpty(list);
                });
            } catch (Exception e) {
                Ui.runMain(() -> Ui.toast(this, e.getMessage() == null ? "搜索失败" : e.getMessage()));
            }
        });
    }

    private void addFav(Models.Sticker s) {
        Ui.runIo(() -> {
            try {
                List<Models.Sticker> list = Api.api().addStickerFav(s.url, s.label);
                Ui.runMain(() -> {
                    adapter.setData(list);
                    updateEmpty(list);
                    Ui.toast(this, "已收藏");
                });
            } catch (Exception e) {
                Ui.runMain(() -> Ui.toast(this, e.getMessage() == null ? "收藏失败" : e.getMessage()));
            }
        });
    }

    private void updateEmpty(List<Models.Sticker> list) {
        boolean empty = list.isEmpty();
        recycler.setVisibility(empty ? View.GONE : View.VISIBLE);
        tvEmpty.setVisibility(empty ? View.VISIBLE : View.GONE);
        tvEmpty.setText(searchMode ? "没有找到相关表情" : "还没有收藏的表情，去搜索试试");
    }

    static class StickerAdapter extends RecyclerView.Adapter<StickerAdapter.VH> {
        interface Listener {
            void onTap(Models.Sticker s);

            void onLongPress(Models.Sticker s);
        }

        private final List<Models.Sticker> data = new ArrayList<>();
        private final Listener listener;

        StickerAdapter(Listener listener) {
            this.listener = listener;
        }

        void setData(List<Models.Sticker> list) {
            data.clear();
            data.addAll(list);
            notifyDataSetChanged();
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
            Glide.with(h.iv).load(MediaUtil.mediaUrl(s.thumb.isEmpty() ? s.url : s.thumb))
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
