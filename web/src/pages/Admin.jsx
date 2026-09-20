import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { navigate, fmtTime, pct } from '../App.jsx';

const TABS = ['desk', 'moorkets', 'punters', 'rings', 'inbox'];

export default function Admin() {
  const [tab, setTab] = useState('desk');
  return (
    <section>
      <div className="page-head">
        <h2>The back office</h2>
        <div className="filters">
          {TABS.map(t => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}
        </div>
      </div>
      {tab === 'desk' && <Desk />}
      {tab === 'moorkets' && <AdminMarkets />}
      {tab === 'punters' && <Punters />}
      {tab === 'rings' && <Rings />}
      {tab === 'inbox' && <Inbox />}
    </section>
  );
}

function Desk() {
  const [o, setO] = useState(null);
  useEffect(() => { api.admin.overview().then(setO); }, []);
  if (!o) return <p className="dim">…</p>;
  return (
    <div className="stats">
      <Stat n={o.users} l="accounts" />
      <Stat n={o.markets} l="moorkets" />
      <Stat n={o.open} l="open" />
      <Stat n={`₿${o.beetcoin_in_circulation}`} l="beetcoin in play" />
      <Stat n={o.pending_suggestions} l="suggestions waiting" />
    </div>
  );
}
const Stat = ({ n, l }) => <div className="stat"><b>{n}</b><span>{l}</span></div>;

// ---------- moorkets ----------
function AdminMarkets() {
  const [markets, setMarkets] = useState(null);
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [showNew, setShowNew] = useState(false);

  async function load() {
    const [m, u] = await Promise.all([api.admin.markets(), api.admin.users()]);
    setMarkets(m.markets); setUsers(u.users); setGroups(u.groups);
  }
  useEffect(() => { load(); }, []);
  if (!markets) return <p className="dim">…</p>;

  return (
    <div>
      <button onClick={() => setShowNew(s => !s)}>{showNew ? 'close' : 'open a new moorket'}</button>
      {showNew && <NewMarket users={users} groups={groups} onDone={() => { setShowNew(false); load(); }} />}
      <table className="table">
        <thead><tr><th></th><th>moorket</th><th className="num">pool</th><th>status</th><th>who can see it</th><th></th></tr></thead>
        <tbody>
          {markets.map(m => (
            <tr key={m.id}>
              <td className="mnum">{m.number}</td>
              <td className="clickable" onClick={() => navigate(`/markets/${m.id}`)}>{m.title}</td>
              <td className="num">₿{m.total_pool}</td>
              <td><span className={`status st-${m.status}`}>{m.status}</span></td>
              <td className="dim">
                {m.visibility === 'all' ? 'everyone' :
                  [m.allowed_users.map(u => u.username).join(', '), m.allowed_groups.map(g => `[${g.name}]`).join(', ')]
                    .filter(Boolean).join(' + ') || 'nobody?!'}
              </td>
              <td><VisibilityEditor m={m} users={users} groups={groups} onDone={load} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VisibilityEditor({ m, users, groups, onDone }) {
  const [open, setOpen] = useState(false);
  const [uids, setUids] = useState(m.allowed_users.map(u => u.id));
  const [gids, setGids] = useState(m.allowed_groups.map(g => g.id));
  if (!open) return <button className="linkish" onClick={() => setOpen(true)}>edit access</button>;
  const toggle = (arr, set, id) => set(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);
  return (
    <div className="visedit">
      <select defaultValue={m.visibility} onChange={e => api.admin.patchMarket(m.id, { visibility: e.target.value })}>
        <option value="all">everyone</option>
        <option value="restricted">restricted</option>
      </select>
      <div className="vischecks">
        {users.map(u => (
          <label key={u.id}><input type="checkbox" checked={uids.includes(u.id)} onChange={() => toggle(uids, setUids, u.id)} /> {u.username}</label>
        ))}
        {groups.map(g => (
          <label key={g.id}><input type="checkbox" checked={gids.includes(g.id)} onChange={() => toggle(gids, setGids, g.id)} /> [{g.name}]</label>
        ))}
      </div>
      <button onClick={async () => { await api.admin.patchMarket(m.id, { user_ids: uids, group_ids: gids }); setOpen(false); onDone(); }}>save</button>
      <button className="linkish" onClick={() => setOpen(false)}>never mind</button>
    </div>
  );
}

function NewMarket({ users, groups, onDone }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [outcomes, setOutcomes] = useState(['Yes', 'No']);
  const [visibility, setVisibility] = useState('all');
  const [uids, setUids] = useState([]);
  const [gids, setGids] = useState([]);
  const [closesAt, setClosesAt] = useState('');
  const [err, setErr] = useState('');
  const toggle = (arr, set, id) => set(arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);

  return (
    <form className="form box" onSubmit={async (e) => {
      e.preventDefault();
      try {
        await api.admin.createMarket({
          title, description, outcomes, visibility,
          user_ids: uids, group_ids: gids,
          closes_at: closesAt ? new Date(closesAt).toISOString() : null,
        });
        onDone();
      } catch (e2) { setErr(e2.message); }
    }}>
      <label><span>question</span><input value={title} onChange={e => setTitle(e.target.value)} required /></label>
      <label><span>resolution criteria</span><textarea value={description} onChange={e => setDescription(e.target.value)} /></label>
      <div className="outcomes-edit"><span>outcomes</span>
        {outcomes.map((o, i) => (
          <div key={i} className="orow">
            <input value={o} onChange={e => setOutcomes(outcomes.map((x, j) => j === i ? e.target.value : x))} />
            {outcomes.length > 2 && <button type="button" className="linkish" onClick={() => setOutcomes(outcomes.filter((_, j) => j !== i))}>×</button>}
          </div>
        ))}
        <button type="button" className="linkish" onClick={() => setOutcomes([...outcomes, `Outcome ${outcomes.length + 1}`])}>+ add outcome</button>
      </div>
      <label><span>closes</span><input type="datetime-local" value={closesAt} onChange={e => setClosesAt(e.target.value)} /></label>
      <label><span>who can see it</span>
        <select value={visibility} onChange={e => setVisibility(e.target.value)}>
          <option value="all">everyone</option>
          <option value="restricted">restricted</option>
        </select>
      </label>
      {visibility === 'restricted' && (
        <div className="vischecks">
          {users.map(u => <label key={u.id}><input type="checkbox" checked={uids.includes(u.id)} onChange={() => toggle(uids, setUids, u.id)} /> {u.username}</label>)}
          {groups.map(g => <label key={g.id}><input type="checkbox" checked={gids.includes(g.id)} onChange={() => toggle(gids, setGids, g.id)} /> [{g.name}]</label>)}
        </div>
      )}
      <button type="submit">open the book</button>
      {err && <p className="err">{err}</p>}
    </form>
  );
}

// ---------- punters ----------
function Punters() {
  const [users, setUsers] = useState(null);
  const [nu, setNu] = useState({ username: '', password: '', balance: 100 });
  const [err, setErr] = useState('');
  const load = () => api.admin.users().then(d => setUsers(d.users));
  useEffect(() => { load(); }, []);
  if (!users) return <p className="dim">…</p>;

  return (
    <div>
      <form className="inline-form" onSubmit={async (e) => {
        e.preventDefault();
        try { await api.admin.createUser(nu); setNu({ username: '', password: '', balance: 100 }); load(); }
        catch (e2) { setErr(e2.message); }
      }}>
        <input placeholder="username" value={nu.username} onChange={e => setNu({ ...nu, username: e.target.value })} required />
        <input placeholder="password" value={nu.password} onChange={e => setNu({ ...nu, password: e.target.value })} required />
        <input type="number" min="0" title="opening beetcoin" value={nu.balance} onChange={e => setNu({ ...nu, balance: e.target.value })} />
        <button type="submit">issue account</button>
        {err && <span className="err">{err}</span>}
      </form>
      <table className="table">
        <thead><tr><th>punter</th><th>role</th><th className="num">balance</th><th>state</th><th></th></tr></thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id} className={u.active ? '' : 'inactive'}>
              <td><b>{u.username}</b></td>
              <td className="dim">{u.role}</td>
              <td className="num">₿{u.balance}</td>
              <td>{u.active ? 'in' : 'barred'}</td>
              <td className="actions">
                <button className="linkish" onClick={async () => {
                  const amt = prompt(`grant/deduct beetcoin for ${u.username} (negative to deduct):`, '100');
                  if (amt !== null && Number(amt) !== 0) { await api.admin.patchUser(u.id, { adjust: Number(amt) }); load(); }
                }}>± ₿</button>
                <button className="linkish" onClick={async () => {
                  const pw = prompt(`new password for ${u.username}:`);
                  if (pw) { await api.admin.patchUser(u.id, { password: pw }); }
                }}>reset pw</button>
                <button className="linkish" onClick={async () => {
                  await api.admin.patchUser(u.id, { role: u.role === 'admin' ? 'user' : 'admin' }); load();
                }}>{u.role === 'admin' ? 'demote' : 'promote'}</button>
                <button className="linkish danger" onClick={async () => {
                  await api.admin.patchUser(u.id, { active: !u.active }); load();
                }}>{u.active ? 'bar' : 'readmit'}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- rings (groups) ----------
function Rings() {
  const [data, setData] = useState(null);
  const [name, setName] = useState('');
  const load = () => api.admin.users().then(setData);
  useEffect(() => { load(); }, []);
  if (!data) return <p className="dim">…</p>;
  const { groups, members, users } = data;

  return (
    <div>
      <p className="dim">Rings gate restricted moorkets. A punter sees a restricted moorket if they're named on it or inside a named ring.</p>
      <form className="inline-form" onSubmit={async (e) => {
        e.preventDefault();
        await api.admin.createGroup(name); setName(''); load();
      }}>
        <input placeholder="ring name" value={name} onChange={e => setName(e.target.value)} required />
        <button type="submit">form a ring</button>
      </form>
      <div className="rings">
        {groups.map(g => (
          <div key={g.id} className="ring box">
            <div className="ring-head">
              <b>{g.name}</b>
              <button className="linkish danger" onClick={async () => { await api.admin.deleteGroup(g.id); load(); }}>disband</button>
            </div>
            <div className="vischecks">
              {users.map(u => {
                const inRing = members.some(m => m.group_id === g.id && m.user_id === u.id);
                return (
                  <label key={u.id}>
                    <input type="checkbox" checked={inRing}
                           onChange={() => api.admin.member(g.id, u.id, inRing).then(load)} />
                    {u.username}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
        {groups.length === 0 && <p className="dim">No rings yet. Every moorket is either for everyone or named individuals.</p>}
      </div>
    </div>
  );
}

// ---------- inbox (suggestions) ----------
function Inbox() {
  const [data, setData] = useState(null);
  const load = () => api.admin.suggestions().then(setData);
  useEffect(() => { load(); }, []);
  if (!data) return <p className="dim">…</p>;
  const pend = (s) => s.status === 'pending';
  const ms = data.market_suggestions, rs = data.resolution_suggestions;

  return (
    <div>
      <h3 className="subhead">suggested moorkets</h3>
      {ms.length === 0 ? <p className="dim">The inbox is empty.</p> : (
        <ul className="inbox">
          {ms.map(s => (
            <li key={s.id} className={`sug s-${s.status}`}>
              <div className="sug-head"><b>{s.title}</b> <span className="dim">— {s.username} · {fmtTime(s.created_at)}</span> <span className={`sugtag s-${s.status}`}>{s.status}</span></div>
              {s.description && <p>{s.description}</p>}
              <p className="dim">outcomes: {JSON.parse(s.outcomes).join(' / ')}</p>
              <p className="dim">case: {s.explanation}</p>
              {pend(s) && (
                <div className="admin-row">
                  <button onClick={async () => { await api.admin.marketSuggestion(s.id, 'approve'); load(); }}>open it</button>
                  <button className="linkish" onClick={async () => {
                    const n = prompt('dismissal note (optional):');
                    await api.admin.marketSuggestion(s.id, 'dismiss', n || ''); load();
                  }}>dismiss</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <h3 className="subhead">proposed resolutions</h3>
      {rs.length === 0 ? <p className="dim">Nobody's claiming anything.</p> : (
        <ul className="inbox">
          {rs.map(s => (
            <li key={s.id} className={`sug s-${s.status}`}>
              <div className="sug-head">
                <b>{s.market_number} {s.market_title}</b>
                <span className="dim"> — {s.username} says → <b>{s.outcome_label}</b> · {fmtTime(s.created_at)}</span>
                <span className={`sugtag s-${s.status}`}>{s.status}</span>
              </div>
              <p className="dim">{s.explanation}</p>
              {pend(s) && s.market_status !== 'resolved' && s.market_status !== 'cancelled' && (
                <div className="admin-row">
                  <button onClick={async () => {
                    await api.admin.resolutionSuggestion(s.id, 'accept');
                    navigate(`/markets/${s.market_id}`);
                  }}>take it to the moorket</button>
                  <button className="linkish" onClick={async () => {
                    const n = prompt('dismissal note (optional):');
                    await api.admin.resolutionSuggestion(s.id, 'dismiss', n || ''); load();
                  }}>dismiss</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
