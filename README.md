# 🕹️ Game Pass — Self-Service Physical Arcade (Demo)

A mobile-first demo where customers use **digital points** to access and play
**real-world physical games** (soccer challenge, basketball, racing rig, bouncy
castle, VR arena, mini-golf…) at an entertainment centre.

The app is the customer's **digital wallet and access pass**. The fun happens on
the arcade floor:

> **Choose activity → Pay with points → Scan → Physical game starts.**

## Demo build — no server, no database

Everything runs **in the browser**. All state (customers, wallet ledger, games,
Play Passes, sessions, rewards, purchases) lives in **`localStorage`**, so:

- No backend, no database, no environment variables — just open it and use it.
- The **customer app**, the **station kiosk** and the **operator console** all
  run in the same browser and share the same store, so the full end-to-end flow
  works on **one device**.
- Data persists on that device until you clear it (or hit reset).

> This is a demo/prototype, not a production system — the "backend as source of
> truth" security model would move this logic to a real server + DB. The domain
> logic here (atomic wallet ledger, single-use Play Passes, configurable reward
> engine, the 7 activation checks) is intact; it just runs client-side.

## Tech stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 4** — themed as **Duolingo** style (chunky 3D buttons, Nunito,
  playful icon-pattern background) with a **light/dark toggle**
- **`localStorage`** engine in [`lib/local/`](lib/local) — the old REST API was
  replaced by an in-browser dispatcher, so the pages didn't change
- Server-side **`qrcode`** → client-side **SVG** QR generation
- Point purchases are **simulated**

## Three surfaces

| Surface | URL | Who |
|---|---|---|
| **Customer app** | `/home` | players (phone + OTP) |
| **Game Station** (kiosk sim) | `/station` | the physical game / staff |
| **Operator console** | `/admin` | arcade operators |

A landing hub at `/` links to all three.

## Run it

```bash
npm install
npm run dev      # http://localhost:3005
```

That's it — the store seeds itself (games, rewards, packages, admin accounts) on
first load.

### Demo access
- **Customer:** enter any phone number → the OTP is shown on screen. New numbers
  register (name + DOB + terms) and receive the **100-point welcome bonus**.
- **Operator:** `admin@arcade.test` / `admin1234` (also `staff@arcade.test` /
  `staff1234`).
- **Station:** from a Play Pass screen tap **"Open station simulator"** to jump
  to the kiosk with the scanned token pre-filled (open it in another tab — it
  shares the same browser store).

## The end-to-end flow

1. **Sign up / log in** — phone + OTP; registration grants the signup bonus.
2. **Browse the catalogue** — physical games with cost, duration, players,
   location, age/height requirements, rules and safety notes.
3. **Confirm & buy a Play Pass** — a confirmation screen shows the remaining
   balance before points are spent.
4. **Play Pass** — a single-use SVG QR that expires after a short window; unused
   passes are auto-refunded.
5. **Scan at the station** — runs the 7 validation checks, returns **PLAY
   AUTHORIZED**, starts a session (with an expected end time).
6. **Rewards** — on completion the configurable reward engine credits points
   (play completed, high score, every 3rd game, first visit).

## Where the logic lives

```
lib/local/store.ts   entities, localStorage load/save, seed data
lib/local/api.ts     the in-browser engine: auth/otp, wallet ledger, play-pass
                     lifecycle, station (activate/start/complete/fault), rewards,
                     purchases, and the whole admin surface
lib/client.ts        api() — dispatches page calls to the engine (was fetch)
app/(app)/…          customer app (mobile shell + bottom nav)
app/station/…        kiosk simulator
app/admin/…          operator console
```

To reset the demo: clear the site's storage in devtools (or
`localStorage.removeItem("gamepass_demo_v1")`).

## Deploy on Netlify

No env vars, no database. Connect the GitHub repo in Netlify → it picks up
`netlify.toml` (`next build` + the Next.js runtime plugin) → deploy. Done.
(Also deploys cleanly to Vercel or any static-friendly Next host.)
