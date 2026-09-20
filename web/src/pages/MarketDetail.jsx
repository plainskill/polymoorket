import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp, pct, fmtTime } from '../App.jsx';

export default function MarketDetail({ id }) {
  const { user, refresh } = useApp();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  async function load() {
    try { setData(await api.market(id)); } catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, [id]);

  if (err) return <p className="err">{err}</p>;
  if (!data) return <p className="dim">reading the slip…</p>;
  const { market: m, bets, resolution_suggestions } = data;

  return (
    <section className="detail">
      <header className="detail-head">
        <span className="mnum">{m.number}</span>
        <h2>{m.title}</h2>
        <div className="mmeta">
          <span className={`status st-${m.status}`}>{m.status}</span>
          {m.visibility === 'restricted' && <span className="chip">restricted</span>}
          {m.closes_at && <span>closes {fmtTime(m.closes_at)}</span>}
          <span>pool ₿{m.total_pool}</span>
        </div>
        {m.description && <p className="desc">{m.description}</p>}
        {m.status === 'resolved' && (
          <p className="resolution">resolved → <b>{m.outcomes.find(o => o.id === m.winning_outcome_id)?.label}</b>
            {m.resolution_note && <> — {m.resolution_note}</>}</p>
        )}
      </header>

      <div className="outcomes">
        {m.outcomes.map((o, i) => (
          <OutcomeRow key={o.id} o={o} i={i} market={m} onBet={async (amount) => {
            try { await api.bet(m.id, o.id, amount); await load(); refresh(); }
            catch (e) { alert(e.message); }
          }} />
        ))}
      </div>

      {m.status === 'open' && <SuggestResolution market={m} onDone={load} />}
      {user.role === 'admin' && <AdminControls market={m} onDone={load} />}

      <div className="columns">
        <div>
          <h3>Slips</h3>
          {bets.length === 0 ? <p className="dim">Nobody's staked yet. First money sets the tone.</p> : (
            <ul className="betfeed">
              {bets.map(b => (
                <li key={b.id}>
                  <b>{b.username}</b> staked ₿{b.amount} on <b>{m.outcomes.find(o => o.id === b.outcome_id)?.label}</b>
                  <span className="dim"> · {fmtTime(b.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {resolution_suggestions.length > 0 && (
          <div>
            <h3>Proposed resolutions</h3>
            <ul className="betfeed">
              {resolution_suggestions.map(r => (
                <li key={r.id} className={`sug s-${r.status}`}>
                  <b>{r.username}</b> says → <b>{r.outcome_label}</b>
                  <span className="dim"> · {r.explanation}</span>
                  <span className={`sugtag s-${r.status}`}>{r.status}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}

function OutcomeRow({ o, i, market, onBet }) {
  const { user } = useApp();
  const [amount, setAmount] = useState('');
  const open = market.status === 'open';
  const amt = Number(amount) || 0;
  const myReturn = amt > 0 ? Math.floor((amt / (o.pool + amt)) * (market.total_pool + amt)) : null;

  return (
    <div className={`outcome o${i % 4} ${market.winning_outcome_id === o.id ? 'winner' : ''}`}>
      <div className="oline">
        <span className="olabel">{o.label}</span>
        <span className="opct">{pct(o.implied)}</span>
      </div>
      <div className="obar"><i style={{ width: `${(o.implied ?? 0) * 100}%` }} /></div>
      <div className="osub">
        <span className="dim">pool ₿{o.pool}{o.my_stake > 0 && <> · mine ₿{o.my_stake}</>}</span>
        {o.odds && <span className="dim">pays {o.odds.toFixed(2)}×</span>}
      </div>
      {open && (
        <form className="stake" onSubmit={(e) => { e.preventDefault(); onBet(Number(amount)); setAmount(''); }}>
          <input type="number" min="1" max={user.balance} placeholder="stake" value={amount}
                 onChange={e => setAmount(e.target.value)} />
          <button type="submit" disabled={!Number(amount)}>stake it</button>
          {myReturn !== null && <span className="dim ret">→ ₿{myReturn} if {o.label}</span>}
        </form>
      )}
    </div>
  );
}

function SuggestResolution({ market, onDone }) {
  const [outcomeId, setOutcomeId] = useState('');
  const [explanation, setExplanation] = useState('');
  const [msg, setMsg] = useState('');
  return (
    <details className="suggest-res">
      <summary>think it's settled? propose a resolution</summary>
      <form onSubmit={async (e) => {
        e.preventDefault();
        try {
          await api.suggestResolution(market.id, Number(outcomeId), explanation);
          setMsg('Proposed. The admin will see it.'); setExplanation(''); onDone();
        } catch (e2) { setMsg(e2.message); }
      }}>
        <select value={outcomeId} onChange={e => setOutcomeId(e.target.value)} required>
          <option value="">resolve as…</option>
          {market.outcomes.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <textarea placeholder="why it should resolve this way — evidence, links, eyewitnesses" value={explanation}
                  onChange={e => setExplanation(e.target.value)} required />
        <button type="submit">send the proposal</button>
        {msg && <p className="dim">{msg}</p>}
      </form>
    </details>
  );
}

function AdminControls({ market, onDone }) {
  const [outcomeId, setOutcomeId] = useState('');
  const [note, setNote] = useState('');
  const [asOf, setAsOf] = useState('');
  const [msg, setMsg] = useState('');
  if (market.status === 'resolved' || market.status === 'cancelled') return null;
  return (
    <details className="admin-box">
      <summary>admin: run this moorket</summary>
      <div className="admin-row">
        <button onClick={async () => { await api.admin.patchMarket(market.id, { status: market.status === 'open' ? 'locked' : 'open' }); onDone(); }}>
          {market.status === 'open' ? 'lock stakes' : 'reopen stakes'}
        </button>
        <button className="danger" onClick={async () => {
          const n = prompt('cancel note (stakes are refunded):', 'called off');
          if (n !== null) { await api.admin.cancel(market.id, n); onDone(); }
        }}>cancel & refund</button>
      </div>
      <form className="admin-row" onSubmit={async (e) => {
        e.preventDefault();
        try {
          if (asOf && !confirm(`Stakes placed after ${new Date(asOf).toLocaleString()} will be erased and refunded. Resolve anyway?`)) return;
          await api.admin.resolve(market.id, Number(outcomeId), note, asOf ? new Date(asOf).toISOString() : null); onDone();
        }
        catch (e2) { setMsg(e2.message); }
      }}>
        <select value={outcomeId} onChange={e => setOutcomeId(e.target.value)} required>
          <option value="">resolve as…</option>
          {market.outcomes.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
        <input placeholder="resolution note" value={note} onChange={e => setNote(e.target.value)} />
        <input type="datetime-local" title="erase stakes after this time (optional)" value={asOf} onChange={e => setAsOf(e.target.value)} />
        <button type="submit" className="danger">resolve & pay out</button>
        {msg && <span className="err">{msg}</span>}
      </form>
    </details>
  );
}
