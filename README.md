# polymoorket

A private Polymarket parody for ~5 friends. Pari-mutuel moorkets, staked in **beetcoin** — winners split the whole pool pro-rata. One-bit HyperCard-shoebox UI.

## What it is

- **Moorkets** — questions with 2+ outcomes. Anyone stakes any amount on an outcome while the book is open. Implied odds = pool share. On resolution the entire pool pays out pro-rata to winners; if nobody backed the winner (or the admin cancels), stakes refund.
- **Accounts** — created by the admin only; there is no signup. Sessions are cookie-based.
- **Rings** — groups that gate restricted moorkets (a restricted moorket is visible to named users and ring members only).
- **Suggestions** — users propose new moorkets and resolutions with a required explanation; the admin approves or dismisses from the inbox.
- **Paint** — the admin surface: desk stats, moorkets, punters, rings, inbox.

## Stack

Node + Express + better-sqlite3 (server/), Vite + React SPA (web/). SQLite file lives at `DATA_DIR` (defaults to `/data` when present — shipd's persistent mount — else `./data`).

## Dev

```sh
npm ci
npm run dev        # vite on :5173, proxies /api → :3000
ADMIN_PASSWORD=carrots npm run serve   # API + built app on :3000
```

First run creates the `admin` account: `ADMIN_PASSWORD` env wins, otherwise a random password is printed to the log. A few seed moorkets are planted on an empty DB.

## Deploy (shipd)

`Dockerfile` + `shipd.json` are in the root. Push the repo to the forge, then:

```sh
shipd deploy polymoorket --env ADMIN_PASSWORD=<secret>
```

State persists across redeploys via shipd's `/data` mount.

## Screenshot tool

`node scripts/shot.mjs <path> <out.png> [user] [pass]` — headless-chromium screenshots for visual iteration (playwright-core, system chromium).
