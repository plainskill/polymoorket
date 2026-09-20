import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { useApp } from '../App.jsx';

export default function Leaderboard() {
  const { user } = useApp();
  const [rows, setRows] = useState(null);
  useEffect(() => { api.leaderboard().then(d => setRows(d.leaderboard)); }, []);
  if (!rows) return <p className="dim">reading the honours board…</p>;
  const max = Math.max(1, ...rows.map(r => r.balance));
  return (
    <section>
      <h2>The board</h2>
      <p className="dim">Beetcoin in hand. Staked beets don't count — they're at risk, that's the point.</p>
      <ol className="board">
        {rows.map((r, i) => (
          <li key={r.id} className={r.id === user.id ? 'me' : ''}>
            <span className="rank">{i + 1}</span>
            <span className="bname">{r.username}{r.id === user.id && ' (you)'}</span>
            <span className="bbar"><i style={{ width: `${(r.balance / max) * 100}%` }} /></span>
            <span className="num">₿{r.balance.toLocaleString()}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}
