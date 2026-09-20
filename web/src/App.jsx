import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
import Login from './pages/Login.jsx';
import Markets from './pages/Markets.jsx';
import MarketDetail from './pages/MarketDetail.jsx';
import Portfolio from './pages/Portfolio.jsx';
import Suggest from './pages/Suggest.jsx';
import Admin from './pages/Admin.jsx';
import Leaderboard from './pages/Leaderboard.jsx';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function navigate(to) {
  history.pushState(null, '', to);
  dispatchEvent(new PopStateEvent('popstate'));
}

// one-bit icons, drawn not glyph'd
const I = {
  book: <svg viewBox="0 0 16 16"><path d="M2 2h9v12H2z M4 5h5M4 7h5M4 9h3 M13 4l1-1v12l-1-1" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>,
  purse: <svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M8 4.5v7M6 6h4M6 10h4" stroke="currentColor" strokeWidth="1.5"/></svg>,
  board: <svg viewBox="0 0 16 16"><path d="M2 14V8h3v6zM6.5 14V5h3v9zM11 14V2h3v12z" fill="currentColor"/></svg>,
  ledger: <svg viewBox="0 0 16 16"><rect x="2" y="2" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M5 5h6M5 8h6M5 11h4" stroke="currentColor" strokeWidth="1.5"/></svg>,
  quill: <svg viewBox="0 0 16 16"><path d="M12 2l2 2-8 8-3 1 1-3z M10 4l2 2" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>,
  paint: <svg viewBox="0 0 16 16"><rect x="3" y="9" width="10" height="5" fill="none" stroke="currentColor" strokeWidth="1.5"/><path d="M8 9V5.5M8 5.5a2.5 2.5 0 1 1 2.5-2.5" fill="none" stroke="currentColor" strokeWidth="1.5"/></svg>,
};

const NAV = [
  { to: '/', label: 'The Book', icon: I.book },
  { to: '/portfolio', label: 'Positions', icon: I.purse },
  { to: '/board', label: 'The Board', icon: I.board },
  { to: '/ledger', label: 'Ledger', icon: I.ledger },
  { to: '/suggest', label: 'Suggest', icon: I.quill },
];

export default function App() {
  const [user, setUser] = useState(null);
  const [route, setRoute] = useState(location.pathname);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    const onPop = () => setRoute(location.pathname);
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, []);

  const refresh = useCallback(async () => {
    try { setUser((await api.me()).user); } catch { setUser(null); }
  }, []);

  useEffect(() => { refresh().finally(() => setBooted(true)); }, [refresh]);

  if (!booted) return <div className="boot">loading the shoebox…</div>;
  if (!user) return <Login onLogin={setUser} />;

  const nav = [...NAV, ...(user.role === 'admin' ? [{ to: '/admin', label: 'Paint', icon: I.paint }] : [])];
  const cardIdx = nav.findIndex(n => n.to === route) ?? -1;

  let page, cardTitle;
  const mm = route.match(/^\/markets\/(\d+)/);
  if (mm) { page = <MarketDetail id={mm[1]} />; cardTitle = 'Moorket'; }
  else if (route === '/portfolio') { page = <Portfolio />; cardTitle = 'Positions'; }
  else if (route === '/board') { page = <Leaderboard />; cardTitle = 'The Board'; }
  else if (route === '/ledger') { page = <Ledger />; cardTitle = 'Ledger'; }
  else if (route === '/suggest') { page = <Suggest />; cardTitle = 'Suggest'; }
  else if (route === '/admin' && user.role === 'admin') { page = <Admin />; cardTitle = 'Paint'; }
  else { page = <Markets />; cardTitle = 'The Book'; }

  return (
    <Ctx.Provider value={{ user, refresh }}>
      <div className="stack">
        <header className="menubar">
          <a className="wordmark" href="/" onClick={e => { e.preventDefault(); navigate('/'); }}>polymoorket</a>
          <nav className="menus">
            {nav.map(n => (
              <a key={n.to} href={n.to} className={route === n.to ? 'on' : ''}
                 onClick={e => { e.preventDefault(); navigate(n.to); }}>{n.label}</a>
            ))}
          </nav>
          <div className="who">
            <span className="balance">₿{user.balance.toLocaleString()}</span>
            <span className="uname">{user.username}</span>
            <button className="btn small" onClick={async () => { await api.logout(); setUser(null); }}>leave</button>
          </div>
        </header>

        <div className="table">
          <aside className="contents">
            <div className="contents-head">stack contents<span>{nav.length} cards</span></div>
            <ol>
              {nav.map((n, i) => (
                <li key={n.to} className={route === n.to ? 'on' : ''}>
                  <a href={n.to} onClick={e => { e.preventDefault(); navigate(n.to); }}>
                    {n.icon}<span>{n.label}</span><i>{i + 1}</i>
                  </a>
                </li>
              ))}
            </ol>
          </aside>

          <main className="card" key={route}>
            <div className="card-head">{cardTitle}</div>
            <div className="card-body">{page}</div>
          </main>

          <aside className="rail">
            <Purse />
            <MiniBoard />
          </aside>
        </div>

        <footer className="pager">
          <PagerArrow dir={-1} nav={nav} route={route} />
          <span className="stackicon">{I.book}</span>
          <span className="pager-pos">{cardIdx >= 0 ? `${cardIdx + 1} of ${nav.length}` : `· of ${nav.length}`}</span>
          <PagerArrow dir={1} nav={nav} route={route} />
        </footer>
      </div>
    </Ctx.Provider>
  );
}

function PagerArrow({ dir, nav, route }) {
  const idx = Math.max(0, nav.findIndex(n => n.to === route));
  const target = nav[(idx + dir + nav.length) % nav.length];
  return (
    <button className="btn pager-btn" onClick={() => navigate(target.to)} aria-label={dir < 0 ? 'previous card' : 'next card'}>
      <svg viewBox="0 0 16 16">{dir < 0 ? <path d="M11 2L4 8l7 6z" fill="currentColor"/> : <path d="M5 2l7 6-7 6z" fill="currentColor"/>}</svg>
    </button>
  );
}

function Purse() {
  const { user } = useApp();
  const [entries, setEntries] = useState([]);
  useEffect(() => { api.ledger().then(d => setEntries(d.entries.slice(0, 4))).catch(() => {}); }, [user.balance]);
  return (
    <div className="widget">
      <div className="widget-head">purse</div>
      <div className="purse-total">₿{user.balance.toLocaleString()}</div>
      <ul className="mini-ledger">
        {entries.map(e => (
          <li key={e.id}><span className={e.amount >= 0 ? 'pos' : 'neg'}>{e.amount >= 0 ? '+' : ''}{e.amount}</span><span className="dim">{e.kind}</span></li>
        ))}
        {entries.length === 0 && <li className="dim">no movement yet</li>}
      </ul>
      <button className="btn wide" onClick={() => navigate('/ledger')}>full ledger</button>
    </div>
  );
}

function MiniBoard() {
  const [rows, setRows] = useState([]);
  useEffect(() => { api.leaderboard().then(d => setRows(d.leaderboard.slice(0, 4))).catch(() => {}); }, []);
  return (
    <div className="widget">
      <div className="widget-head">the board</div>
      <ol className="mini-board">
        {rows.map((r, i) => (
          <li key={r.id}><span className="rank">{i + 1}</span><span className="bname">{r.username}</span><span className="num">₿{r.balance}</span></li>
        ))}
      </ol>
      <button className="btn wide" onClick={() => navigate('/board')}>full board</button>
    </div>
  );
}

function Ledger() {
  const [entries, setEntries] = useState(null);
  useEffect(() => { api.ledger().then(d => setEntries(d.entries)); }, []);
  if (!entries) return <p className="dim">loading…</p>;
  return (
    <section>
      <p className="lede">Every beetcoin that ever moved, in order.</p>
      {entries.length === 0 ? <Empty text="Nothing yet. Stake something." /> : (
        <table className="table-list">
          <thead><tr><th>when</th><th>what</th><th className="num">amount</th><th className="num">balance</th></tr></thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id}>
                <td className="dim">{fmtTime(e.created_at)}</td>
                <td><span className={`kind`}>{e.kind}</span> <span className="dim">{e.note} {e.ref}</span></td>
                <td className={`num ${e.amount >= 0 ? 'pos' : 'neg'}`}>{e.amount >= 0 ? '+' : ''}{e.amount}</td>
                <td className="num">{e.balance_after}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

export function Empty({ text }) {
  return (
    <div className="empty">
      <svg className="empty-mark" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="4 3"/></svg>
      {text}
    </div>
  );
}

export function fmtTime(s) {
  if (!s) return '—';
  return new Date(s + 'Z').toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function pct(x) {
  if (x === null || x === undefined) return '—';
  return `${Math.round(x * 100)}%`;
}
