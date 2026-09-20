async function req(path, opts = {}) {
  const res = await fetch(`/api${path}`, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    ...opts,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}

export const api = {
  login: (username, password) => req('/login', { method: 'POST', body: { username, password } }),
  logout: () => req('/logout', { method: 'POST' }),
  me: () => req('/me'),
  markets: () => req('/markets'),
  market: (id) => req(`/markets/${id}`),
  bet: (id, outcome_id, amount) => req(`/markets/${id}/bets`, { method: 'POST', body: { outcome_id, amount } }),
  suggestResolution: (id, outcome_id, explanation) =>
    req(`/markets/${id}/suggest-resolution`, { method: 'POST', body: { outcome_id, explanation } }),
  chat: (id) => req(`/markets/${id}/chat`),
  postChat: (id, body) => req(`/markets/${id}/chat`, { method: 'POST', body: { body } }),
  portfolio: () => req('/portfolio'),
  ledger: () => req('/ledger'),
  leaderboard: () => req('/leaderboard'),
  pay: (body) => req('/pay', { method: 'POST', body }),
  suggestMarket: (body) => req('/suggestions/market', { method: 'POST', body }),
  mySuggestions: () => req('/suggestions/mine'),
  admin: {
    overview: () => req('/admin/overview'),
    users: () => req('/admin/users'),
    createUser: (body) => req('/admin/users', { method: 'POST', body }),
    patchUser: (id, body) => req(`/admin/users/${id}`, { method: 'PATCH', body }),
    deleteUser: (id) => req(`/admin/users/${id}`, { method: 'DELETE' }),
    createGroup: (name) => req('/admin/groups', { method: 'POST', body: { name } }),
    deleteGroup: (id) => req(`/admin/groups/${id}`, { method: 'DELETE' }),
    member: (gid, user_id, remove) => req(`/admin/groups/${gid}/members`, { method: 'POST', body: { user_id, remove } }),
    markets: () => req('/admin/markets'),
    createMarket: (body) => req('/admin/markets', { method: 'POST', body }),
    patchMarket: (id, body) => req(`/admin/markets/${id}`, { method: 'PATCH', body }),
    resolve: (id, outcome_id, note, as_of) => req(`/admin/markets/${id}/resolve`, { method: 'POST', body: { outcome_id, note, as_of } }),
    cancel: (id, note) => req(`/admin/markets/${id}/cancel`, { method: 'POST', body: { note } }),
    suggestions: () => req('/admin/suggestions'),
    marketSuggestion: (id, action, note) => req(`/admin/suggestions/market/${id}`, { method: 'POST', body: { action, note } }),
    resolutionSuggestion: (id, action, note) => req(`/admin/suggestions/resolution/${id}`, { method: 'POST', body: { action, note } }),
  },
};
