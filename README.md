# 🕹️ Game Pass — Arcade Spend & Rewards

A mobile-first app for a physical arcade. An **attendant** logs what a guest buys —
either **game time** (₦1,000/hour, which starts a heads-up countdown then a play
timer on the guest's phone) or an **item** sold in the playground. Everything a
guest spends unlocks **rewards** at spend milestones. Guests sign in with **just a
phone number** to watch their live game timer, see what they've spent, and redeem
rewards.

> Buy a game or item → attendant logs it → your spend unlocks rewards.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript** + **Tailwind 4**
- **MongoDB** via the official driver — one catch-all API route + a domain engine
- Session auth via signed (HMAC) httpOnly cookies — no session table
- Catalogue uses **icons** (not images); player app is a **desktop sidebar /
  mobile bottom-nav** responsive shell

## How a game purchase works

1. Attendant charges a game (e.g. Teens Games, ₦1,000 × 1 hour) against the guest's
   phone.
2. The guest's phone shows a short **heads-up countdown** (default 60s, configurable
   in admin) so they can walk to the game…
3. …then the **play timer** runs. A game **counts as played** when the hour
   finishes; the **spend counts immediately**.
4. Items add to spend with no timer.

## Surfaces

| Surface | URL | Who |
|---|---|---|
| **Player app** | `/home` | guests — phone-only sign-in; live timers, total spent, redeem rewards |
| **Attendant** | `/attendant` | staff — look up a guest by phone; charge a game or sell an item |
| **Operator** | `/admin` | operators — games, items, spend rewards, players, logs, heads-up setting |

## Run it locally

Needs a MongoDB instance. With a local `mongod` running (default
`mongodb://localhost:27017`):

```bash
npm install
npm run dev        # http://localhost:3005
```

The database **seeds itself** on first request (2 games — Kids Games & Teens Games,
items, spend rewards, admin accounts, settings).

Config (`.env`):
```
MONGODB_URI="mongodb://localhost:27017"
MONGODB_DB="gamepass"
AUTH_SECRET="a-random-32-byte-string"
```

### Demo access
- **Player:** any phone number — no password.
- **Attendant:** open `/attendant` (no login in the demo).
- **Operator:** `admin@arcade.test` / `admin1234` (also `staff@arcade.test` / `staff1234`).

## Where the code lives

```
lib/mongo.ts            Mongo client (cached) + first-run seed
lib/server/types.ts     document shapes
lib/server/db.ts        typed collection handles
lib/server/session.ts   signed-cookie sessions (node:crypto)
lib/server/engine.ts    the domain engine: auth, player home/rewards, attendant
                        purchase (game timer / item), and the whole admin surface
app/api/[...path]/route.ts   catch-all dispatcher → engine, applies login/logout cookies
lib/client.ts           api() fetch wrapper used by the pages
app/(app)/…             player app     app/attendant/…  attendant     app/admin/…  operator
```

## Deploy on Netlify

1. **Create a MongoDB Atlas cluster** (free tier) and copy its SRV connection
   string (`mongodb+srv://user:pass@cluster.xxxx.mongodb.net`). In Atlas → Network
   Access, allow access from anywhere (or Netlify's egress) so the functions can
   connect.
2. **Connect the repo** in Netlify. `netlify.toml` runs `next build` with the
   Next.js runtime plugin.
3. **Set environment variables** (Site settings → Environment variables):
   - `MONGODB_URI` — the Atlas SRV string
   - `MONGODB_DB` — e.g. `gamepass`
   - `AUTH_SECRET` — a random 32-byte string
4. **Deploy.** The DB seeds itself on first request. Sign in at `/admin` with
   `admin@arcade.test` / `admin1234`.

(Also deploys to Vercel or any Node host — it's a standard Next.js app.)
