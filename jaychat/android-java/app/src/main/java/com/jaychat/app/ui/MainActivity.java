package com.jaychat.app.ui;

import android.os.Bundle;

import androidx.annotation.Nullable;
import androidx.appcompat.app.AppCompatActivity;
import androidx.fragment.app.Fragment;
import androidx.fragment.app.FragmentTransaction;

import com.google.android.material.bottomnavigation.BottomNavigationView;
import com.jaychat.app.R;
import com.jaychat.app.Store;

public class MainActivity extends AppCompatActivity {

    private Fragment conversations, contacts, moments, me;
    private Fragment current;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (Store.token().isEmpty()) {
            finish();
            return;
        }
        setContentView(R.layout.activity_main);

        conversations = new ConversationsFragment();
        contacts = new ContactsFragment();
        moments = new MomentsFragment();
        me = new MeFragment();

        FragmentTransaction tx = getSupportFragmentManager().beginTransaction()
                .add(R.id.container, me, "me")
                .add(R.id.container, moments, "moments")
                .add(R.id.container, contacts, "contacts")
                .add(R.id.container, conversations, "messages");
        tx.hide(me).hide(moments).hide(contacts).commit();
        current = conversations;

        BottomNavigationView nav = findViewById(R.id.nav);
        nav.setOnItemSelectedListener(item -> {
            int id = item.getItemId();
            if (id == R.id.nav_messages) show(conversations);
            else if (id == R.id.nav_contacts) show(contacts);
            else if (id == R.id.nav_moments) show(moments);
            else show(me);
            return true;
        });
        nav.setSelectedItemId(R.id.nav_messages);
    }

    private void show(Fragment f) {
        if (f == current || isFinishing()) return;
        FragmentTransaction tx = getSupportFragmentManager().beginTransaction();
        tx.hide(current).show(f).commit();
        current = f;
        if (f instanceof ConversationsFragment) {
            // 会话列表回到前台时刷新
            ((ConversationsFragment) f).onResume();
        }
    }
}
