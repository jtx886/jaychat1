import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './styles.css';

/* ---------------- 全局错误兜底：任何异常都显示出来，避免黑屏 ---------------- */
function showFatal(title, detail) {
  let el = document.getElementById('jc-fatal');
  if (!el) {
    el = document.createElement('div');
    el.id = 'jc-fatal';
    el.style.cssText =
      'position:fixed;inset:0;z-index:99999;overflow:auto;padding:22px;font:13px/1.6 ui-monospace,Menlo,monospace;' +
      'color:#ffd9d9;background:#12111a;';
    document.body.appendChild(el);
  }
  el.innerHTML =
    '<div style="font-size:16px;font-weight:700;color:#fff;margin-bottom:10px">Jay Chat 启动出错</div>' +
    `<div style="color:#9aa4bf;margin-bottom:12px">${String(title || '')}</div>` +
    `<pre style="white-space:pre-wrap;word-break:break-all;background:#1c1a28;border:1px solid #2c2a3f;border-radius:10px;padding:12px">${String(
      detail || '',
    )}</pre>` +
    '<button id="jc-fatal-reload" style="margin-top:14px;padding:10px 16px;border-radius:10px;border:0;background:#3b6dff;color:#fff;font-weight:700">重新加载</button>';
  document.getElementById('jc-fatal-reload').onclick = () => {
    el.remove();
    location.reload();
  };
}

window.addEventListener('error', (e) => {
  console.error('[jc] window error', e.error || e.message);
  showFatal(e.message, e.error?.stack || '');
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[jc] unhandled rejection', e.reason);
  showFatal(e.reason?.message || String(e.reason || ''), e.reason?.stack || '');
});

class ErrorBoundary extends React.Component {
  constructor(p) {
    super(p);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  componentDidCatch(err, info) {
    console.error('[jc] render error', err, info);
  }
  render() {
    if (this.state.err) {
      return (
        <div style={{ padding: 22, color: '#ffd9d9', font: '13px/1.6 ui-monospace,monospace' }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 10 }}>Jay Chat 启动出错</div>
          <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#1c1a28', border: '1px solid #2c2a3f', borderRadius: 10, padding: 12 }}>
            {String(this.state.err?.stack || this.state.err?.message || this.state.err)}
          </pre>
          <button
            onClick={() => location.reload()}
            style={{ marginTop: 14, padding: '10px 16px', borderRadius: 10, border: 0, background: '#3b6dff', color: '#fff', fontWeight: 700 }}
          >
            重新加载
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>,
);
