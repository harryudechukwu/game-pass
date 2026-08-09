# 🕹️ Game Pass — Self-Service Physical Arcade

A mobile-first platform where customers use **digital points** to access and play
**real-world physical games** (soccer challenge, basketball, racing rig, bouncy
castle, VR arena, mini-golf…) at an entertainment centre.

The app is the customer's **digital wallet and access pass**. The fun happens on
the arcade floor:

> **Choose activity → Pay with points → Scan → Physical game starts.**

The backend is the **single source of truth** for balances, prices, play
authorization, rewards and session completion — the customer's device is never
trusted for any of them.

---

## Tech stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 4** — themed as **Duolingo dark-mode** (chunky 3D buttons,
  Nunito, playful icon-pattern background)
- **Prisma 6 + SQLite** — real ACID transactions, zero external services
- **jose** (signed JWT session cookies), server-side **qrcode** generation
- Payments are **simulated** (points are still only credited after a confirmed
  "payment", exactly like a real provider webhook would do)

## Three surfaces

| Surface | URL | Who |
|---|---|---|
| **Customer app** | `/home` | players (phone + OTP) |
| **Game Station** (kiosk sim) | `/station` | the physical game / staff |
| **Operator console** | `/admin` | arcade operators |

A landing hub at `/` links to all three.

---

## Getting started

```bash
npm install
npx prisma generate
npm run db:push      # create the SQLite schema
npm run db:seed      # games, rewards, packages, admin users
npm run dev          # http://localhost:3005
```

Reset everything: `npm run db:reset`.

### Demo access
- **Customer:** enter any phone number → the OTP is shown on screen (dev mode).
  New numbers register (name + DOB + terms) and receive the **100-point welcome
  bonus**.
- **Operator:** `admin@arcade.test` / `admin1234` (a `staff@arcade.test` /
  `staff1234` account also exists).
- **Station:** the kiosk key is pre-loaded. From a Play Pass screen, tap
  **"Open station simulator"** to jump straight to the kiosk with the token.

---

## The end-to-end flow

1. **Sign up / log in** — phone + OTP. Registration issues the configured signup
   bonus in the same DB transaction as account creation.
2. **Browse the catalogue** — physical games with cost, duration, players,
   location, age/height requirements, rules and safety notes.
3. **Confirm & buy a Play Pass** — a confirmation screen shows the remaining
   balance before points are debited (server-side price, atomic debit).
4. **Play Pass** — a single-use, non-transferable QR (generated server-side,
   expires after a configurable TTL). Unused/expired passes are auto-refunded.
5. **Scan at the station** — the kiosk runs the 7 backend validation checks,
   returns **PLAY AUTHORIZED**, and starts a session.
6. **Session** — `authorized → in progress → completed`, with the expected end
   time computed from the game's duration.
7. **Rewards** — on completion the configurable reward engine evaluates rules and
   credits points (every reward is its own ledger entry).

Play Pass lifecycle: `created → activated → in_progress → completed`
(`expired` / `cancelled` are terminal, and refund the customer).

---

## Where things live

```
prisma/schema.prisma      data model (customer, wallet ledger, games,
                          play passes, sessions, rewards, purchases, admin, audit)
lib/
  wallet.ts               transactional ledger — atomic credit/debit, no double-spend
  playpass.ts             create / cancel / expire+refund passes
  station.ts              Game Station API: activate (7 checks), start, complete, fault
  rewards.ts              configurable reward engine
  purchase.ts             initiate + confirm (simulated payment)
  auth.ts / otp.ts        customer & admin sessions, OTP issue/verify
  idempotency.ts          duplicate-request protection
app/api/…                 REST endpoints (customer, /station, /admin)
app/(app)/…               customer app screens (mobile shell + bottom nav)
app/station/…             kiosk simulator
app/admin/…               operator console
```

---

## Security model (backend is the source of truth)

- **Wallet:** append-only ledger + a mirrored `balance` mutated only inside the
  same transaction as its ledger row. Debits use an atomic conditional update
  (`balance >= amount`) so concurrent requests **can't double-spend or go
  negative**. An admin integrity view checks `balance == sum(ledger)`.
- **Play Passes:** single-use, server-generated QR token, short expiry, owner-only
  reads, not transferable, cannot be reused after activation or used for another
  game.
- **Activation** is **idempotent** (Idempotency-Key) and runs 7 checks: pass
  exists · belongs to a valid customer · not expired · not already used · game
  active · game matches pass · session not already started.
- **Roles:** customer sessions vs admin sessions vs the station shared key are
  fully separate. Destructive admin actions require the `admin` role.
- **Audit log:** registrations, activations, completions, wallet adjustments,
  game/reward changes, suspensions — all recorded.
- Never trusted from the client: balance, game price, play authorization, reward
  amount, session completion.

---

## Hardware integration

Physical machines are **not** coupled to the app. Everything goes through the
generic **Game Station API** (`/api/station/*`: lookup, activate, start, complete,
fault) authenticated with a station key. V1 ships a **software simulator** so the
whole system is testable without hardware; a real machine implements the same API
later — no app changes required.

## Configuration (`.env`)

```
SIGNUP_BONUS_POINTS=100      # welcome bonus
PLAY_PASS_TTL_SECONDS=120    # QR validity window
STATION_API_KEY=…            # shared secret for physical stations
OTP_DEV_MODE=true            # surface OTP in dev instead of sending SMS
```

Reward rules, games, and point packages are all **data** (managed in the admin
console / seed), not hardcoded.
