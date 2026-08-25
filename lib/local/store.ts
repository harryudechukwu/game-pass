import { nanoid } from "nanoid";

// ─────────────────────────────────────────────────────────────
// Demo store — everything lives in the browser's localStorage.
// No server, no database. The player app, the attendant console and the admin
// console all run in the same browser and share this one store, so the flow
// works on a single device.
//
// Model: an ATTENDANT logs the games a player played. The PLAYER logs in with
// just their phone number to see their logged games and redeem milestone
// rewards (unlocked by how many games they've played). No points, no wallet.
//
// Dates are epoch-millisecond numbers.
// ─────────────────────────────────────────────────────────────

export type Player = {
  id: string;
  phone: string;
  name: string | null;
  createdAt: number;
};

export type Game = {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  location: string;
  durationSeconds: number;
  minPlayers: number;
  maxPlayers: number;
  minAge: number | null;
  minHeightCm: number | null;
  instructions: string | null;
  rules: string | null;
  safety: string | null;
  status: string; // active | inactive | maintenance
  featured: boolean;
  createdAt: number;
};

// One row per game a player actually played, created by the attendant.
export type GameLog = {
  id: string;
  playerId: string;
  gameId: string;
  attendantId: string | null;
  note: string | null;
  loggedAt: number;
};

// A milestone reward: unlocks once the player has played `gamesRequired` games.
export type Reward = {
  id: string;
  name: string;
  description: string | null;
  gamesRequired: number;
  active: boolean;
  createdAt: number;
};

export type Redemption = {
  id: string;
  playerId: string;
  rewardId: string;
  code: string;
  redeemedAt: number;
};

export type Admin = {
  id: string;
  email: string;
  name: string;
  password: string; // plaintext is fine — client-only demo
  role: string; // admin | staff
};

export type Store = {
  version: number;
  sessionPlayerId: string | null;
  adminId: string | null;
  players: Player[];
  games: Game[];
  logs: GameLog[];
  rewards: Reward[];
  redemptions: Redemption[];
  admins: Admin[];
};

const KEY = "gamepass_demo_v2";
const VERSION = 2;

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
    players: [],
    games: [],
    logs: [],
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
  if (cache.games.length === 0 || cache.admins.length === 0) {
    seed(cache);
    persist();
  }
  return cache;
}

export function persist(): void {
  if (typeof window !== "undefined" && cache) {
    window.localStorage.setItem(KEY, JSON.stringify(cache));
  }
}

export function resetStore(): void {
  cache = empty();
  seed(cache);
  persist();
}

function seed(s: Store): void {
  s.admins = [
    { id: newId("adm"), email: "admin@arcade.test", name: "Arcade Admin", password: "admin1234", role: "admin" },
    { id: newId("adm"), email: "staff@arcade.test", name: "Front Desk", password: "staff1234", role: "staff" },
  ];

  const games: Omit<Game, "id" | "createdAt">[] = [
    { name: "Soccer Challenge", slug: "soccer-challenge", description: "Test your striking accuracy against our smart goal. Curve it, blast it, place it.", imageUrl: "https://picsum.photos/seed/soccerpitch/800/600", location: "Ground Floor · Bay A1", durationSeconds: 300, minPlayers: 1, maxPlayers: 2, minAge: 6, minHeightCm: null, instructions: "Place the ball on the marker, wait for the green light, then take your shots.", rules: "10 shots per session. No crossing the shooting line.", safety: "Wear the provided grip shoes. Keep bystanders behind the netting.", status: "active", featured: true },
    { name: "Basketball Challenge", slug: "basketball-challenge", description: "Sink as many hoops as you can before the buzzer.", imageUrl: "https://picsum.photos/seed/basketballhoop/800/600", location: "Ground Floor · Bay A2", durationSeconds: 180, minPlayers: 1, maxPlayers: 1, minAge: 6, minHeightCm: null, instructions: "Grab a ball from the rack and shoot until the timer hits zero.", rules: "Free-throw line must be respected.", safety: "Mind the moving hoop. No hanging on the rim.", status: "active", featured: true },
    { name: "Racing Simulator", slug: "racing-simulator", description: "Full-motion racing rig with force-feedback wheel and pedals.", imageUrl: "https://picsum.photos/seed/racingsim/800/600", location: "First Floor · Sim Zone", durationSeconds: 600, minPlayers: 1, maxPlayers: 1, minAge: 10, minHeightCm: 120, instructions: "Buckle the harness, adjust the seat, follow the on-screen countdown.", rules: "Seatbelt must stay fastened. One driver per rig.", safety: "Motion platform tilts and vibrates.", status: "active", featured: true },
    { name: "Bouncy Castle", slug: "bouncy-castle", description: "A giant inflatable playground for the little ones.", imageUrl: "https://picsum.photos/seed/bouncycastle/800/600", location: "Kids Zone · Ground Floor", durationSeconds: 600, minPlayers: 1, maxPlayers: 8, minAge: 3, minHeightCm: null, instructions: "Shoes and sharp objects off before entering. Socks required.", rules: "Max 8 children at once. No food or drink inside.", safety: "Supervised by staff at all times.", status: "active", featured: false },
    { name: "VR Shooting Arena", slug: "vr-shooting-arena", description: "Strap into a wireless VR headset and take on waves of targets.", imageUrl: "https://picsum.photos/seed/vrarena/800/600", location: "First Floor · VR Deck", durationSeconds: 480, minPlayers: 1, maxPlayers: 4, minAge: 12, minHeightCm: 130, instructions: "Staff will fit your headset and controllers. Stay within the play boundary.", rules: "Remain inside the play zone.", safety: "Remove headset if you feel dizzy.", status: "active", featured: false },
    { name: "Mini Golf — 9 Holes", slug: "mini-golf", description: "A whimsical indoor mini-golf course with nine themed holes.", imageUrl: "https://picsum.photos/seed/minigolf/800/600", location: "Second Floor · Green", durationSeconds: 1200, minPlayers: 1, maxPlayers: 4, minAge: 4, minHeightCm: null, instructions: "Collect a putter and ball from the kiosk.", rules: "Max 4 per group. Return putters after your round.", safety: "No swinging putters above knee height.", status: "active", featured: false },
  ];
  s.games = games.map((g) => ({ ...g, id: newId("game"), createdAt: now() }));

  const rewards: Omit<Reward, "id" | "createdAt">[] = [
    { name: "Free Soft Drink", description: "A refreshing drink on the house.", gamesRequired: 3, active: true },
    { name: "One Free Play", description: "A free game of your choice.", gamesRequired: 5, active: true },
    { name: "Arcade T-Shirt", description: "A limited-edition Game Pass tee.", gamesRequired: 10, active: true },
    { name: "VIP Power Hour", description: "One hour of unlimited play.", gamesRequired: 20, active: true },
  ];
  s.rewards = rewards.map((r) => ({ ...r, id: newId("rwd"), createdAt: now() }));
}
