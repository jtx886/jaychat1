package com.jaychat.app.ui;

import android.view.LayoutInflater;
import android.view.View;
import android.view.ViewGroup;
import android.widget.TextView;

import androidx.annotation.NonNull;
import androidx.recyclerview.widget.RecyclerView;

import com.jaychat.app.AvatarView;
import com.jaychat.app.Models;
import com.jaychat.app.R;

import java.util.ArrayList;
import java.util.List;

public class ContactAdapter extends RecyclerView.Adapter<ContactAdapter.VH> {

    static final int TYPE_SECTION = 0;
    static final int TYPE_GROUP = 1;
    static final int TYPE_USER = 2;

    public static class Item {
        int type;
        String section;
        Models.Group group;
        Models.User user;
    }

    interface OnClick {
        void onClick(Item item);
    }

    interface OnLongClick {
        void onLongClick(Item item);
    }

    private final List<Item> data = new ArrayList<>();
    private final OnClick onClick;
    private final OnLongClick onLongClick;

    ContactAdapter(OnClick onClick) {
        this(onClick, null);
    }

    ContactAdapter(OnClick onClick, OnLongClick onLongClick) {
        this.onClick = onClick;
        this.onLongClick = onLongClick;
    }

    void setData(List<Item> list) {
        data.clear();
        data.addAll(list);
        notifyDataSetChanged();
    }

    @Override
    public int getItemViewType(int position) {
        return data.get(position).type;
    }

    @NonNull
    @Override
    public VH onCreateViewHolder(@NonNull ViewGroup parent, int viewType) {
        LayoutInflater inf = LayoutInflater.from(parent.getContext());
        if (viewType == TYPE_SECTION) {
            return new VH(inf.inflate(R.layout.item_section, parent, false));
        }
        return new VH(inf.inflate(R.layout.item_contact, parent, false));
    }

    @Override
    public void onBindViewHolder(@NonNull VH h, int position) {
        Item it = data.get(position);
        if (it.type == TYPE_SECTION) {
            if (h.section != null) {
                h.section.setText(it.section);
                h.section.setVisibility(View.VISIBLE);
            }
            if (h.avatar != null) h.avatar.setVisibility(View.GONE);
            if (h.name != null) h.name.setVisibility(View.GONE);
            if (h.sub != null) h.sub.setVisibility(View.GONE);
            if (h.arrow != null) h.arrow.setVisibility(View.GONE);
            h.itemView.setOnClickListener(null);
            h.itemView.setOnLongClickListener(null);
            return;
        }
        if (h.section != null) h.section.setVisibility(View.GONE);
        if (h.avatar != null) h.avatar.setVisibility(View.VISIBLE);
        if (h.name != null) h.name.setVisibility(View.VISIBLE);
        if (h.sub != null) h.sub.setVisibility(View.VISIBLE);
        if (h.arrow != null) h.arrow.setVisibility(View.VISIBLE);
        if (it.type == TYPE_GROUP) {
            h.avatar.bind(it.group.name, it.group.avatar, null);
            h.name.setText(it.group.name);
            h.sub.setText(it.group.memberCount + " 人 · " + it.group.onlineCount + " 在线");
        } else {
            h.avatar.bind(it.user.displayName(), it.user.avatar, it.user.online);
            h.name.setText(it.user.displayName());
            String sub = "ID " + it.user.id;
            if (it.user.isOfficial) sub += " · 官方";
            h.sub.setText(sub);
        }
        h.itemView.setOnClickListener(v -> onClick.onClick(it));
        if (onLongClick != null) {
            h.itemView.setOnLongClickListener(v -> {
                onLongClick.onLongClick(it);
                return true;
            });
        } else {
            h.itemView.setOnLongClickListener(null);
        }
    }

    @Override
    public int getItemCount() {
        return data.size();
    }

    static class VH extends RecyclerView.ViewHolder {
        AvatarView avatar;
        TextView name, sub, section;
        View arrow;

        VH(@NonNull View v) {
            super(v);
            avatar = v.findViewById(R.id.avatar);
            name = v.findViewById(R.id.tvName);
            sub = v.findViewById(R.id.tvSub);
            section = v.findViewById(R.id.tvSection);
            arrow = v.findViewById(R.id.ivArrow);
        }
    }
}
