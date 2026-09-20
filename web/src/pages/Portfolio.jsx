import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { navigate, Empty, pct } from '../App.jsx';

export default function Portfolio() {
  const [positions, setPositions] = useState(null);
  useEffect(() => { api.portfolio().then(d => setPositions(d.positions)); }, []);
  if (!positions) return <p className="dim">counting your beets…</p>;

  const open = positions.filter(p => p.market.status === 'open' || p.market.status === 'locked');
  const settled = positions.filter(p => p.market.status === 'resolved' || p.market.status === 'cancelled');

  return (
    <section>
      <h2>Positions</h2>
      <p className="dim">Where your beetcoin is sleeping tonight.</p>
      {positions.length === 0 ? <Empty text="No stakes yet. The book is waiting." /> : (
        <>
          <PosTable title="live" rows={open} />
          <PosTable title="settled" rows={settled} />
        </>
      )}
    </section>
  );
}

function PosTable({ title, rows }) {
  if (rows.length === 0) return null;
  return (
    <>
      <h3 className="subhead">{title}</h3>
      <table className="table-list">
        <thead><tr><th>moorket</th><th>backed</th><th className="num">staked</th><th className="num">state</th></tr></thead>
        <tbody>
          {rows.map(p => {
            const m = p.market;
            const o = m.outcomes.find(x => x.id === p.outcome_id);
            const won = m.status === 'resolved' && m.winning_outcome_id === p.outcome_id;
            const implied = o?.implied;
            const estReturn = m.status === 'resolved'
              ? null
              : o && o.pool > 0 ? Math.floor((p.staked / o.pool) * m.total_pool) : null;
            return (
              <tr key={p.outcome_id} className="clickable" onClick={() => navigate(`/markets/${m.id}`)}>
                <td><span className="mnum">{m.number}</span> {m.title}</td>
                <td><b>{p.outcome_label}</b></td>
                <td className="num">₿{p.staked}</td>
                <td className="num dim">
                  {m.status === 'resolved' ? (won ? 'won' : 'lost')
                    : m.status === 'cancelled' ? 'refunded'
                    : estReturn !== null ? `→ ₿${estReturn} (${pct(implied)})` : pct(implied)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
