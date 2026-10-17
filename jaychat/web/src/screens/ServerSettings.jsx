import React, { useState } from 'react';
import { api, getBase, setBase, isNative } from '../api.js';
import { useApp } from '../App.jsx';
import { TopBar, toast, Spinner } from '../components/ui.jsx';
import { IconTile } from '../components/icons.jsx';

export default function ServerSettingsScreen() {
  const { back, wsStatus } = useApp();
  const [url, setUrl] = useState(getBase());
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState(null);

  const apply = () => {
    const v = url.trim();
    if (v && !/^https?:\/\//.test(v)) return toast('请填写完整地址，例如 http://192.168.1.5:3000', 'error');
    setBase(v);
    toast(v ? '服务器地址已保存' : '已恢复为同源地址');
    setResult(null);
  };

  const test = async () => {
    setTesting(true);
    setResult(null);
    try {
      const base = url.trim().replace(/\/$/, '');
      const res = await fetch((base || '') + '/api/health');
      const d = await res.json();
      setResult(d.ok ? `连接成功 · ${d.name} · ${new Date(d.time).toLocaleString()}` : '服务器响应异常');
      if (d.ok) toast('连接成功');
    } catch (e) {
      setResult('连接失败：' + e.message);
      toast('连接失败', 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="page" style={{ height: '100%' }}>
      <TopBar title="服务器设置" sub={isNative() ? '移动端跨网络聊天需填写服务端地址' : '浏览器默认使用同源地址'} onBack={back} />
      <div className="page-scroll">
        <div className="glass glass-strong mx" style={{ padding: 16, marginTop: 6 }}>
          <div className="field">
            <label>服务器地址</label>
            <input className="input" placeholder="http://你的服务器IP或域名:3000" value={url} onChange={(e) => setUrl(e.target.value)} />
            <div className="hint">
              留空则使用当前同源地址。跨网络聊天请填写已部署的 Jay Chat 服务端地址（需可从公网访问）。
            </div>
          </div>
          <div className="flex gap8">
            <button className="btn grow" disabled={testing} onClick={test}>{testing ? <Spinner size={16} /> : '测试连接'}</button>
            <button className="btn btn-primary grow" onClick={apply}>保存</button>
          </div>
          {result ? <div className={'hint mt' + (result.includes('成功') ? ' ok-text' : '')} style={{ marginTop: 10 }}>{result}</div> : null}
        </div>

        <div className="glass mx mt">
          <div className="list">
            <div className="list-item">
              <IconTile name="server" tone="cyan" />
              <div className="list-main">
                <div className="list-title">实时连接状态</div>
                <div className="list-desc">{wsStatus === 'open' ? <span className="tag-online"><i />已连接</span> : <span className="dim">未连接（{wsStatus}）</span>}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="center hint" style={{ marginTop: 16 }}>修改地址后会自动重连实时通道</div>
      </div>
    </div>
  );
}
