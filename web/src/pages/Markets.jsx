import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { navigate, Empty, pct, fmtTime } from '../App.jsx';

export default function Markets() {
  const [markets, setMarkets] = useState(null);
  const [filter, setFilter] = useState('open');

  useEffect(() => { api.markets().then(d => setMarkets(d.markets)); }, []);
  if (!markets) return <p className="dim">reading the book…</p>;

  const shown = markets.filter(m =>
    filter === 'all' ? true :
    filter === 'open' ? m.status === 'open' :
    m.status === filter);

  return (
    <section>
      <div className="page-head">
        <h2>The book</h2>
        <div className="filters">
          {['open', 'locked', 'resolved', 'cancelled', 'all'].map(f => (
            <button key={f} className={filter === f ? 'on' : ''} onClick={() => setFilter(f)}>{f}</button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? <Empty text="No moorkets here. Suggest one." /> : (
        <ul className="market-list">
          {shown.map(m => (
            <li key={m.id} className={`mrow st-${m.status}`} onClick={() => navigate(`/markets/${m.id}`)}>
              <span className="mnum">{m.number}</span>
              <div className="mbody">
                <span className="mtitle">{m.title}</span>
                <span className="mmeta">
                  {m.bettors} {m.bettors === 1 ? 'bettor' : 'bettors'} · pool ₿{m.total_pool}
                  {m.visibility === 'restricted' && ' · restricted'}
                  {m.closes_at && ` · closes ${fmtTime(m.closes_at)}`}
                </span>
              </div>
              <div className="modds">
                {m.status === 'resolved' ? (
                  <span className="resolved-tag">→ {m.outcomes.find(o => o.id === m.winning_outcome_id)?.label}</span>
                ) : m.outcomes.map(o => (
                  <span key={o.id} className="ochip"><b>{o.label}</b> {pct(o.implied)}</span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
