import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp, fmtTime } from '../App.jsx';

export default function Pay() {
  const { user, refresh } = useApp();
  const [punters, setPunters] = useState(null);
  const [to, setTo] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [msg, setMsg] = useState('');
  const [history, setHistory] = useState([]);

  const load = () => api.ledger().then(d => setHistory(d.entries.filter(e => e.kind === 'pay'))).catch(() => {});
  useEffect(() => {
    api.leaderboard().then(d => setPunters(d.leaderboard.filter(u => u.id !== user.id))).catch(() => setPunters([]));
    load();
  }, []);

  async function submit(e) {
    e.preventDefault();
    try {
      const r = await api.pay({ to, amount: Number(amount), note });
      setMsg(`Sent ₿${amount} to ${to}. Purse: ₿${r.balance}.`);
      setTo(''); setAmount(''); setNote('');
      refresh(); load();
    } catch (e2) { setMsg(e2.message); }
  }

  return (
    <section className="suggest">
      <h2>Pay a punter</h2>
      <p className="dim">Hand over beetcoin directly. No takebacks — the ledger remembers everything.</p>
      <form onSubmit={submit} className="form">
        <label><span>to</span>
          <select value={to} onChange={e => setTo(e.target.value)} required>
            <option value="">pick a punter…</option>
            {(punters || []).map(u => <option key={u.id} value={u.username}>{u.username}</option>)}
          </select>
        </label>
        <label><span>amount</span>
          <input type="number" min="1" step="1" value={amount} onChange={e => setAmount(e.target.value)}
                 required placeholder={`you hold ₿${user.balance}`} />
        </label>
        <label><span>note (optional)</span>
          <input value={note} onChange={e => setNote(e.target.value)} maxLength={140}
                 placeholder="for services rendered, hush money, etc." />
        </label>
        <button type="submit">send the coin</button>
        {msg && <p className="dim">{msg}</p>}
      </form>

      {history.length > 0 && (
        <>
          <h3 className="subhead">comings & goings</h3>
          <ul className="betfeed">
            {history.map(e => (
              <li key={e.id}>
                <span className={e.amount >= 0 ? 'pos' : 'neg'}>{e.amount >= 0 ? '+' : ''}{e.amount}</span>{' '}
                {e.amount >= 0 ? 'from' : 'to'} <b>{e.ref}</b>
                {e.note && <span className="dim"> — {e.note}</span>}
                <span className="dim"> · {fmtTime(e.created_at)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
