import React, { useState } from 'react';
import { api } from '../api.js';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const { user } = await api.login(username, password);
      onLogin(user);
    } catch (e2) {
      setErr(e2.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-head">
          <h1>polymoorket</h1>
          <p className="tagline">a private book, opened among friends.<br />stakes in beetcoin. winners take the pool.</p>
        </div>
        <form onSubmit={submit} className="login-form">
          <label>
            <span>name</span>
            <input value={username} onChange={e => setUsername(e.target.value)} autoFocus autoComplete="username" />
          </label>
          <label>
            <span>password</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
          </label>
          {err && <p className="err">{err}</p>}
          <button type="submit" disabled={busy}>{busy ? 'checking…' : 'enter the book'}</button>
        </form>
        <p className="login-foot">no account? the admin writes them by hand.<br />no beetcoin? same answer.</p>
      </div>
    </div>
  );
}
