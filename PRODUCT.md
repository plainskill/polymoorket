# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: Node.js + Express + better-sqlite3 backend serving a Vite + React SPA. Single Dockerfile; SQLite lives at /data so shipd's persistent volume keeps state across deploys. Chosen because the trading UI wants a rich client and shipd wants one self-contained HTTP container.

## Users

A private group of ~5 friends. One admin runs the operation (accounts, markets, groups, resolutions); everyone else logs in and trades. There is no anonymous/public audience — markets are private by definition.

## Product Purpose

polymoorket is a parody of Polymarket: a members-only prediction market where friends stake play money on questions about their own world. Success = people log in, argue about odds, stake beetcoin, and nag the admin to resolve.

## Positioning

Pari-mutuel pools, not an order book or % cashout: any stake size goes into an outcome's pool, and winners split the whole pot pro-rata. Thin markets still work — with 5 people an order book would sit empty, a tote always has a price.

## Operating Context

- Deployed via shipd (git repo → docker container → subdomain, TLS at the edge).
- Persistent state must live under /data inside the container.
- The health probe expects an HTTP response on `/` before promotion.
- Admin workflow: create accounts, set passwords, create markets, gate markets to users/groups, resolve markets, review user suggestions.
- User workflow: log in → see markets visible to them → stake beetcoin → track positions → suggest markets/resolutions with an explanation.

## Capabilities and Constraints

- Accounts are provisioned by admin only; no self-registration.
- Markets have 2+ outcomes (YES/NO default). Each outcome holds a pool; implied odds = pool share.
- Stakes are final once placed (no cash-out; resolution pays out).
- Users can suggest (a) new markets and (b) resolutions for existing markets, each with a required explanation. Admin approves/dismisses.
- Market visibility: everyone, or restricted to named users/groups.
- Currency: **beetcoin** (play money; admin can grant/adjust balances).

## Brand Commitments

- Name: polymoorket (Polymarket parody).
- Markets are called **moorkets**. Never brand anything as standalone "moor" — polymoorket and moorket are the words; "the moor" alone is out.
- Currency: beetcoin.
- Tone: playful but functional — the joke lands because the machine genuinely works.

## Evidence on Hand

None — greenfield. All market content will be seeded or user-generated; no real claims, prices, or testimonials may be fabricated.

## Product Principles

1. The tote always has a price — pari-mutuel pools mean even one bettor makes a market.
2. Private by default — nothing is visible without an account; visibility is per-market.
3. The parody is the polish — it should look like a real book was opened on the moor.
4. Admin is a job, not a chore — the dashboard should make running the thing fun.
