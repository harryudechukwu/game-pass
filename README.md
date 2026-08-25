# 🕹️ Game Pass — Arcade Rewards (Demo)

A mobile-first demo for a physical arcade. Guests play real games at the venue; an
**attendant logs each game** they played, and the guest sees it in their app and
**unlocks milestone rewards** the more they play.

> Play a game → attendant logs it → unlock &amp; redeem rewards.

## Demo build — no server, no database

Everything runs **in the browser** in `localStorage`. No backend, no database, no
environment variables. The **player app**, the **attendant console** and the
**admin console** all run in the same browser and share the same store, so the
whole flow works on **one device** — open the player app and the attendant console
in two tabs and watch a logged game appear live.

## Three surfaces

| Surface | URL | Who | Can do |
|---|---|---|---|
| **Player app** | `/home` | guests | log in with **just a phone number**; view games they've played; redeem unlocked rewards |
| **Attendant console** | `/attendant` | venue staff | pull up a player by phone, pick the game, **log it** |
| **Operator console** | `/admin` | operators | manage games, set milestone rewards, view players & logs |

Only the attendant can log a play. Players can only **view and redeem** — never
log their own games.

## The flow

1. A guest plays a physical game at the venue.
2. They go to the attendant, who finds them by phone and **logs the game** (this is
   the only write of a play — a QR-based method can slot in behind the same action
   later).
3. It appears instantly on the player's home feed as a banner.
4. Rewards are **milestones**: an admin sets "games needed" (e.g. play 5 games → one
   free play). Once a player reaches the threshold, the reward becomes claimable;
   redeeming reveals a **claim code** the attendant honours.

## Run it

```bash
npm install
npm run dev      # http://localhost:3005
```

The store seeds itself (games, rewards, admin accounts) on first load.

### Demo access
- **Player:** any phone number — no password; first time signs you up.
- **Attendant:** open `/attendant` (no login in the demo) and log a game against a
  phone number.
- **Operator:** `admin@arcade.test` / `admin1234` (also `staff@arcade.test` /
  `staff1234`).

Reset the demo in devtools: `localStorage.removeItem("gamepass_demo_v2")`.

## Where the logic lives

```
lib/local/store.ts   entities (players, games, gameLogs, rewards, redemptions),
                     localStorage load/save + seed
lib/local/api.ts     in-browser engine: phone login, player feed + rewards/redeem,
                     attendant log-a-game, and the admin surface
lib/client.ts        api() — dispatches page calls to the engine
app/(app)/…          player app (home feed + rewards, mobile shell)
app/attendant/…      attendant console
app/admin/…          operator console
```

## Deploy on Netlify

No env vars, no database. Connect the GitHub repo in Netlify → it picks up
`netlify.toml` (`next build` + the Next.js runtime plugin) → deploy. (Vercel or any
Next host works too.)
