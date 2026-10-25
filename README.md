# 🕹️ Game Pass — Arcade Spend & Rewards

A mobile-first app for a physical arcade. An **attendant** logs what a guest buys —
either **game time** (₦1,000/hour, which starts a heads-up countdown then a play
timer on the guest's phone) or an **item** sold in the playground. Everything a
guest spends on their account unlocks **rewards** at spend milestones. Guests sign
in with **just a phone number** to watch their live game timer, see what they've
spent, and redeem rewards. Attendants can also log a walk-in sale without a
phone number; that sale counts in revenue but is not credited to a member.

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

For a customer who declines to share a phone number, the attendant selects
**Walk-in · no phone** before reviewing the order. The game timer still appears
in Time keeping at the desk, and the sale is included in revenue and item profit.
It does not create a member account, increase member spend, or unlock rewards.

## Item gross profit

Operators set an item's selling price and cost price on the Items page. New items
require both prices; existing items can be given a cost price when it is known.
Each item sale saves the cost that was current at checkout, so later price changes
do not alter historical results. Analytics shows item revenue, recorded cost of
goods sold, gross profit, margin, and cost coverage for each period and item.
Sales made before cost tracking (or before an existing item's cost was set) remain
in revenue but are excluded from gross profit. Voided sales are excluded from
both. Gross profit does not include game costs or other business expenses.

## Recording missed sales

Admins and managers can use **Sales → Record missed sale** to add an item or game
that an attendant did not log. Enter the date in the venue timezone, quantity,
and selling price paid. The time and member phone are optional. Without a phone,
the sale remains a walk-in and does not credit member spend or rewards. Without a
time, it counts on the chosen date and appears under **No time** in today's
hourly analytics rather than being assigned an invented hour. Manual
entries carry a visible tag, operator name, entry timestamp, and optional note;
they never start a live game timer. Item cost can be entered for accurate profit
or left unknown. Tracked stock is adjusted only if the operator leaves that
option on, so already-reconciled inventory is not deducted twice.

## Surfaces

| Surface | URL | Who |
|---|---|---|
| **Player app** | `/home` | guests — phone-only sign-in; live timers, total spent, redeem rewards |
| **Attendant** | `/attendant` | staff — charge a game or sell an item with a phone number or as a walk-in guest |
| **Operator** | `/admin` | operators — games, items, spend rewards, players, logs, heads-up setting |

## Public website, gallery, and search

The public `/` page includes venue information, opening hours, a photo gallery,
directions, and common visitor questions. The owner admin can add, caption,
hide, and re-show real venue photos at `/admin/website`. Uploads go from the
server to Cloudinary and photo details are stored in MongoDB. JPEG, PNG, and
WebP images up to 4 MB are accepted. Obtain permission before publishing photos
of identifiable visitors, especially children. The gallery shows an honest
placeholder until photos are uploaded.

Set `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and
`CLOUDINARY_API_SECRET` as private deployment environment variables. They are
not used in client-side code. `SITE_URL` defaults to `https://creamycastle.com`.
If the business has a written street address, set `BUSINESS_STREET_ADDRESS`
(and optionally `BUSINESS_REGION`); otherwise the page uses the confirmed Maps
pin and Ogidi locality without inventing a street address. The phone and
opening hours in `app/page.tsx` reflect the owner's October 2026 details; update
them when the venue changes them.

The site publishes `/sitemap.xml`, `/robots.txt`, a canonical URL, social
preview metadata, and LocalBusiness structured data. Admin, attendant, and
member routes send a `noindex` header. After deployment, verify the domain in
Google Search Console, submit `https://creamycastle.com/sitemap.xml`, and
inspect the homepage URL for indexing. Claim the existing Creamy Castle Maps
listing when setting up Google Business Profile instead of creating a duplicate;
ensure its hours, phone, category, photos, and website match the live site.
Indexing and search position are controlled by Google, not guaranteed by these
changes.

## Run it locally

Needs a MongoDB instance. `MONGODB_URI` is **required** — there is no localhost
fallback. Point it at the same MongoDB Atlas cluster you use in production (so
local dev and live share data) or at a local `mongod`.

```bash
npm install
npm run dev        # http://localhost:3005
```

The database **seeds itself** on first request with the operator + attendant
logins and default settings. Add games, items, and rewards from the operator
console (`/admin`).

Config (`.env`):
```
# Atlas (shared with production) or a local mongod — required, no default.
MONGODB_URI="mongodb+srv://user:pass@cluster.xxxx.mongodb.net"
MONGODB_DB="gamepass"
AUTH_SECRET="a-random-32-byte-string"
```

### Seeded logins
- **Player:** any phone number — no password.
- **Attendant:** `/attendant` — `frontdesk` / `attend1234`.
- **Operator:** `/admin` — `admin@arcade.test` / `admin1234` (also `staff@arcade.test` / `staff1234`).

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

> **Troubleshooting.** If the app returns 500s / "Something went wrong" and the
> logs show a TLS `alert number 80` (`tlsv1 alert internal error`), the Atlas
> cluster is almost certainly **paused** (free M0 clusters auto-pause after ~60
> days) or the connection string points at a deleted/renamed cluster. Resume or
> recreate it in the Atlas dashboard, update `MONGODB_URI`, and confirm the IP
> access list allows your dev machine and the host's egress.

(Also deploys to Vercel or any Node host — it's a standard Next.js app.)
