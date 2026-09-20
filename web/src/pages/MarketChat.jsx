import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { fmtTime } from '../App.jsx';

export default function MarketChat({ marketId }) {
  const [messages, setMessages] = useState([]);
  const [body, setBody] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    setMessages([]);
    let dead = false, poll = null;
    const add = m => setMessages(ms => ms.some(x => x.id === m.id) ? ms : [...ms, m].slice(-80));
    api.chat(marketId).then(d => !dead && setMessages(d.messages)).catch(() => {});
    const es = new EventSource(`/api/markets/${marketId}/chat/stream`);
    es.onmessage = e => { try { add(JSON.parse(e.data)); } catch {} };
    es.onerror = () => {
      // stream blocked or dropped — poll instead
      if (!poll) poll = setInterval(() => api.chat(marketId).then(d => !dead && setMessages(d.messages)).catch(() => {}), 4000);
    };
    return () => { dead = true; es.close(); if (poll) clearInterval(poll); };
  }, [marketId]);

  useEffect(() => { listRef.current?.scrollTo(0, listRef.current.scrollHeight); }, [messages]);

  async function send(e) {
    e.preventDefault();
    const text = body.trim();
    if (!text) return;
    setBody('');
    try {
      const r = await api.postChat(marketId, text);
      setMessages(ms => ms.some(x => x.id === r.message.id) ? ms : [...ms, r.message].slice(-80));
    } catch {}
  }

  return (
    <div className="widget chat">
      <div className="widget-head">chatter</div>
      <ul className="chat-list" ref={listRef}>
        {messages.length === 0 && <li className="dim">quiet in here. heckle the book.</li>}
        {messages.map(m => (
          <li key={m.id}>
            <span className="chat-who"><b>{m.username}</b><i>{fmtTime(m.created_at)}</i></span>
            <span className="chat-body">{m.body}</span>
          </li>
        ))}
      </ul>
      <form className="chat-form" onSubmit={send}>
        <input value={body} onChange={e => setBody(e.target.value)} maxLength={280}
               placeholder="say it…" aria-label="chat message" />
        <button type="submit" className="btn">say</button>
      </form>
    </div>
  );
}
