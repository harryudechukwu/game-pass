import { money } from "@/lib/format";
import {
  db,
  persist,
  newId,
  now,
  type Store,
  type Game,
  type Item,
  type Player,
  type Purchase,
  type Reward,
} from "@/lib/local/store";

// Client-side engine. Synchronous ops over the localStorage store.

export class LocalError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const iso = (ms: number | null | undefined) => (ms == null ? null : new Date(ms).toISOString());
const firstNameOf = (name: string | null) => (name ? (name.trim().split(/\s+/)[0] ?? null) : null);
const ngn = (kobo: number) => money(kobo, "NGN");

// ── serializers ───────────────────────────────────────────────────────────
function sGame(g: Game) {
  return {
    id: g.id, slug: g.slug, name: g.name, description: g.description, category: g.category, icon: g.icon,
    location: g.location, priceKobo: g.priceKobo, priceLabel: ngn(g.priceKobo), durationMinutes: g.durationMinutes,
    minAge: g.minAge, minHeightCm: g.minHeightCm, instructions: g.instructions, rules: g.rules, safety: g.safety,
    status: g.status, featured: g.featured, available: g.status === "active",
  };
}
function sItem(i: Item) {
  return { id: i.id, name: i.name, description: i.description, icon: i.icon, priceKobo: i.priceKobo, priceLabel: ngn(i.priceKobo), active: i.active };
}
function gameStatus(p: Purchase): "heads_up" | "active" | "completed" | null {
  if (p.kind !== "game" || p.mainEndsAt == null) return null;
  const t = Date.now();
  if (p.headsUpEndsAt != null && t < p.headsUpEndsAt) return "heads_up";
  if (t < p.mainEndsAt) return "active";
  return "completed";
}
function sPurchase(p: Purchase) {
  return {
    id: p.id, kind: p.kind, name: p.name, icon: p.icon, amountKobo: p.amountKobo, amountLabel: ngn(p.amountKobo),
    quantity: p.quantity, createdAt: iso(p.createdAt), location: p.location,
    headsUpEndsAt: iso(p.headsUpEndsAt), mainEndsAt: iso(p.mainEndsAt), sessionStatus: gameStatus(p),
  };
}
function sPlayer(p: Player) {
  return { id: p.id, phone: p.phone, name: p.name, firstName: firstNameOf(p.name), createdAt: iso(p.createdAt) };
}

// ── helpers ───────────────────────────────────────────────────────────────
const spentKobo = (s: Store, playerId: string) => s.purchases.filter((p) => p.playerId === playerId).reduce((n, p) => n + p.amountKobo, 0);
const gamesPlayed = (s: Store, playerId: string) => s.purchases.filter((p) => p.playerId === playerId && p.kind === "game" && p.mainEndsAt != null && Date.now() >= p.mainEndsAt).length;
const activeSessions = (s: Store, playerId: string) => s.purchases.filter((p) => p.playerId === playerId && p.kind === "game" && p.mainEndsAt != null && Date.now() < p.mainEndsAt).sort((a, z) => (a.mainEndsAt ?? 0) - (z.mainEndsAt ?? 0));
const isRedeemed = (s: Store, playerId: string, rewardId: string) => s.redemptions.some((x) => x.playerId === playerId && x.rewardId === rewardId);
function claimableRewards(s: Store, playerId: string) {
  const spent = spentKobo(s, playerId);
  return s.rewards.filter((r) => r.active && spent >= r.spendRequiredKobo && !isRedeemed(s, playerId, r.id));
}
function nextRewardFor(s: Store, spent: number) {
  const nr = [...s.rewards].filter((r) => r.active && r.spendRequiredKobo > spent).sort((a, z) => a.spendRequiredKobo - z.spendRequiredKobo)[0];
  if (!nr) return null;
  return { name: nr.name, spendRequiredKobo: nr.spendRequiredKobo, spendRequiredLabel: ngn(nr.spendRequiredKobo), remainingKobo: nr.spendRequiredKobo - spent, remainingLabel: ngn(nr.spendRequiredKobo - spent), progressPct: Math.min(100, Math.round((spent / nr.spendRequiredKobo) * 100)) };
}
function rewardCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 5; i++) c += chars[Math.floor(Math.random() * chars.length)];
  return `GP-${c}`;
}

function requirePlayer(s: Store): Player {
  const p = s.sessionPlayerId ? s.players.find((x) => x.id === s.sessionPlayerId) : null;
  if (!p) throw new LocalError(401, "unauthorized", "Please sign in with your phone number.");
  return p;
}
function requireAdmin(s: Store, role?: "admin") {
  const a = s.adminId ? s.admins.find((x) => x.id === s.adminId) : null;
  if (!a) throw new LocalError(401, "unauthorized", "Admin sign-in required.");
  if (role === "admin" && a.role !== "admin") throw new LocalError(403, "forbidden", "This action requires an admin account.");
  return a;
}
const normPhone = (v: unknown) => String(v ?? "").replace(/\s+/g, "");

// ── router ────────────────────────────────────────────────────────────────
type Body = Record<string, unknown> | undefined;

export async function localApi(path: string, method: string, body: Body, _headers?: Record<string, string>): Promise<unknown> {
  const s = db();
  const [rawPath, qs] = path.split("?");
  const q = new URLSearchParams(qs ?? "");
  const r = rawPath.split("/").filter(Boolean).slice(1);
  const b = (body ?? {}) as Record<string, unknown>;
  const done = <T>(d: T) => { persist(); return d; };

  // ── player auth ──
  if (r[0] === "auth" && r[1] === "login" && method === "POST") {
    const phone = normPhone(b.phone);
    if (phone.length < 6) throw new LocalError(400, "validation_error", "Enter a valid phone number.");
    let player = s.players.find((p) => p.phone === phone);
    let isNew = false;
    if (!player) { player = { id: newId("ply"), phone, name: (b.name as string)?.trim() || null, createdAt: now() }; s.players.push(player); isNew = true; }
    s.sessionPlayerId = player.id;
    return done({ player: sPlayer(player), isNew });
  }
  if (r[0] === "auth" && r[1] === "logout" && method === "POST") { s.sessionPlayerId = null; return done({ loggedOut: true }); }
  if (r[0] === "me" && method === "GET") {
    const p = requirePlayer(s);
    const spent = spentKobo(s, p.id);
    return { player: sPlayer(p), spentKobo: spent, spentLabel: ngn(spent), activeSessions: activeSessions(s, p.id).length, claimable: claimableRewards(s, p.id).length };
  }

  // ── player: home (spend + active timers + purchases feed) ──
  if (r[0] === "home" && method === "GET") {
    const p = requirePlayer(s);
    const spent = spentKobo(s, p.id);
    return {
      spentKobo: spent, spentLabel: ngn(spent), gamesPlayed: gamesPlayed(s, p.id),
      activeSessions: activeSessions(s, p.id).map(sPurchase),
      purchases: s.purchases.filter((x) => x.playerId === p.id).sort((a, z) => z.createdAt - a.createdAt).map(sPurchase),
      nextReward: nextRewardFor(s, spent),
      claimable: claimableRewards(s, p.id).map((x) => ({ id: x.id, name: x.name })),
    };
  }

  // ── player: rewards + redeem ──
  if (r[0] === "rewards" && !r[1] && method === "GET") {
    const p = requirePlayer(s);
    const spent = spentKobo(s, p.id);
    const rewards = [...s.rewards].filter((x) => x.active).sort((a, z) => a.spendRequiredKobo - z.spendRequiredKobo).map((x) => {
      const red = s.redemptions.find((y) => y.playerId === p.id && y.rewardId === x.id);
      const unlocked = spent >= x.spendRequiredKobo;
      return { id: x.id, name: x.name, description: x.description, spendRequiredKobo: x.spendRequiredKobo, spendRequiredLabel: ngn(x.spendRequiredKobo), unlocked, redeemed: !!red, code: red?.code ?? null, claimable: unlocked && !red, progressPct: Math.min(100, Math.round((spent / x.spendRequiredKobo) * 100)) };
    });
    return { spentKobo: spent, spentLabel: ngn(spent), nextReward: nextRewardFor(s, spent), rewards };
  }
  if (r[0] === "rewards" && r[1] && r[2] === "redeem" && method === "POST") {
    const p = requirePlayer(s);
    const reward = s.rewards.find((x) => x.id === r[1]);
    if (!reward || !reward.active) throw new LocalError(404, "reward_not_found", "Reward not found.");
    if (spentKobo(s, p.id) < reward.spendRequiredKobo) throw new LocalError(403, "reward_locked", `Spend ${ngn(reward.spendRequiredKobo)} to unlock this reward.`);
    if (isRedeemed(s, p.id, reward.id)) throw new LocalError(409, "already_redeemed", "You've already redeemed this reward.");
    const code = rewardCode();
    s.redemptions.push({ id: newId("red"), playerId: p.id, rewardId: reward.id, code, redeemedAt: now() });
    return done({ redeemed: true, code, reward: { name: reward.name, description: reward.description } });
  }

  // ── attendant ──
  if (r[0] === "attendant" && r[1] === "catalogue" && method === "GET") {
    return {
      games: s.games.filter((g) => g.status === "active").sort((a, z) => Number(z.featured) - Number(a.featured) || a.name.localeCompare(z.name)).map(sGame),
      items: s.items.filter((i) => i.active).map(sItem),
      headsUpSeconds: s.settings.headsUpSeconds,
    };
  }
  if (r[0] === "attendant" && r[1] === "lookup" && method === "GET") {
    const phone = normPhone(q.get("phone"));
    const p = s.players.find((x) => x.phone === phone);
    return { phone, found: !!p, player: p ? { ...sPlayer(p), spentKobo: spentKobo(s, p.id), spentLabel: ngn(spentKobo(s, p.id)), gamesPlayed: gamesPlayed(s, p.id) } : null };
  }
  if (r[0] === "attendant" && r[1] === "purchase" && method === "POST") {
    const phone = normPhone(b.phone);
    if (phone.length < 6) throw new LocalError(400, "validation_error", "Enter the player's phone number.");
    const kind = b.kind === "item" ? "item" : "game";
    let player = s.players.find((x) => x.phone === phone);
    let isNewPlayer = false;
    if (!player) { player = { id: newId("ply"), phone, name: (b.name as string)?.trim() || null, createdAt: now() }; s.players.push(player); isNewPlayer = true; }
    else if (!player.name && (b.name as string)?.trim()) player.name = (b.name as string).trim();

    let purchase: Purchase;
    if (kind === "game") {
      const game = s.games.find((g) => g.id === String(b.refId));
      if (!game) throw new LocalError(404, "game_not_found", "Pick a game.");
      if (game.status !== "active") throw new LocalError(409, "game_unavailable", "That game is not active.");
      const hours = Math.max(1, Math.floor(Number(b.hours ?? 1)) || 1);
      const headsUpEndsAt = now() + s.settings.headsUpSeconds * 1000;
      const mainEndsAt = headsUpEndsAt + hours * game.durationMinutes * 60 * 1000;
      purchase = { id: newId("pur"), playerId: player.id, kind: "game", refId: game.id, name: game.name, icon: game.icon, amountKobo: hours * game.priceKobo, quantity: hours, attendantId: s.adminId ?? "attendant", createdAt: now(), headsUpEndsAt, mainEndsAt, location: game.location };
    } else {
      const item = s.items.find((i) => i.id === String(b.refId));
      if (!item) throw new LocalError(404, "item_not_found", "Pick an item.");
      if (!item.active) throw new LocalError(409, "item_unavailable", "That item is not available.");
      const qty = Math.max(1, Math.floor(Number(b.quantity ?? 1)) || 1);
      purchase = { id: newId("pur"), playerId: player.id, kind: "item", refId: item.id, name: item.name, icon: item.icon, amountKobo: qty * item.priceKobo, quantity: qty, attendantId: s.adminId ?? "attendant", createdAt: now(), headsUpEndsAt: null, mainEndsAt: null, location: null };
    }
    s.purchases.push(purchase);
    return done({ purchase: sPurchase(purchase), player: { ...sPlayer(player), spentKobo: spentKobo(s, player.id), spentLabel: ngn(spentKobo(s, player.id)) }, isNewPlayer, headsUpSeconds: s.settings.headsUpSeconds, unlockedRewards: claimableRewards(s, player.id).map((x) => ({ id: x.id, name: x.name })) });
  }
  if (r[0] === "attendant" && r[1] === "recent" && method === "GET") {
    const purchases = [...s.purchases].sort((a, z) => z.createdAt - a.createdAt).slice(0, 12).map((p) => {
      const pl = s.players.find((x) => x.id === p.playerId);
      return { ...sPurchase(p), player: { firstName: firstNameOf(pl?.name ?? null), phone: pl?.phone ?? "" } };
    });
    return { purchases };
  }

  // ── admin ──
  if (r[0] === "admin") return adminApi(s, r, method, b, q, done);

  throw new LocalError(404, "not_found", `No local handler for ${method} ${rawPath}`);
}

function adminApi(s: Store, r: string[], method: string, b: Record<string, unknown>, q: URLSearchParams, done: <T>(d: T) => T): unknown {
  if (r[1] === "login" && method === "POST") {
    const email = String(b.email ?? "").toLowerCase();
    const admin = s.admins.find((a) => a.email === email);
    if (!admin || admin.password !== String(b.password ?? "")) throw new LocalError(401, "invalid_credentials", "Incorrect email or password.");
    s.adminId = admin.id;
    return done({ admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
  }
  if (r[1] === "logout" && method === "POST") { s.adminId = null; return done({ loggedOut: true }); }
  if (r[1] === "me" && method === "GET") { const a = requireAdmin(s); return { admin: { id: a.id, name: a.name, email: a.email, role: a.role } }; }

  if (r[1] === "settings" && method === "GET") { requireAdmin(s); return { headsUpSeconds: s.settings.headsUpSeconds }; }
  if (r[1] === "settings" && method === "PATCH") {
    requireAdmin(s);
    if ("headsUpSeconds" in b) s.settings.headsUpSeconds = Math.max(0, Math.min(600, Math.floor(Number(b.headsUpSeconds))));
    return done({ headsUpSeconds: s.settings.headsUpSeconds });
  }

  if (r[1] === "stats" && method === "GET") {
    requireAdmin(s);
    const start = new Date(); start.setHours(0, 0, 0, 0); const t0 = start.getTime();
    const today = s.purchases.filter((p) => p.createdAt >= t0);
    const popular = Object.entries(s.purchases.filter((p) => p.kind === "game").reduce<Record<string, number>>((m, p) => { m[p.refId] = (m[p.refId] ?? 0) + 1; return m; }, {}))
      .sort((a, z) => z[1] - a[1]).slice(0, 5)
      .map(([gameId, plays]) => ({ gameId, name: s.games.find((g) => g.id === gameId)?.name ?? "—", plays }));
    const revToday = today.reduce((n, p) => n + p.amountKobo, 0);
    const revTotal = s.purchases.reduce((n, p) => n + p.amountKobo, 0);
    return {
      totalPlayers: s.players.length,
      revenueTodayKobo: revToday, revenueTodayLabel: money(revToday, "NGN"),
      revenueTotalKobo: revTotal, revenueTotalLabel: money(revTotal, "NGN"),
      gamesLoggedToday: today.filter((p) => p.kind === "game").length,
      itemsSoldToday: today.filter((p) => p.kind === "item").reduce((n, p) => n + p.quantity, 0),
      activeSessions: s.purchases.filter((p) => p.kind === "game" && p.mainEndsAt != null && Date.now() < p.mainEndsAt).length,
      rewardsRedeemedTotal: s.redemptions.length,
      popularGames: popular,
      headsUpSeconds: s.settings.headsUpSeconds,
    };
  }

  // games
  if (r[1] === "games" && !r[2] && method === "GET") { requireAdmin(s); return { games: s.games.map(sGame) }; }
  if (r[1] === "games" && !r[2] && method === "POST") { requireAdmin(s); const g = buildGame(s, b); s.games.push(g); return done({ game: sGame(g) }); }
  if (r[1] === "games" && r[2] && method === "PATCH") {
    requireAdmin(s);
    const g = s.games.find((x) => x.id === r[2]);
    if (!g) throw new LocalError(404, "game_not_found", "Game not found.");
    Object.assign(g, pickGameFields(b));
    return done({ game: sGame(g) });
  }
  if (r[1] === "games" && r[2] && method === "DELETE") {
    requireAdmin(s, "admin");
    if (s.purchases.some((p) => p.kind === "game" && p.refId === r[2])) throw new LocalError(409, "game_in_use", "This game has purchase history. Deactivate it instead of deleting.");
    s.games = s.games.filter((x) => x.id !== r[2]);
    return done({ deleted: true });
  }

  // items
  if (r[1] === "items" && !r[2] && method === "GET") { requireAdmin(s); return { items: s.items.map(sItem) }; }
  if (r[1] === "items" && !r[2] && method === "POST") {
    requireAdmin(s);
    const name = String(b.name ?? "").trim();
    if (!name) throw new LocalError(400, "validation_error", "Name is required.");
    const item: Item = { id: newId("item"), name, description: (b.description as string) || null, icon: String(b.icon ?? "coins"), priceKobo: Math.max(0, Math.round(Number(b.priceKobo ?? 0))), active: b.active !== false, createdAt: now() };
    s.items.push(item);
    return done({ item: sItem(item) });
  }
  if (r[1] === "items" && r[2] && method === "PATCH") {
    requireAdmin(s);
    const item = s.items.find((x) => x.id === r[2]);
    if (!item) throw new LocalError(404, "item_not_found", "Item not found.");
    if ("name" in b) item.name = String(b.name);
    if ("description" in b) item.description = (b.description as string) || null;
    if ("icon" in b) item.icon = String(b.icon);
    if ("priceKobo" in b) item.priceKobo = Math.max(0, Math.round(Number(b.priceKobo)));
    if ("active" in b) item.active = Boolean(b.active);
    return done({ item: sItem(item) });
  }
  if (r[1] === "items" && r[2] && method === "DELETE") {
    requireAdmin(s, "admin");
    if (s.purchases.some((p) => p.kind === "item" && p.refId === r[2])) { const it = s.items.find((x) => x.id === r[2]); if (it) it.active = false; return done({ disabled: true }); }
    s.items = s.items.filter((x) => x.id !== r[2]);
    return done({ deleted: true });
  }

  // rewards
  if (r[1] === "rewards" && !r[2] && method === "GET") { requireAdmin(s); return { rewards: [...s.rewards].sort((a, z) => a.spendRequiredKobo - z.spendRequiredKobo).map((x) => ({ ...x, spendRequiredLabel: money(x.spendRequiredKobo, "NGN") })) }; }
  if (r[1] === "rewards" && !r[2] && method === "POST") {
    requireAdmin(s);
    const name = String(b.name ?? "").trim();
    if (!name) throw new LocalError(400, "validation_error", "Name is required.");
    const reward: Reward = { id: newId("rwd"), name, description: (b.description as string) || null, spendRequiredKobo: Math.max(100, Math.round(Number(b.spendRequiredKobo ?? 100))), active: b.active !== false, createdAt: now() };
    s.rewards.push(reward);
    return done({ reward });
  }
  if (r[1] === "rewards" && r[2] && method === "PATCH") {
    requireAdmin(s);
    const reward = s.rewards.find((x) => x.id === r[2]);
    if (!reward) throw new LocalError(404, "reward_not_found", "Reward not found.");
    if ("name" in b) reward.name = String(b.name);
    if ("description" in b) reward.description = (b.description as string) || null;
    if ("spendRequiredKobo" in b) reward.spendRequiredKobo = Math.max(100, Math.round(Number(b.spendRequiredKobo)));
    if ("active" in b) reward.active = Boolean(b.active);
    return done({ reward });
  }
  if (r[1] === "rewards" && r[2] && method === "DELETE") {
    requireAdmin(s, "admin");
    const reward = s.rewards.find((x) => x.id === r[2]);
    if (reward && s.redemptions.some((x) => x.rewardId === reward.id)) { reward.active = false; return done({ disabled: true }); }
    s.rewards = s.rewards.filter((x) => x.id !== r[2]);
    return done({ deleted: true });
  }

  // players
  if (r[1] === "players" && !r[2] && method === "GET") {
    requireAdmin(s);
    const query = (q.get("q") ?? "").trim().toLowerCase();
    const rows = s.players.filter((p) => !query || (p.name ?? "").toLowerCase().includes(query) || p.phone.includes(query)).sort((a, z) => spentKobo(s, z.id) - spentKobo(s, a.id)).slice(0, 100)
      .map((p) => ({ id: p.id, phone: p.phone, name: p.name, firstName: firstNameOf(p.name), spentKobo: spentKobo(s, p.id), spentLabel: ngn(spentKobo(s, p.id)), gamesPlayed: gamesPlayed(s, p.id), redemptions: s.redemptions.filter((x) => x.playerId === p.id).length, createdAt: iso(p.createdAt) }));
    return { players: rows };
  }
  if (r[1] === "players" && r[2] && method === "GET") {
    requireAdmin(s);
    const p = s.players.find((x) => x.id === r[2]);
    if (!p) throw new LocalError(404, "player_not_found", "Player not found.");
    const spent = spentKobo(s, p.id);
    return {
      player: { ...sPlayer(p), spentKobo: spent, spentLabel: ngn(spent), gamesPlayed: gamesPlayed(s, p.id) },
      purchases: s.purchases.filter((x) => x.playerId === p.id).sort((a, z) => z.createdAt - a.createdAt).map(sPurchase),
      redemptions: s.redemptions.filter((x) => x.playerId === p.id).sort((a, z) => z.redeemedAt - a.redeemedAt).map((x) => ({ id: x.id, rewardName: s.rewards.find((y) => y.id === x.rewardId)?.name ?? "—", code: x.code, redeemedAt: iso(x.redeemedAt) })),
    };
  }

  // logs (purchases)
  if (r[1] === "logs" && method === "GET") {
    requireAdmin(s);
    const kind = q.get("kind");
    const logs = [...s.purchases].filter((p) => !kind || kind === "all" || p.kind === kind).sort((a, z) => z.createdAt - a.createdAt).slice(0, 200).map((p) => {
      const pl = s.players.find((x) => x.id === p.playerId);
      return { ...sPurchase(p), player: { id: pl?.id, firstName: firstNameOf(pl?.name ?? null), phone: pl?.phone ?? "" } };
    });
    return { logs };
  }

  throw new LocalError(404, "not_found", `No local admin handler for ${method} ${r.join("/")}`);
}

function pickGameFields(b: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of ["name", "description", "category", "icon", "location", "priceKobo", "durationMinutes", "minAge", "minHeightCm", "instructions", "rules", "safety", "status", "featured"] as const) {
    if (k in b) out[k] = k === "priceKobo" || k === "durationMinutes" ? Math.max(0, Math.round(Number(b[k]))) : b[k];
  }
  return out;
}
function buildGame(s: Store, b: Record<string, unknown>): Game {
  const name = String(b.name ?? "").trim();
  if (!name) throw new LocalError(400, "validation_error", "Name is required.");
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "game";
  let slug = base; let n = 2;
  while (s.games.some((g) => g.slug === slug)) slug = `${base}-${n++}`;
  return {
    id: newId("game"), name, slug,
    description: String(b.description ?? ""), category: (b.category === "kids" ? "kids" : "teen"), icon: String(b.icon ?? "gamepad"), location: String(b.location ?? ""),
    priceKobo: Math.max(0, Math.round(Number(b.priceKobo ?? 100000))), durationMinutes: Math.max(1, Math.round(Number(b.durationMinutes ?? 60))),
    minAge: b.minAge == null || b.minAge === "" ? null : Number(b.minAge), minHeightCm: b.minHeightCm == null || b.minHeightCm === "" ? null : Number(b.minHeightCm),
    instructions: (b.instructions as string) || null, rules: (b.rules as string) || null, safety: (b.safety as string) || null,
    status: String(b.status ?? "active"), featured: Boolean(b.featured), createdAt: now(),
  };
}
