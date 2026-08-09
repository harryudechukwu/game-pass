import { nanoid } from "nanoid";

// ─────────────────────────────────────────────────────────────
// Demo store — everything lives in the browser's localStorage.
// No server, no database. The customer app, the station kiosk and the admin
// console all run in the same browser and therefore share this one store, so
// the full end-to-end flow works on a single device.
//
// Dates are stored as epoch-millisecond numbers for easy JSON round-tripping.
// ─────────────────────────────────────────────────────────────

export type Customer = {
  id: string;
  phone: string;
  name: string | null;
  dateOfBirth: number | null;
  termsAcceptedAt: number | null;
  balance: number;
  suspended: boolean;
  suspendedReason: string | null;
  firstVisitAt: number | null;
  createdAt: number;
};

export type WalletTxn = {
  id: string;
  customerId: string;
  amount: number;
  type: string;
  reason: string;
  balanceAfter: number;
  referenceType?: string | null;
  referenceId?: string | null;
  createdByAdminId?: string | null;
  createdAt: number;
};

export type Game = {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  pointCost: number;
  durationSeconds: number;
  minPlayers: number;
  maxPlayers: number;
  location: string;
  minAge: number | null;
  minHeightCm: number | null;
  instructions: string | null;
  rules: string | null;
  safety: string | null;
  status: string; // active | inactive | maintenance
  selfServiceMode: boolean;
  featured: boolean;
  createdAt: number;
};

export type PlayPass = {
  id: string;
  customerId: string;
  gameId: string;
  pointCost: number;
  status: string; // created | activated | in_progress | completed | expired | cancelled
  qrToken: string;
  createdAt: number;
  expiresAt: number;
  activatedAt: number | null;
};

export type GameSession = {
  id: string;
  customerId: string;
  gameId: string;
  playPassId: string;
  pointsSpent: number;
  status: string; // authorized | in_progress | completed | cancelled | expired
  startTime: number | null;
  expectedEndTime: number | null;
  completionTime: number | null;
  score: number | null;
  rewardPointsEarned: number;
  stationId: string | null;
  createdAt: number;
};

export type RewardRule = {
  id: string;
  name: string;
  description: string | null;
  conditionType: string; // play_completed | score_above | games_count | first_visit
  threshold: number | null;
  points: number;
  active: boolean;
  expiryDays: number | null;
  priority: number;
  createdAt: number;
};

export type RewardIssue = {
  id: string;
  customerId: string;
  ruleId: string;
  sessionId: string | null;
  points: number;
  createdAt: number;
};

export type Pkg = {
  id: string;
  name: string;
  points: number;
  bonusPoints: number;
  priceKobo: number;
  currency: string;
  active: boolean;
  sortOrder: number;
};

export type Purchase = {
  id: string;
  customerId: string;
  packageId: string;
  pointsCredited: number;
  amountKobo: number;
  currency: string;
  reference: string;
  status: string; // pending | success | failed
  createdAt: number;
  updatedAt: number;
};

export type Admin = {
  id: string;
  email: string;
  name: string;
  password: string; // plaintext is fine — this is a client-only demo
  role: string; // admin | staff
};

export type Otp = { phone: string; code: string; expiresAt: number; consumed: boolean };

export type Store = {
  version: number;
  sessionCustomerId: string | null;
  adminId: string | null;
  customers: Customer[];
  txns: WalletTxn[];
  games: Game[];
  passes: PlayPass[];
  sessions: GameSession[];
  rules: RewardRule[];
  issues: RewardIssue[];
  packages: Pkg[];
  purchases: Purchase[];
  admins: Admin[];
  otps: Otp[];
  idempotency: Record<string, string>;
};

const KEY = "gamepass_demo_v1";
const VERSION = 1;

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
    sessionCustomerId: null,
    adminId: null,
    customers: [],
    txns: [],
    games: [],
    passes: [],
    sessions: [],
    rules: [],
    issues: [],
    packages: [],
    purchases: [],
    admins: [],
    otps: [],
    idempotency: {},
  };
}

export function db(): Store {
  if (cache) return cache;
  if (typeof window === "undefined") {
    // SSR safety — never actually used to persist on the server.
    cache = empty();
    return cache;
  }
  const raw = window.localStorage.getItem(KEY);
  cache = raw ? (JSON.parse(raw) as Store) : empty();
  if (cache.version !== VERSION) cache = empty();
  if (cache.games.length === 0) {
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

// Wipe and re-seed — used by the "reset demo" control.
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
    {
      name: "Soccer Challenge",
      slug: "soccer-challenge",
      description:
        "Test your striking accuracy against our smart goal. Curve it, blast it, place it — the sensors score every shot.",
      imageUrl: "https://picsum.photos/seed/soccerpitch/800/600",
      pointCost: 30,
      durationSeconds: 300,
      minPlayers: 1,
      maxPlayers: 2,
      location: "Ground Floor · Bay A1",
      minAge: 6,
      minHeightCm: null,
      instructions: "Place the ball on the marker, wait for the green light, then take your shots. You get 10 balls.",
      rules: "10 shots per session. Highest points combo wins. No crossing the shooting line.",
      safety: "Wear the provided grip shoes. Keep bystanders behind the netting.",
      status: "active",
      selfServiceMode: true,
      featured: true,
    },
    {
      name: "Basketball Challenge",
      slug: "basketball-challenge",
      description: "Sink as many hoops as you can before the buzzer. The rim counts every basket automatically.",
      imageUrl: "https://picsum.photos/seed/basketballhoop/800/600",
      pointCost: 40,
      durationSeconds: 180,
      minPlayers: 1,
      maxPlayers: 1,
      location: "Ground Floor · Bay A2",
      minAge: 6,
      minHeightCm: null,
      instructions: "Grab a ball from the rack and shoot until the timer hits zero.",
      rules: "Free-throw line must be respected. Balls returned automatically.",
      safety: "Mind the moving hoop. No hanging on the rim.",
      status: "active",
      selfServiceMode: true,
      featured: true,
    },
    {
      name: "Racing Simulator",
      slug: "racing-simulator",
      description:
        "Full-motion racing rig with force-feedback wheel and pedals. Set your fastest lap on the championship circuit.",
      imageUrl: "https://picsum.photos/seed/racingsim/800/600",
      pointCost: 50,
      durationSeconds: 600,
      minPlayers: 1,
      maxPlayers: 1,
      location: "First Floor · Sim Zone",
      minAge: 10,
      minHeightCm: 120,
      instructions: "Buckle the harness, adjust the seat, and follow the on-screen countdown.",
      rules: "Seatbelt must stay fastened. One driver per rig.",
      safety: "Motion platform tilts and vibrates. Not suitable for guests prone to motion sickness.",
      status: "active",
      selfServiceMode: true,
      featured: true,
    },
    {
      name: "Bouncy Castle",
      slug: "bouncy-castle",
      description: "A giant inflatable playground for the little ones. Bounce, slide, and climb to your heart's content.",
      imageUrl: "https://picsum.photos/seed/bouncycastle/800/600",
      pointCost: 50,
      durationSeconds: 600,
      minPlayers: 1,
      maxPlayers: 8,
      location: "Kids Zone · Ground Floor",
      minAge: 3,
      minHeightCm: null,
      instructions: "Shoes and sharp objects off before entering. Socks required.",
      rules: "Max 8 children at once. No food or drink inside.",
      safety: "Supervised by staff at all times. No somersaults or rough play.",
      status: "active",
      selfServiceMode: true,
      featured: false,
    },
    {
      name: "VR Shooting Arena",
      slug: "vr-shooting-arena",
      description: "Strap into a wireless VR headset and take on waves of targets in a fast-paced shooting gallery.",
      imageUrl: "https://picsum.photos/seed/vrarena/800/600",
      pointCost: 60,
      durationSeconds: 480,
      minPlayers: 1,
      maxPlayers: 4,
      location: "First Floor · VR Deck",
      minAge: 12,
      minHeightCm: 130,
      instructions: "Staff will fit your headset and controllers. Stay within the glowing play boundary.",
      rules: "Remain inside the play zone. Report any discomfort immediately.",
      safety: "Play area monitored. Remove headset if you feel dizzy.",
      status: "active",
      selfServiceMode: true,
      featured: false,
    },
    {
      name: "Mini Golf — 9 Holes",
      slug: "mini-golf",
      description: "A whimsical indoor mini-golf course with nine themed holes. Great for groups and families.",
      imageUrl: "https://picsum.photos/seed/minigolf/800/600",
      pointCost: 35,
      durationSeconds: 1200,
      minPlayers: 1,
      maxPlayers: 4,
      location: "Second Floor · Green",
      minAge: 4,
      minHeightCm: null,
      instructions: "Collect a putter and ball from the kiosk. Keep the pace with the group ahead.",
      rules: "Max 4 per group. Please return putters after your round.",
      safety: "No swinging putters above knee height.",
      status: "active",
      selfServiceMode: true,
      featured: false,
    },
  ];
  s.games = games.map((g) => ({ ...g, id: newId("game"), createdAt: now() }));

  const rules: Omit<RewardRule, "id" | "createdAt">[] = [
    { name: "Play Completed", description: "Awarded every time a game session is completed.", conditionType: "play_completed", threshold: null, points: 5, active: true, expiryDays: null, priority: 10 },
    { name: "High Score Bonus", description: "Score above 80 in any scored game.", conditionType: "score_above", threshold: 80, points: 20, active: true, expiryDays: null, priority: 20 },
    { name: "Triple Play", description: "Awarded every 3rd completed game.", conditionType: "games_count", threshold: 3, points: 30, active: true, expiryDays: null, priority: 30 },
    { name: "First Visit", description: "A one-time bonus for completing your very first game.", conditionType: "first_visit", threshold: null, points: 100, active: true, expiryDays: null, priority: 40 },
  ];
  s.rules = rules.map((r) => ({ ...r, id: newId("rule"), createdAt: now() }));

  const packages: Omit<Pkg, "id">[] = [
    { name: "Starter — 500 points", points: 500, bonusPoints: 0, priceKobo: 250_000, currency: "NGN", active: true, sortOrder: 1 },
    { name: "Value — 1,000 points", points: 1000, bonusPoints: 100, priceKobo: 500_000, currency: "NGN", active: true, sortOrder: 2 },
    { name: "Pro — 2,500 points", points: 2500, bonusPoints: 400, priceKobo: 1_150_000, currency: "NGN", active: true, sortOrder: 3 },
    { name: "Ultimate — 5,000 points", points: 5000, bonusPoints: 1000, priceKobo: 2_200_000, currency: "NGN", active: true, sortOrder: 4 },
  ];
  s.packages = packages.map((p) => ({ ...p, id: newId("pkg") }));
}
