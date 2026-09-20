import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { fmtTime } from '../App.jsx';

export default function Suggest() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [explanation, setExplanation] = useState('');
  const [outcomes, setOutcomes] = useState(['Yes', 'No']);
  const [msg, setMsg] = useState('');
  const [mine, setMine] = useState(null);

  const load = () => api.mySuggestions().then(setMine);
  useEffect(() => { load(); }, []);

  async function submit(e) {
    e.preventDefault();
    try {
      await api.suggestMarket({ title, description, explanation, outcomes });
      setMsg('Suggested. The admin decides if it opens.');
      setTitle(''); setDescription(''); setExplanation(''); setOutcomes(['Yes', 'No']);
      load();
    } catch (e2) { setMsg(e2.message); }
  }

  return (
    <section className="suggest">
      <h2>Suggest a moorket</h2>
      <p className="dim">Anything the book should take money on. Make the resolution criteria unambiguous — the admin will hold you to it.</p>
      <form onSubmit={submit} className="form">
        <label><span>question</span>
          <input value={title} onChange={e => setTitle(e.target.value)} required
                 placeholder="Will anyone bring up polymoorket at dinner?" />
        </label>
        <label><span>resolution criteria</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
                    placeholder="exactly what counts, what source decides, when it's judged" />
        </label>
        <label><span>why this moorket deserves to exist</span>
          <textarea value={explanation} onChange={e => setExplanation(e.target.value)} required
                    placeholder="make the case — gossip is a valid reason" />
        </label>
        <div className="outcomes-edit">
          <span>outcomes</span>
          {outcomes.map((o, i) => (
            <div key={i} className="orow">
              <input value={o} onChange={e => setOutcomes(outcomes.map((x, j) => j === i ? e.target.value : x))} />
              {outcomes.length > 2 && <button type="button" className="linkish" onClick={() => setOutcomes(outcomes.filter((_, j) => j !== i))}>×</button>}
            </div>
          ))}
          <button type="button" className="linkish" onClick={() => setOutcomes([...outcomes, `Outcome ${outcomes.length + 1}`])}>+ add outcome</button>
        </div>
        <button type="submit">put it to the admin</button>
        {msg && <p className="dim">{msg}</p>}
      </form>

      {mine && (mine.market_suggestions.length + mine.resolution_suggestions.length > 0) && (
        <>
          <h3 className="subhead">your paper trail</h3>
          <ul className="betfeed">
            {mine.market_suggestions.map(s => (
              <li key={`m${s.id}`}>
                <b>{s.title}</b> <span className={`sugtag s-${s.status}`}>{s.status}</span>
                <span className="dim"> · {fmtTime(s.created_at)}{s.admin_note && ` · ${s.admin_note}`}</span>
              </li>
            ))}
            {mine.resolution_suggestions.map(s => (
              <li key={`r${s.id}`}>
                resolution → <b>{s.outcome_label}</b> on <b>{s.market_title}</b>
                <span className={`sugtag s-${s.status}`}>{s.status}</span>
                <span className="dim"> · {fmtTime(s.created_at)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
