import { nanoid } from "nanoid";

// ─────────────────────────────────────────────────────────────
// Demo store — everything in the browser's localStorage. No server, no DB.
//
// Model: an ATTENDANT logs what a guest buys — either a GAME (₦/hour, which
// starts a heads-up countdown then a main play timer) or an ITEM sold in the
// playground. Everything a guest spends accrues to their total, and REWARDS
// unlock at spend thresholds. The guest signs in with just a phone number to
// watch their active game timers, see what they've spent, and redeem rewards.
//
// Money is stored in kobo (₦1 = 100 kobo). Dates are epoch-millisecond numbers.
// Catalogue entries use an icon key (see components/CatalogIcon), not images.
// ─────────────────────────────────────────────────────────────

export type Player = { id: string; phone: string; name: string | null; createdAt: number };

export type GameCategory = "kids" | "teen";

export type Game = {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: GameCategory;
  icon: string;
  location: string;
  priceKobo: number; // per hour
  durationMinutes: number; // per hour purchased
  minAge: number | null;
  minHeightCm: number | null;
  instructions: string | null;
  rules: string | null;
  safety: string | null;
  status: string; // active | inactive | maintenance
  featured: boolean;
  createdAt: number;
};

export type Item = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  priceKobo: number;
  active: boolean;
  createdAt: number;
};

// One row per thing an attendant logs — a game session or an item sale. Both
// contribute to the player's spend.
export type Purchase = {
  id: string;
  playerId: string;
  kind: "game" | "item";
  refId: string;
  name: string; // snapshot
  icon: string;
  amountKobo: number;
  quantity: number; // hours for a game, units for an item
  attendantId: string | null;
  createdAt: number;
  // game-session timer fields (null for items):
  headsUpEndsAt: number | null;
  mainEndsAt: number | null;
  location: string | null;
};

// Milestone reward: unlocks once the player's total spend reaches the threshold.
export type Reward = {
  id: string;
  name: string;
  description: string | null;
  spendRequiredKobo: number;
  active: boolean;
  createdAt: number;
};

export type Redemption = { id: string; playerId: string; rewardId: string; code: string; redeemedAt: number };

export type Admin = { id: string; email: string; name: string; password: string; role: string };

export type Settings = { headsUpSeconds: number };

export type Store = {
  version: number;
  sessionPlayerId: string | null;
  adminId: string | null;
  settings: Settings;
  players: Player[];
  games: Game[];
  items: Item[];
  purchases: Purchase[];
  rewards: Reward[];
  redemptions: Redemption[];
  admins: Admin[];
};

const KEY = "gamepass_demo_v6";
const VERSION = 6;

export function newId(prefix: string): string {
  return `${prefix}_${nanoid(12)}`;
}
export function now(): number {
  return Date.now();
}

let cache: Store | null = null;

function empty(): Store {
  return {
    version: VERSION,
    sessionPlayerId: null,
    adminId: null,
    settings: { headsUpSeconds: 60 },
    players: [],
    games: [],
    items: [],
    purchases: [],
    rewards: [],
    redemptions: [],
    admins: [],
  };
}

export function db(): Store {
  if (cache) return cache;
  if (typeof window === "undefined") {
    cache = empty();
    return cache;
  }
  const raw = window.localStorage.getItem(KEY);
  cache = raw ? (JSON.parse(raw) as Store) : empty();
  if (cache.version !== VERSION) cache = empty();
  if (!cache.settings) cache.settings = { headsUpSeconds: 60 };
  // Seed only when there's nothing at all (fresh store). Games start empty —
  // they're added in admin as they're listed; only Kids/Teen categories exist.
  if (cache.admins.length === 0) {
    seed(cache);
    persist();
  }
  return cache;
}

export function persist(): void {
  if (typeof window !== "undefined" && cache) window.localStorage.setItem(KEY, JSON.stringify(cache));
}

export function resetStore(): void {
  cache = empty();
  seed(cache);
  persist();
}

const NAIRA = (n: number) => n * 100; // naira → kobo

function seed(s: Store): void {
  s.settings = { headsUpSeconds: 60 };
  s.admins = [
    { id: newId("adm"), email: "admin@arcade.test", name: "Arcade Admin", password: "admin1234", role: "admin" },
    { id: newId("adm"), email: "staff@arcade.test", name: "Front Desk", password: "staff1234", role: "staff" },
  ];

  // The Games category has exactly two options — Kids Games and Teens Games —
  // each ₦1,000 per hour of play.
  const games: Omit<Game, "id" | "slug" | "createdAt">[] = [
    { name: "Kids Games", description: "One hour of play on the kids games.", category: "kids", icon: "baby", location: "Kids Zone", priceKobo: NAIRA(1000), durationMinutes: 60, minAge: null, minHeightCm: null, instructions: null, rules: null, safety: null, status: "active", featured: true },
    { name: "Teens Games", description: "One hour of play on the teens games.", category: "teen", icon: "rocket", location: "Games Floor", priceKobo: NAIRA(1000), durationMinutes: 60, minAge: null, minHeightCm: null, instructions: null, rules: null, safety: null, status: "active", featured: true },
  ];
  s.games = games.map((g) => ({ ...g, id: newId("game"), slug: g.category === "kids" ? "kids-games" : "teens-games", createdAt: now() }));

  const items: Omit<Item, "id" | "createdAt">[] = [
    { name: "Bottled Water", description: "Chilled 50cl.", icon: "water", priceKobo: NAIRA(300), active: true },
    { name: "Popcorn", description: "Freshly popped, salted or sweet.", icon: "popcorn", priceKobo: NAIRA(800), active: true },
    { name: "Game Token", description: "A single arcade token.", icon: "coins", priceKobo: NAIRA(200), active: true },
    { name: "Branded Cap", description: "Limited-edition Game Pass cap.", icon: "shirt", priceKobo: NAIRA(2500), active: true },
    { name: "Snack Pack", description: "Chips, biscuits & a treat.", icon: "cookie", priceKobo: NAIRA(1200), active: true },
  ];
  s.items = items.map((i) => ({ ...i, id: newId("item"), createdAt: now() }));

  const rewards: Omit<Reward, "id" | "createdAt">[] = [
    { name: "Free Bottled Water", description: "A chilled drink on the house.", spendRequiredKobo: NAIRA(2000), active: true },
    { name: "Free Game Token", description: "One arcade token, free.", spendRequiredKobo: NAIRA(5000), active: true },
    { name: "Branded T-Shirt", description: "A limited-edition Game Pass tee.", spendRequiredKobo: NAIRA(10000), active: true },
    { name: "VIP Power Hour", description: "One hour of any game, free.", spendRequiredKobo: NAIRA(20000), active: true },
  ];
  s.rewards = rewards.map((r) => ({ ...r, id: newId("rwd"), createdAt: now() }));
}
