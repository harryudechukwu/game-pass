# 🕹️ Game Pass — Arcade Spend & Rewards (Demo)

A mobile-first demo for a physical arcade. An **attendant** logs what a guest buys —
either **game time** (₦1,000/hour, which starts a countdown on the guest's phone)
or an **item** sold in the playground. Everything a guest spends unlocks **rewards**
at spend milestones. Guests sign in with **just a phone number** to watch their live
game timer, see what they've spent, and redeem rewards.

> Buy a game or item → attendant logs it → your spend unlocks rewards.

## How a game purchase works

1. Attendant charges the game (e.g. Racing Simulator, ₦1,000 × 1 hour) against the
   guest's phone.
2. The guest's phone shows a short **heads-up countdown** (default 60s — configurable
   in admin) so they can walk to the game location…
3. …then the **1-hour play timer** runs. The game **counts as played** when the hour
   finishes. The **spend counts immediately**.
4. Items (drinks, snacks, tokens, merch) are logged the same way but have no timer —
   they just add to spend.

## Demo build — no server, no database

Everything runs **in the browser** in `localStorage`. No backend, no env vars. The
**player app**, **attendant console** and **admin console** share one browser store,
so it all works on **one device** — open the player app and the attendant console in
two tabs and watch a purchase (and its timer) appear live.

## Surfaces

| Surface | URL | Who | Can do |
|---|---|---|---|
| **Player app** | `/home` | guests | phone-only sign-in; watch live game timers; see total spent; redeem rewards |
| **Attendant** | `/attendant` | staff | look up a guest by phone; charge a game (₦/hr) or sell an item |
| **Operator** | `/admin` | operators | games (Kids/Teen), items, spend rewards, players, logs, heads-up setting |

Catalogue entries use **icons** (not images). The player app is a **left-sidebar app
on desktop** and a **bottom-nav app on mobile**.

## Run it

```bash
npm install
npm run dev      # http://localhost:3005
```

Seeds itself (games in Kids/Teen categories, items, spend rewards, admin accounts).

### Demo access
- **Player:** any phone number — no password.
- **Attendant:** open `/attendant` (no login in the demo).
- **Operator:** `admin@arcade.test` / `admin1234` (also `staff@arcade.test` / `staff1234`).

Reset the demo: `localStorage.removeItem("gamepass_demo_v3")`.

## Where the logic lives

```
lib/local/store.ts   entities (players, games w/ category+price, items, purchases
                     w/ timers, spend rewards, settings) + seed
lib/local/api.ts     engine: phone login, player home (spend + live sessions + feed),
                     spend rewards, attendant purchase (game timer / item), admin
components/CatalogIcon.tsx      icon registry + picker (no images)
components/customer/SessionTimer.tsx   heads-up → play countdown
app/(app)/…          player app (responsive: sidebar desktop / bottom-nav mobile)
app/attendant/…      attendant console (two-column desktop)
app/admin/…          operator console
```

## Deploy on Netlify

No env vars, no database. Connect the GitHub repo in Netlify → `netlify.toml` runs
`next build` with the Next.js plugin → deploy. (Vercel or any Next host works too.)
