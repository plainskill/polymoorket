# AGENTS.md

polymoorket — private pari-mutuel prediction market parody (Polymarket parody). See PRODUCT.md (product truth) and DESIGN.md (the "Shoebox Book" one-bit HyperCard visual world — committed, don't drift from it).

## Conventions

- Markets are **moorkets**; never brand anything as standalone "moor". Currency is **beetcoin** (`₿`).
- Backend: `server/` (Express + better-sqlite3). DB lives at `$DATA_DIR` (`/data` on shipd). No migrations framework — schema in `server/db.js` CREATE TABLE IF NOT EXISTS.
- Frontend: `web/` Vite+React SPA, hand-rolled hashless history router in `App.jsx`. Design language: one-bit ink/paper, stipple-dot grays, hand-drawn wobble radii, Silkscreen pixel face for chrome/numerals, Geneva stack for body. Pressed/active = solid ink inversion.
- Pari-mutuel payout: winners split total pool pro-rata, largest-remainder rounding, full pot distributed; empty winning pool or cancel → refund all.
- Verification: `npm run build`, then `ADMIN_PASSWORD=carrots DATA_DIR=./data node server/index.js` and `node scripts/shot.mjs <path> <out.png> <user> <pass>` for screenshots.
- Deploy: push to forge, `shipd deploy <subdomain> --env ADMIN_PASSWORD=...`.
