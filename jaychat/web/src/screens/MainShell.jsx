import React from 'react';
import { useApp } from '../App.jsx';
import HomeScreen from './Home.jsx';
import ContactsScreen from './Contacts.jsx';
import MeScreen from './Me.jsx';

const TABS = [
  {
    key: 'home',
    label: '首页',
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <path d="M4 10.6 12 4l8 6.6V19a1.6 1.6 0 0 1-1.6 1.6h-3.1v-5.2a1.6 1.6 0 0 0-1.6-1.6h-3.4a1.6 1.6 0 0 0-1.6 1.6v5.2H5.6A1.6 1.6 0 0 1 4 19z" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: 'contacts',
    label: '联系人',
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8.2" r="3.7" stroke="currentColor" strokeWidth="1.9" />
        <path d="M4.6 20c.7-3.7 3.8-5.6 7.4-5.6s6.7 1.9 7.4 5.6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: 'me',
    label: '我的',
    icon: (
      <svg viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="8.6" stroke="currentColor" strokeWidth="1.9" />
        <circle cx="12" cy="10" r="2.7" stroke="currentColor" strokeWidth="1.9" />
        <path d="M7.4 18.4c1-1.9 2.6-2.9 4.6-2.9s3.6 1 4.6 2.9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function MainShell() {
  const app = useApp();
  const [tab, setTab] = React.useState('home');
  const idx = TABS.findIndex((t) => t.key === tab);
  const badgeFor = (k) => {
    if (k === 'home') return app.totalUnread;
    if (k === 'contacts') return app.reqCount;
    return 0;
  };

  return (
    <>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {tab === 'home' ? <HomeScreen /> : tab === 'contacts' ? <ContactsScreen /> : <MeScreen />}
      </div>
      <div className="bottom-nav">
        <div className="nav-pill" style={{ left: `calc(${(idx + 0.5) * (100 / TABS.length)}% - 11px)` }} />
        {TABS.map((t) => (
          <div key={t.key} className={'nav-item' + (tab === t.key ? ' active' : '')} onClick={() => setTab(t.key)}>
            {t.icon}
            <span>{t.label}</span>
            {badgeFor(t.key) > 0 ? <span className="badge">{badgeFor(t.key) > 99 ? '99+' : badgeFor(t.key)}</span> : null}
          </div>
        ))}
      </div>
    </>
  );
}
