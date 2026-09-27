import { nanoid } from "nanoid";
import { money } from "@/lib/format";
import { cols } from "@/lib/server/db";
import type { SessionCtx } from "@/lib/server/session";
import type { Attendant, Game, Item, Player, Purchase, Reward } from "@/lib/server/types";

// Server-side domain engine over MongoDB. Mirrors the previous localStorage
// engine, but async and cookie-session based (session identity comes in via ctx;
// the API route sets/clears the cookies for login/logout).

export class HttpError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const newId = (p: string) => `${p}_${nanoid(12)}`;
const iso = (ms: number | null | undefined) => (ms == null ? null : new Date(ms).toISOString());
const firstNameOf = (name: string | null) => (name ? (name.trim().split(/\s+/)[0] ?? null) : null);
const ngn = (kobo: number) => money(kobo, "NGN");
const durationLabel = (s: number) => (Math.round(s / 60) >= 1 ? `${Math.round(s / 60)} min` : `${s}s`);
const normPhone = (v: unknown) => String(v ?? "").replace(/\s+/g, "");
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};
// epoch-ms the given analysis window starts at (0 = all-time / cumulative)
const periodSince = (period: string): number => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === "week") { d.setDate(d.getDate() - 6); return d.getTime(); }
  if (period === "month") { d.setDate(d.getDate() - 29); return d.getTime(); }
  if (period === "all") return 0;
  return d.getTime(); // today
};

// ── serializers ───────────────────────────────────────────────────────────
function sGame(g: Game) {
  return {
    id: g._id, slug: g.slug, name: g.name, description: g.description, category: g.category, icon: g.icon,
    location: g.location, priceKobo: g.priceKobo, priceLabel: ngn(g.priceKobo), durationMinutes: g.durationMinutes,
    minAge: g.minAge, minHeightCm: g.minHeightCm, instructions: g.instructions, rules: g.rules, safety: g.safety,
    status: g.status, featured: g.featured, available: g.status === "active",
  };
}
function sItem(i: Item) {
  return { id: i._id, name: i.name, description: i.description, icon: i.icon, priceKobo: i.priceKobo, priceLabel: ngn(i.priceKobo), active: i.active };
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
    id: p._id, kind: p.kind, name: p.name, icon: p.icon, amountKobo: p.amountKobo, amountLabel: ngn(p.amountKobo),
    quantity: p.quantity, createdAt: iso(p.createdAt), location: p.location,
    headsUpEndsAt: iso(p.headsUpEndsAt), mainEndsAt: iso(p.mainEndsAt), sessionStatus: gameStatus(p),
  };
}
function sPlayer(p: Player) {
  return { id: p._id, phone: p.phone, name: p.name, firstName: firstNameOf(p.name), createdAt: iso(p.createdAt) };
}

// ── helpers ───────────────────────────────────────────────────────────────
type Cols = Awaited<ReturnType<typeof cols>>;

async function spentOf(c: Cols, playerId: string): Promise<number> {
  const agg = await c.purchases.aggregate([{ $match: { playerId } }, { $group: { _id: null, total: { $sum: "$amountKobo" } } }]).toArray();
  return agg[0]?.total ?? 0;
}
function gamesPlayedOf(c: Cols, playerId: string): Promise<number> {
  return c.purchases.countDocuments({ playerId, kind: "game", mainEndsAt: { $lte: Date.now() } });
}
function activeSessionsOf(c: Cols, playerId: string): Promise<Purchase[]> {
  return c.purchases.find({ playerId, kind: "game", mainEndsAt: { $gt: Date.now() } }).sort({ mainEndsAt: 1 }).toArray();
}
function activeRewards(c: Cols): Promise<Reward[]> {
  return c.rewards.find({ active: true }).sort({ spendRequiredKobo: 1 }).toArray();
}
function parseTerms(v: unknown): string[] | null {
  const arr = Array.isArray(v) ? v : typeof v === "string" ? v.split("\n") : [];
  const out = arr.map((s) => String(s).trim()).filter(Boolean);
  return out.length ? out : null;
}
async function redeemedIds(c: Cols, playerId: string): Promise<Set<string>> {
  const reds = await c.redemptions.find({ playerId }).toArray();
  return new Set(reds.map((r) => r.rewardId));
}
function nextRewardFor(rewards: Reward[], spent: number) {
  const nr = rewards.find((r) => r.spendRequiredKobo > spent); // rewards sorted asc
  if (!nr) return null;
  return { name: nr.name, spendRequiredKobo: nr.spendRequiredKobo, spendRequiredLabel: ngn(nr.spendRequiredKobo), remainingKobo: nr.spendRequiredKobo - spent, remainingLabel: ngn(nr.spendRequiredKobo - spent), progressPct: Math.min(100, Math.round((spent / nr.spendRequiredKobo) * 100)) };
}
function rewardCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 5; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `GP-${s}`;
}

async function requirePlayer(ctx: SessionCtx, c: Cols): Promise<Player> {
  if (!ctx.playerId) throw new HttpError(401, "unauthorized", "Please sign in with your phone number.");
  const p = await c.players.findOne({ _id: ctx.playerId });
  if (!p) throw new HttpError(401, "unauthorized", "Session no longer valid.");
  return p;
}
const ROLE_RANK: Record<string, number> = { staff: 1, manager: 2, admin: 3 };
async function requireAdmin(ctx: SessionCtx, c: Cols, minRole?: "admin" | "manager") {
  if (!ctx.adminId) throw new HttpError(401, "unauthorized", "Admin sign-in required.");
  const a = await c.admins.findOne({ _id: ctx.adminId });
  if (!a) throw new HttpError(401, "unauthorized", "Session no longer valid.");
  if (minRole && (ROLE_RANK[a.role] ?? 0) < ROLE_RANK[minRole]) {
    throw new HttpError(403, "forbidden", minRole === "admin" ? "This action requires an admin account." : "You don't have access to this.");
  }
  return a;
}
// admin + staff, but NOT managers — managers get a limited catalogue-only view
async function requireNonManager(ctx: SessionCtx, c: Cols) {
  const a = await requireAdmin(ctx, c);
  if (a.role === "manager") throw new HttpError(403, "forbidden", "Managers don't have access to this.");
  return a;
}
async function requireAttendant(ctx: SessionCtx, c: Cols): Promise<Attendant> {
  if (!ctx.attendantId) throw new HttpError(401, "unauthorized", "Attendant sign-in required.");
  const a = await c.attendants.findOne({ _id: ctx.attendantId });
  if (!a) throw new HttpError(401, "unauthorized", "Session no longer valid.");
  return a;
}

// ── router ────────────────────────────────────────────────────────────────
type Body = Record<string, unknown>;

export async function handle(path: string, method: string, body: Body, ctx: SessionCtx, query: URLSearchParams): Promise<unknown> {
  const c = await cols();
  const r = path.split("/").filter(Boolean).slice(1); // drop "api"
  const b = body ?? {};

  // ── player auth ──
  if (r[0] === "auth" && r[1] === "login" && method === "POST") {
    const phone = normPhone(b.phone);
    if (phone.length < 6) throw new HttpError(400, "validation_error", "Enter a valid phone number.");
    let player = await c.players.findOne({ phone });
    let isNew = false;
    if (!player) {
      player = { _id: newId("ply"), phone, name: (b.name as string)?.trim() || null, createdAt: Date.now() };
      await c.players.insertOne(player);
      isNew = true;
    }
    return { player: sPlayer(player), isNew };
  }
  if (r[0] === "auth" && r[1] === "logout" && method === "POST") return { loggedOut: true };

  if (r[0] === "me" && method === "GET") {
    const p = await requirePlayer(ctx, c);
    const spent = await spentOf(c, p._id);
    const [rewards, redeemed, active] = await Promise.all([
      activeRewards(c),
      redeemedIds(c, p._id),
      c.purchases.countDocuments({ playerId: p._id, kind: "game", mainEndsAt: { $gt: Date.now() } }),
    ]);
    const claimable = rewards.filter((x) => spent >= x.spendRequiredKobo && !redeemed.has(x._id)).length;
    return { player: sPlayer(p), spentKobo: spent, spentLabel: ngn(spent), activeSessions: active, claimable };
  }

  if (r[0] === "home" && method === "GET") {
    const p = await requirePlayer(ctx, c);
    const spent = await spentOf(c, p._id);
    const [active, purchases, rewards, redeemed, gp] = await Promise.all([
      activeSessionsOf(c, p._id),
      c.purchases.find({ playerId: p._id }).sort({ createdAt: -1 }).toArray(),
      activeRewards(c),
      redeemedIds(c, p._id),
      gamesPlayedOf(c, p._id),
    ]);
    const claimable = rewards.filter((x) => spent >= x.spendRequiredKobo && !redeemed.has(x._id)).map((x) => ({ id: x._id, name: x.name }));
    const upcomingRewards = rewards
      .filter((x) => spent < x.spendRequiredKobo)
      .slice(0, 4)
      .map((x) => ({ id: x._id, name: x.name, remainingLabel: ngn(x.spendRequiredKobo - spent), spendRequiredLabel: ngn(x.spendRequiredKobo), progressPct: Math.min(100, Math.round((spent / x.spendRequiredKobo) * 100)) }));
    return {
      spentKobo: spent, spentLabel: ngn(spent), gamesPlayed: gp,
      activeSessions: active.map(sPurchase), purchases: purchases.map(sPurchase),
      nextReward: nextRewardFor(rewards, spent), claimable, upcomingRewards,
    };
  }

  if (r[0] === "rewards" && !r[1] && method === "GET") {
    const p = await requirePlayer(ctx, c);
    const spent = await spentOf(c, p._id);
    const [rewards, redDocs] = await Promise.all([activeRewards(c), c.redemptions.find({ playerId: p._id }).toArray()]);
    const codeMap = new Map(redDocs.map((d) => [d.rewardId, d.code]));
    const list = rewards.map((x) => {
      const code = codeMap.get(x._id) ?? null;
      const unlocked = spent >= x.spendRequiredKobo;
      return { id: x._id, name: x.name, description: x.description, spendRequiredKobo: x.spendRequiredKobo, spendRequiredLabel: ngn(x.spendRequiredKobo), terms: x.terms ?? null, unlocked, redeemed: !!code, code, claimable: unlocked && !code, progressPct: Math.min(100, Math.round((spent / x.spendRequiredKobo) * 100)) };
    });
    return { spentKobo: spent, spentLabel: ngn(spent), nextReward: nextRewardFor(rewards, spent), rewards: list };
  }
  if (r[0] === "rewards" && r[1] && r[2] === "redeem" && method === "POST") {
    const p = await requirePlayer(ctx, c);
    const reward = await c.rewards.findOne({ _id: r[1] });
    if (!reward || !reward.active) throw new HttpError(404, "reward_not_found", "Reward not found.");
    const spent = await spentOf(c, p._id);
    if (spent < reward.spendRequiredKobo) throw new HttpError(403, "reward_locked", `Spend ${ngn(reward.spendRequiredKobo)} to unlock this reward.`);
    if (await c.redemptions.findOne({ playerId: p._id, rewardId: reward._id })) throw new HttpError(409, "already_redeemed", "You've already redeemed this reward.");
    const code = rewardCode();
    try {
      await c.redemptions.insertOne({ _id: newId("red"), playerId: p._id, rewardId: reward._id, code, redeemedAt: Date.now() });
    } catch {
      throw new HttpError(409, "already_redeemed", "You've already redeemed this reward.");
    }
    return { redeemed: true, code, reward: { name: reward.name, description: reward.description } };
  }

  // ── attendant auth ──
  if (r[0] === "attendant" && r[1] === "login" && method === "POST") {
    const att = await c.attendants.findOne({ username: String(b.username ?? "").trim().toLowerCase() });
    if (!att || att.password !== String(b.password ?? "")) throw new HttpError(401, "invalid_credentials", "Incorrect username or password.");
    return { attendant: { id: att._id, name: att.name, username: att.username } };
  }
  if (r[0] === "attendant" && r[1] === "logout" && method === "POST") return { loggedOut: true };
  if (r[0] === "attendant" && r[1] === "me" && method === "GET") {
    const att = await requireAttendant(ctx, c);
    return { attendant: { id: att._id, name: att.name, username: att.username } };
  }

  // ── attendant console (requires an attendant session) ──
  if (r[0] === "attendant" && r[1] === "catalogue" && method === "GET") {
    await requireAttendant(ctx, c);
    const [games, items, settings] = await Promise.all([
      c.games.find({ status: "active" }).toArray(),
      c.items.find({ active: true }).toArray(),
      c.settings.findOne({ _id: "app" }),
    ]);
    games.sort((a, z) => Number(z.featured) - Number(a.featured) || a.name.localeCompare(z.name));
    return { games: games.map(sGame), items: items.map(sItem), headsUpSeconds: settings?.headsUpSeconds ?? 60 };
  }
  if (r[0] === "attendant" && r[1] === "lookup" && method === "GET") {
    await requireAttendant(ctx, c);
    const phone = normPhone(query.get("phone"));
    const p = await c.players.findOne({ phone });
    if (!p) return { phone, found: false, player: null };
    const [spent, gp] = await Promise.all([spentOf(c, p._id), gamesPlayedOf(c, p._id)]);
    return { phone, found: true, player: { ...sPlayer(p), spentKobo: spent, spentLabel: ngn(spent), gamesPlayed: gp } };
  }
  if (r[0] === "attendant" && r[1] === "purchase" && method === "POST") {
    const att = await requireAttendant(ctx, c);
    const phone = normPhone(b.phone);
    if (phone.length < 6) throw new HttpError(400, "validation_error", "Enter the player's phone number.");
    const kind = b.kind === "item" ? "item" : "game";
    let player = await c.players.findOne({ phone });
    let isNewPlayer = false;
    if (!player) {
      player = { _id: newId("ply"), phone, name: (b.name as string)?.trim() || null, createdAt: Date.now() };
      await c.players.insertOne(player);
      isNewPlayer = true;
    } else if (!player.name && (b.name as string)?.trim()) {
      await c.players.updateOne({ _id: player._id }, { $set: { name: (b.name as string).trim() } });
    }
    const settings = await c.settings.findOne({ _id: "app" });
    const headsUpSeconds = settings?.headsUpSeconds ?? 60;
    const now = Date.now();
    let purchase: Purchase;
    if (kind === "game") {
      const game = await c.games.findOne({ _id: String(b.refId) });
      if (!game) throw new HttpError(404, "game_not_found", "Pick a game.");
      if (game.status !== "active") throw new HttpError(409, "game_unavailable", "That game is not active.");
      const hours = Math.max(1, Math.floor(Number(b.hours ?? 1)) || 1);
      const headsUpEndsAt = now + headsUpSeconds * 1000;
      const mainEndsAt = headsUpEndsAt + hours * game.durationMinutes * 60 * 1000;
      purchase = { _id: newId("pur"), playerId: player._id, kind: "game", refId: game._id, name: game.name, icon: game.icon, amountKobo: hours * game.priceKobo, quantity: hours, attendantId: att._id, createdAt: now, headsUpEndsAt, mainEndsAt, location: game.location };
    } else {
      const item = await c.items.findOne({ _id: String(b.refId) });
      if (!item) throw new HttpError(404, "item_not_found", "Pick an item.");
      if (!item.active) throw new HttpError(409, "item_unavailable", "That item is not available.");
      const qty = Math.max(1, Math.floor(Number(b.quantity ?? 1)) || 1);
      purchase = { _id: newId("pur"), playerId: player._id, kind: "item", refId: item._id, name: item.name, icon: item.icon, amountKobo: qty * item.priceKobo, quantity: qty, attendantId: att._id, createdAt: now, headsUpEndsAt: null, mainEndsAt: null, location: null };
    }
    await c.purchases.insertOne(purchase);
    const spent = await spentOf(c, player._id);
    const rewards = await activeRewards(c);
    const redeemed = await redeemedIds(c, player._id);
    const unlocked = rewards.filter((x) => spent >= x.spendRequiredKobo && !redeemed.has(x._id)).map((x) => ({ id: x._id, name: x.name }));
    return { purchase: sPurchase(purchase), player: { ...sPlayer(player), spentKobo: spent, spentLabel: ngn(spent) }, isNewPlayer, headsUpSeconds, unlockedRewards: unlocked };
  }

  // batch: record several games/items for one player in a single order
  if (r[0] === "attendant" && r[1] === "order" && method === "POST") {
    const att = await requireAttendant(ctx, c);
    const phone = normPhone(b.phone);
    if (phone.length < 6) throw new HttpError(400, "validation_error", "Enter the player's phone number.");
    const lines = Array.isArray(b.lines) ? (b.lines as Record<string, unknown>[]) : [];
    if (lines.length === 0) throw new HttpError(400, "validation_error", "Add at least one game or item.");
    if (lines.length > 30) throw new HttpError(400, "validation_error", "That's too many lines for one order.");
    let player = await c.players.findOne({ phone });
    let isNewPlayer = false;
    if (!player) {
      player = { _id: newId("ply"), phone, name: (b.name as string)?.trim() || null, createdAt: Date.now() };
      await c.players.insertOne(player);
      isNewPlayer = true;
    } else if (!player.name && (b.name as string)?.trim()) {
      await c.players.updateOne({ _id: player._id }, { $set: { name: (b.name as string).trim() } });
    }
    const settings = await c.settings.findOne({ _id: "app" });
    const headsUpSeconds = settings?.headsUpSeconds ?? 60;
    const now = Date.now();
    const toInsert: Purchase[] = [];
    for (const line of lines) {
      const kind = line.kind === "item" ? "item" : "game";
      if (kind === "game") {
        const game = await c.games.findOne({ _id: String(line.refId) });
        if (!game) throw new HttpError(404, "game_not_found", "One of the games wasn't found.");
        if (game.status !== "active") throw new HttpError(409, "game_unavailable", `${game.name} is not active.`);
        const hours = Math.max(1, Math.floor(Number(line.hours ?? 1)) || 1);
        const headsUpEndsAt = now + headsUpSeconds * 1000;
        const mainEndsAt = headsUpEndsAt + hours * game.durationMinutes * 60 * 1000;
        toInsert.push({ _id: newId("pur"), playerId: player._id, kind: "game", refId: game._id, name: game.name, icon: game.icon, amountKobo: hours * game.priceKobo, quantity: hours, attendantId: att._id, createdAt: now, headsUpEndsAt, mainEndsAt, location: game.location });
      } else {
        const item = await c.items.findOne({ _id: String(line.refId) });
        if (!item) throw new HttpError(404, "item_not_found", "One of the items wasn't found.");
        if (!item.active) throw new HttpError(409, "item_unavailable", `${item.name} is not available.`);
        const qty = Math.max(1, Math.floor(Number(line.quantity ?? 1)) || 1);
        toInsert.push({ _id: newId("pur"), playerId: player._id, kind: "item", refId: item._id, name: item.name, icon: item.icon, amountKobo: qty * item.priceKobo, quantity: qty, attendantId: att._id, createdAt: now, headsUpEndsAt: null, mainEndsAt: null, location: null });
      }
    }
    await c.purchases.insertMany(toInsert);
    const spent = await spentOf(c, player._id);
    const rewards = await activeRewards(c);
    const redeemed = await redeemedIds(c, player._id);
    const unlocked = rewards.filter((x) => spent >= x.spendRequiredKobo && !redeemed.has(x._id)).map((x) => ({ id: x._id, name: x.name }));
    const totalKobo = toInsert.reduce((s, p) => s + p.amountKobo, 0);
    return { purchases: toInsert.map(sPurchase), totalKobo, totalLabel: ngn(totalKobo), player: { ...sPlayer(player), spentKobo: spent, spentLabel: ngn(spent) }, isNewPlayer, headsUpSeconds, hasGame: toInsert.some((p) => p.kind === "game"), unlockedRewards: unlocked };
  }

  // reward redemption at the desk — attendant enters the code the guest shows
  if (r[0] === "attendant" && r[1] === "redeem" && method === "POST") {
    const att = await requireAttendant(ctx, c);
    const raw = String(b.code ?? "").trim().toUpperCase().replace(/\s+/g, "");
    if (!raw) throw new HttpError(400, "validation_error", "Enter the reward code.");
    const code = raw.startsWith("GP-") ? raw : `GP-${raw}`;
    const red = await c.redemptions.findOne({ code });
    if (!red) throw new HttpError(404, "code_not_found", "No reward matches that code.");
    if (red.fulfilledAt) throw new HttpError(409, "already_fulfilled", `Already given${red.fulfilledByName ? ` by ${red.fulfilledByName}` : ""}.`);
    const [reward, player] = await Promise.all([
      c.rewards.findOne({ _id: red.rewardId }),
      c.players.findOne({ _id: red.playerId }),
    ]);
    await c.redemptions.updateOne({ _id: red._id }, { $set: { fulfilledAt: Date.now(), fulfilledByName: att.name } });
    return {
      code,
      reward: { name: reward?.name ?? "Reward" },
      player: player ? { firstName: firstNameOf(player.name), phone: player.phone } : null,
    };
  }

  if (r[0] === "attendant" && r[1] === "recent" && method === "GET") {
    await requireAttendant(ctx, c);
    const purchases = await c.purchases.find({}).sort({ createdAt: -1 }).limit(12).toArray();
    const players = await c.players.find({ _id: { $in: [...new Set(purchases.map((p) => p.playerId))] } }).toArray();
    const pmap = new Map(players.map((p) => [p._id, p]));
    return { purchases: purchases.map((p) => ({ ...sPurchase(p), player: { firstName: firstNameOf(pmap.get(p.playerId)?.name ?? null), phone: pmap.get(p.playerId)?.phone ?? "" } })) };
  }

  if (r[0] === "admin") return adminApi(c, r, method, b, query, ctx);

  throw new HttpError(404, "not_found", `No handler for ${method} /${r.join("/")}`);
}

async function adminApi(c: Cols, r: string[], method: string, b: Body, query: URLSearchParams, ctx: SessionCtx): Promise<unknown> {
  if (r[1] === "login" && method === "POST") {
    const admin = await c.admins.findOne({ email: String(b.email ?? "").toLowerCase() });
    if (!admin || admin.password !== String(b.password ?? "")) throw new HttpError(401, "invalid_credentials", "Incorrect email or password.");
    return { admin: { id: admin._id, name: admin.name, email: admin.email, role: admin.role } };
  }
  if (r[1] === "logout" && method === "POST") return { loggedOut: true };
  if (r[1] === "me" && method === "GET") {
    const a = await requireAdmin(ctx, c);
    return { admin: { id: a._id, name: a.name, email: a.email, role: a.role } };
  }

  if (r[1] === "settings" && method === "GET") {
    await requireNonManager(ctx, c);
    const s = await c.settings.findOne({ _id: "app" });
    return { headsUpSeconds: s?.headsUpSeconds ?? 60 };
  }
  if (r[1] === "settings" && method === "PATCH") {
    await requireNonManager(ctx, c);
    if ("headsUpSeconds" in b) {
      const v = Math.max(0, Math.min(600, Math.floor(Number(b.headsUpSeconds))));
      await c.settings.updateOne({ _id: "app" }, { $set: { headsUpSeconds: v } }, { upsert: true });
    }
    const s = await c.settings.findOne({ _id: "app" });
    return { headsUpSeconds: s?.headsUpSeconds ?? 60 };
  }

  // full analysis for admin/staff — figures scoped to ?period=today|week|month|all
  if (r[1] === "stats" && method === "GET") {
    await requireNonManager(ctx, c);
    const period = String(query.get("period") ?? "today");
    const since = periodSince(period);
    const now = Date.now();
    const matchPeriod = since ? { createdAt: { $gte: since } } : {};
    const [totalPlayers, periodPurchases, popularAgg, activeSessions, rewardsRedeemed, settings] = await Promise.all([
      c.players.estimatedDocumentCount(),
      c.purchases.find(matchPeriod).toArray(),
      c.purchases.aggregate([{ $match: { kind: "game", ...matchPeriod } }, { $group: { _id: "$refId", plays: { $sum: 1 } } }, { $sort: { plays: -1 } }, { $limit: 5 }]).toArray(),
      c.purchases.countDocuments({ kind: "game", mainEndsAt: { $gt: now } }),
      c.redemptions.countDocuments(since ? { redeemedAt: { $gte: since } } : {}),
      c.settings.findOne({ _id: "app" }),
    ]);
    const games = await c.games.find({ _id: { $in: popularAgg.map((x) => x._id as string) } }).toArray();
    const gmap = new Map(games.map((g) => [g._id, g.name]));
    const revenue = periodPurchases.reduce((n, p) => n + p.amountKobo, 0);
    return {
      period,
      totalPlayers,
      revenueKobo: revenue, revenueLabel: money(revenue, "NGN"),
      gamesLogged: periodPurchases.filter((p) => p.kind === "game").length,
      itemsSold: periodPurchases.filter((p) => p.kind === "item").reduce((n, p) => n + p.quantity, 0),
      activeSessions,
      rewardsRedeemed,
      popularGames: popularAgg.map((x) => ({ gameId: x._id as string, name: gmap.get(x._id as string) ?? "—", plays: x.plays as number })),
      headsUpSeconds: settings?.headsUpSeconds ?? 60,
    };
  }
  // limited daily overview — managers may see it (today only, no all-time revenue)
  if (r[1] === "overview" && method === "GET") {
    await requireAdmin(ctx, c);
    const t0 = startOfToday();
    const now = Date.now();
    const [todayPurchases, activeSessions, rewardsToday] = await Promise.all([
      c.purchases.find({ createdAt: { $gte: t0 } }).toArray(),
      c.purchases.countDocuments({ kind: "game", mainEndsAt: { $gt: now } }),
      c.redemptions.countDocuments({ redeemedAt: { $gte: t0 } }),
    ]);
    const revToday = todayPurchases.reduce((n, p) => n + p.amountKobo, 0);
    return {
      revenueTodayKobo: revToday, revenueTodayLabel: money(revToday, "NGN"),
      gamesToday: todayPurchases.filter((p) => p.kind === "game").length,
      itemsToday: todayPurchases.filter((p) => p.kind === "item").reduce((n, p) => n + p.quantity, 0),
      activeSessions,
      rewardsToday,
    };
  }

  // deep analytics for admin/staff — trends, top sellers, staff & customers
  if (r[1] === "analytics" && method === "GET") {
    await requireNonManager(ctx, c);
    const period = String(query.get("period") ?? "week");
    const since = periodSince(period);
    const now = Date.now();
    const purchases = await c.purchases.find(since ? { createdAt: { $gte: since } } : {}).toArray();

    // daily trend buckets (capped so "all time" can't explode)
    const DAY = 86400000;
    const firstTs = purchases.length ? Math.min(...purchases.map((p) => p.createdAt)) : now;
    let startDay = new Date(since || firstTs); startDay.setHours(0, 0, 0, 0);
    const todayDay = new Date(); todayDay.setHours(0, 0, 0, 0);
    if ((todayDay.getTime() - startDay.getTime()) / DAY > 90) startDay = new Date(todayDay.getTime() - 90 * DAY);
    const bmap = new Map<number, { rev: number; games: number; items: number }>();
    for (const p of purchases) {
      const d = new Date(p.createdAt); d.setHours(0, 0, 0, 0);
      const b = bmap.get(d.getTime()) ?? { rev: 0, games: 0, items: 0 };
      b.rev += p.amountKobo;
      if (p.kind === "game") b.games += 1; else b.items += p.quantity;
      bmap.set(d.getTime(), b);
    }
    const trends: { date: string; revenueKobo: number; revenueLabel: string; games: number; items: number }[] = [];
    for (let t = startDay.getTime(); t <= todayDay.getTime(); t += DAY) {
      const b = bmap.get(t) ?? { rev: 0, games: 0, items: 0 };
      trends.push({ date: new Date(t).toISOString(), revenueKobo: b.rev, revenueLabel: money(b.rev, "NGN"), games: b.games, items: b.items });
    }

    // top games / items
    const gStats = new Map<string, { name: string; plays: number; rev: number }>();
    const iStats = new Map<string, { name: string; qty: number; rev: number }>();
    for (const p of purchases) {
      if (p.kind === "game") {
        const s = gStats.get(p.refId) ?? { name: p.name, plays: 0, rev: 0 };
        s.plays += 1; s.rev += p.amountKobo; gStats.set(p.refId, s);
      } else {
        const s = iStats.get(p.refId) ?? { name: p.name, qty: 0, rev: 0 };
        s.qty += p.quantity; s.rev += p.amountKobo; iStats.set(p.refId, s);
      }
    }
    const topGames = [...gStats.values()].sort((a, b) => b.rev - a.rev).slice(0, 6).map((s) => ({ name: s.name, plays: s.plays, revenueKobo: s.rev, revenueLabel: money(s.rev, "NGN") }));
    const topItems = [...iStats.values()].sort((a, b) => b.rev - a.rev).slice(0, 6).map((s) => ({ name: s.name, qty: s.qty, revenueKobo: s.rev, revenueLabel: money(s.rev, "NGN") }));

    // category (kids/teen) + type (games/items) splits
    const games = await c.games.find({ _id: { $in: [...gStats.keys()] } }).toArray();
    const gcat = new Map(games.map((g) => [g._id, g.category]));
    let kidsKobo = 0, teenKobo = 0;
    for (const [refId, s] of gStats) { if (gcat.get(refId) === "kids") kidsKobo += s.rev; else teenKobo += s.rev; }
    const gamesKobo = purchases.filter((p) => p.kind === "game").reduce((n, p) => n + p.amountKobo, 0);
    const itemsKobo = purchases.filter((p) => p.kind === "item").reduce((n, p) => n + p.amountKobo, 0);

    // attendant performance (orders ≈ distinct player+timestamp)
    const aStats = new Map<string, { orders: Set<string>; rev: number }>();
    for (const p of purchases) {
      const aid = p.attendantId ?? "—";
      const s = aStats.get(aid) ?? { orders: new Set<string>(), rev: 0 };
      s.orders.add(`${p.playerId}:${p.createdAt}`); s.rev += p.amountKobo; aStats.set(aid, s);
    }
    const atts = await c.attendants.find({ _id: { $in: [...aStats.keys()].filter((k) => k !== "—") } }).toArray();
    const amap = new Map(atts.map((a) => [a._id, a.name]));
    const attendants = [...aStats.entries()].map(([aid, s]) => ({ name: aid === "—" ? "Unassigned" : amap.get(aid) ?? "Removed", orders: s.orders.size, revenueKobo: s.rev, revenueLabel: money(s.rev, "NGN") })).sort((a, b) => b.revenueKobo - a.revenueKobo);

    // customer insights
    const playerIds = [...new Set(purchases.map((p) => p.playerId))];
    const players = await c.players.find({ _id: { $in: playerIds } }).toArray();
    const pmap = new Map(players.map((pl) => [pl._id, pl]));
    const spend = new Map<string, number>();
    for (const p of purchases) spend.set(p.playerId, (spend.get(p.playerId) ?? 0) + p.amountKobo);
    let newCount = 0, returningCount = 0;
    for (const pid of playerIds) {
      const pl = pmap.get(pid);
      if (since && pl && pl.createdAt >= since) newCount += 1; else returningCount += 1;
    }
    const topSpenders = playerIds.map((pid) => { const pl = pmap.get(pid); return { name: pl?.name ?? pl?.phone ?? "Guest", revenueKobo: spend.get(pid) ?? 0 }; }).sort((a, b) => b.revenueKobo - a.revenueKobo).slice(0, 6).map((s) => ({ name: s.name, revenueKobo: s.revenueKobo, revenueLabel: money(s.revenueKobo, "NGN") }));

    return {
      period,
      totalRevenueLabel: money(gamesKobo + itemsKobo, "NGN"),
      trends, topGames, topItems,
      categorySplit: { kidsKobo, teenKobo, kidsLabel: money(kidsKobo, "NGN"), teenLabel: money(teenKobo, "NGN") },
      typeSplit: { gamesKobo, itemsKobo, gamesLabel: money(gamesKobo, "NGN"), itemsLabel: money(itemsKobo, "NGN") },
      attendants, newCount, returningCount, topSpenders,
    };
  }

  // games
  if (r[1] === "games" && !r[2] && method === "GET") { await requireAdmin(ctx, c); return { games: (await c.games.find({}).toArray()).map(sGame) }; }
  if (r[1] === "games" && !r[2] && method === "POST") { await requireAdmin(ctx, c); const g = await buildGame(c, b); await c.games.insertOne(g); return { game: sGame(g) }; }
  if (r[1] === "games" && r[2] && method === "PATCH") {
    await requireAdmin(ctx, c);
    const set = pickGameFields(b);
    const res = await c.games.findOneAndUpdate({ _id: r[2] }, { $set: set }, { returnDocument: "after" });
    if (!res) throw new HttpError(404, "game_not_found", "Game not found.");
    return { game: sGame(res) };
  }
  if (r[1] === "games" && r[2] && method === "DELETE") {
    await requireAdmin(ctx, c, "admin");
    if (await c.purchases.findOne({ kind: "game", refId: r[2] })) throw new HttpError(409, "game_in_use", "This game has purchase history. Deactivate it instead of deleting.");
    await c.games.deleteOne({ _id: r[2] });
    return { deleted: true };
  }

  // items
  if (r[1] === "items" && !r[2] && method === "GET") { await requireAdmin(ctx, c); return { items: (await c.items.find({}).toArray()).map(sItem) }; }
  if (r[1] === "items" && !r[2] && method === "POST") {
    await requireAdmin(ctx, c);
    const name = String(b.name ?? "").trim();
    if (!name) throw new HttpError(400, "validation_error", "Name is required.");
    const item: Item = { _id: newId("item"), name, description: (b.description as string) || null, icon: String(b.icon ?? "coins"), priceKobo: Math.max(0, Math.round(Number(b.priceKobo ?? 0))), active: b.active !== false, createdAt: Date.now() };
    await c.items.insertOne(item);
    return { item: sItem(item) };
  }
  if (r[1] === "items" && r[2] && method === "PATCH") {
    await requireAdmin(ctx, c);
    const set: Record<string, unknown> = {};
    if ("name" in b) set.name = String(b.name);
    if ("description" in b) set.description = (b.description as string) || null;
    if ("icon" in b) set.icon = String(b.icon);
    if ("priceKobo" in b) set.priceKobo = Math.max(0, Math.round(Number(b.priceKobo)));
    if ("active" in b) set.active = Boolean(b.active);
    const res = await c.items.findOneAndUpdate({ _id: r[2] }, { $set: set }, { returnDocument: "after" });
    if (!res) throw new HttpError(404, "item_not_found", "Item not found.");
    return { item: sItem(res) };
  }
  if (r[1] === "items" && r[2] && method === "DELETE") {
    await requireAdmin(ctx, c, "admin");
    if (await c.purchases.findOne({ kind: "item", refId: r[2] })) { await c.items.updateOne({ _id: r[2] }, { $set: { active: false } }); return { disabled: true }; }
    await c.items.deleteOne({ _id: r[2] });
    return { deleted: true };
  }

  // rewards
  if (r[1] === "rewards" && !r[2] && method === "GET") { await requireNonManager(ctx, c); const rewards = await c.rewards.find({}).sort({ spendRequiredKobo: 1 }).toArray(); return { rewards: rewards.map((x) => ({ id: x._id, name: x.name, description: x.description, spendRequiredKobo: x.spendRequiredKobo, spendRequiredLabel: money(x.spendRequiredKobo, "NGN"), terms: x.terms ?? null, active: x.active })) }; }
  if (r[1] === "rewards" && !r[2] && method === "POST") {
    await requireNonManager(ctx, c);
    const name = String(b.name ?? "").trim();
    if (!name) throw new HttpError(400, "validation_error", "Name is required.");
    const reward: Reward = { _id: newId("rwd"), name, description: (b.description as string) || null, spendRequiredKobo: Math.max(100, Math.round(Number(b.spendRequiredKobo ?? 100))), terms: parseTerms(b.terms), active: b.active !== false, createdAt: Date.now() };
    await c.rewards.insertOne(reward);
    return { reward: { id: reward._id, ...reward } };
  }
  if (r[1] === "rewards" && r[2] && method === "PATCH") {
    await requireNonManager(ctx, c);
    const set: Record<string, unknown> = {};
    if ("name" in b) set.name = String(b.name);
    if ("description" in b) set.description = (b.description as string) || null;
    if ("spendRequiredKobo" in b) set.spendRequiredKobo = Math.max(100, Math.round(Number(b.spendRequiredKobo)));
    if ("terms" in b) set.terms = parseTerms(b.terms);
    if ("active" in b) set.active = Boolean(b.active);
    const res = await c.rewards.findOneAndUpdate({ _id: r[2] }, { $set: set }, { returnDocument: "after" });
    if (!res) throw new HttpError(404, "reward_not_found", "Reward not found.");
    return { reward: { id: res._id, ...res } };
  }
  if (r[1] === "rewards" && r[2] && method === "DELETE") {
    await requireAdmin(ctx, c, "admin");
    if (await c.redemptions.findOne({ rewardId: r[2] })) { await c.rewards.updateOne({ _id: r[2] }, { $set: { active: false } }); return { disabled: true }; }
    await c.rewards.deleteOne({ _id: r[2] });
    return { deleted: true };
  }

  // attendants
  if (r[1] === "attendants" && !r[2] && method === "GET") {
    await requireAdmin(ctx, c);
    const atts = await c.attendants.find({}).sort({ createdAt: -1 }).toArray();
    return { attendants: atts.map((a) => ({ id: a._id, name: a.name, username: a.username, password: a.password, createdAt: iso(a.createdAt) })) };
  }
  if (r[1] === "attendants" && !r[2] && method === "POST") {
    await requireAdmin(ctx, c, "admin");
    const name = String(b.name ?? "").trim();
    const username = String(b.username ?? "").trim().toLowerCase();
    const password = String(b.password ?? "");
    if (!name || !username || !password) throw new HttpError(400, "validation_error", "Name, username and password are all required.");
    if (await c.attendants.findOne({ username })) throw new HttpError(409, "username_taken", "That username is already taken.");
    const att: Attendant = { _id: newId("att"), name, username, password, createdAt: Date.now() };
    await c.attendants.insertOne(att);
    return { attendant: { id: att._id, name: att.name, username: att.username, createdAt: iso(att.createdAt) } };
  }
  if (r[1] === "attendants" && r[2] && method === "DELETE") {
    await requireAdmin(ctx, c, "admin");
    await c.attendants.deleteOne({ _id: r[2] });
    return { deleted: true };
  }

  // managers — limited operators, stored as admin docs with role "manager" (admin only)
  if (r[1] === "managers" && !r[2] && method === "GET") {
    await requireAdmin(ctx, c, "admin");
    const mgrs = await c.admins.find({ role: "manager" }).toArray();
    return { managers: mgrs.map((m) => ({ id: m._id, name: m.name, email: m.email, password: m.password })) };
  }
  if (r[1] === "managers" && !r[2] && method === "POST") {
    await requireAdmin(ctx, c, "admin");
    const name = String(b.name ?? "").trim();
    const email = String(b.email ?? "").trim().toLowerCase();
    const password = String(b.password ?? "");
    if (!name || !email || !password) throw new HttpError(400, "validation_error", "Name, email and password are all required.");
    if (await c.admins.findOne({ email })) throw new HttpError(409, "email_taken", "That email is already in use.");
    const mgr = { _id: newId("mgr"), name, email, password, role: "manager" };
    await c.admins.insertOne(mgr);
    return { manager: { id: mgr._id, name: mgr.name, email: mgr.email } };
  }
  if (r[1] === "managers" && r[2] && method === "DELETE") {
    await requireAdmin(ctx, c, "admin");
    await c.admins.deleteOne({ _id: r[2], role: "manager" });
    return { deleted: true };
  }

  // players
  if (r[1] === "players" && !r[2] && method === "GET") {
    await requireNonManager(ctx, c);
    const q = (query.get("q") ?? "").trim();
    // escape regex metacharacters so a search term can't inject a costly/greedy pattern
    const rx = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const filter = q ? { $or: [{ name: { $regex: rx, $options: "i" } }, { phone: { $regex: rx } }] } : {};
    const [players, spendAgg, gpAgg, redAgg] = await Promise.all([
      c.players.find(filter).limit(300).toArray(),
      c.purchases.aggregate([{ $group: { _id: "$playerId", total: { $sum: "$amountKobo" } } }]).toArray(),
      c.purchases.aggregate([{ $match: { kind: "game", mainEndsAt: { $lte: Date.now() } } }, { $group: { _id: "$playerId", n: { $sum: 1 } } }]).toArray(),
      c.redemptions.aggregate([{ $group: { _id: "$playerId", n: { $sum: 1 } } }]).toArray(),
    ]);
    const spendMap = new Map(spendAgg.map((s) => [s._id as string, s.total as number]));
    const gpMap = new Map(gpAgg.map((s) => [s._id as string, s.n as number]));
    const redMap = new Map(redAgg.map((s) => [s._id as string, s.n as number]));
    const rows = players
      .map((p) => ({ id: p._id, phone: p.phone, name: p.name, firstName: firstNameOf(p.name), spentKobo: spendMap.get(p._id) ?? 0, spentLabel: ngn(spendMap.get(p._id) ?? 0), gamesPlayed: gpMap.get(p._id) ?? 0, redemptions: redMap.get(p._id) ?? 0, createdAt: iso(p.createdAt) }))
      .sort((a, z) => z.spentKobo - a.spentKobo)
      .slice(0, 100);
    return { players: rows };
  }
  if (r[1] === "players" && r[2] && method === "GET") {
    await requireNonManager(ctx, c);
    const p = await c.players.findOne({ _id: r[2] });
    if (!p) throw new HttpError(404, "player_not_found", "Player not found.");
    const [spent, gp, purchases, reds] = await Promise.all([
      spentOf(c, p._id), gamesPlayedOf(c, p._id),
      c.purchases.find({ playerId: p._id }).sort({ createdAt: -1 }).toArray(),
      c.redemptions.find({ playerId: p._id }).sort({ redeemedAt: -1 }).toArray(),
    ]);
    const rewards = await c.rewards.find({ _id: { $in: reds.map((x) => x.rewardId) } }).toArray();
    const rmap = new Map(rewards.map((x) => [x._id, x.name]));
    return {
      player: { ...sPlayer(p), spentKobo: spent, spentLabel: ngn(spent), gamesPlayed: gp },
      purchases: purchases.map(sPurchase),
      redemptions: reds.map((x) => ({ id: x._id, rewardName: rmap.get(x.rewardId) ?? "—", code: x.code, redeemedAt: iso(x.redeemedAt) })),
    };
  }

  // logs
  // sales — recent purchases that managers/admin can view and correct (attendant mistakes)
  if (r[1] === "sales" && !r[2] && method === "GET") {
    await requireAdmin(ctx, c);
    const purchases = await c.purchases.find({}).sort({ createdAt: -1 }).limit(60).toArray();
    const ids = [...new Set(purchases.map((p) => p.playerId))];
    const players = await c.players.find({ _id: { $in: ids } }).toArray();
    const pmap = new Map(players.map((pl) => [pl._id, pl]));
    return {
      sales: purchases.map((p) => {
        const pl = pmap.get(p.playerId);
        return {
          id: p._id, kind: p.kind, name: p.name, quantity: p.quantity, amountLabel: ngn(p.amountKobo),
          createdAt: iso(p.createdAt),
          player: pl ? { firstName: firstNameOf(pl.name), phone: pl.phone } : null,
          edited: p.editedAt != null, editedByName: p.editedByName ?? null,
          originalQuantity: p.originalQuantity ?? null,
          originalAmountLabel: p.originalAmountKobo != null ? ngn(p.originalAmountKobo) : null,
        };
      }),
    };
  }
  if (r[1] === "sales" && r[2] && method === "PATCH") {
    const me = await requireAdmin(ctx, c);
    const purchase = await c.purchases.findOne({ _id: r[2] });
    if (!purchase) throw new HttpError(404, "not_found", "Sale not found.");
    const newQty = Math.max(1, Math.floor(Number(b.quantity ?? purchase.quantity)) || 1);
    if (newQty === purchase.quantity) return { ok: true, unchanged: true };
    const unit = Math.round(purchase.amountKobo / Math.max(1, purchase.quantity));
    const set: Record<string, unknown> = { quantity: newQty, amountKobo: unit * newQty, editedAt: Date.now(), editedByName: me.name };
    if (purchase.originalQuantity == null) { set.originalQuantity = purchase.quantity; set.originalAmountKobo = purchase.amountKobo; }
    if (purchase.kind === "game" && purchase.headsUpEndsAt != null && purchase.mainEndsAt != null) {
      const perUnit = (purchase.mainEndsAt - purchase.headsUpEndsAt) / Math.max(1, purchase.quantity);
      set.mainEndsAt = Math.round(purchase.headsUpEndsAt + perUnit * newQty);
    }
    await c.purchases.updateOne({ _id: r[2] }, { $set: set });
    return { ok: true };
  }

  if (r[1] === "logs" && method === "GET") {
    await requireNonManager(ctx, c);
    const kind = query.get("kind");
    const filter = kind && kind !== "all" ? { kind: kind as "game" | "item" } : {};
    const purchases = await c.purchases.find(filter).sort({ createdAt: -1 }).limit(200).toArray();
    const [players, attendants] = await Promise.all([
      c.players.find({ _id: { $in: [...new Set(purchases.map((p) => p.playerId))] } }).toArray(),
      c.attendants.find({ _id: { $in: [...new Set(purchases.map((p) => p.attendantId).filter(Boolean) as string[])] } }).toArray(),
    ]);
    const pmap = new Map(players.map((p) => [p._id, p]));
    const amap = new Map(attendants.map((a) => [a._id, a.name]));
    return {
      logs: purchases.map((p) => ({
        ...sPurchase(p),
        player: { id: p.playerId, firstName: firstNameOf(pmap.get(p.playerId)?.name ?? null), phone: pmap.get(p.playerId)?.phone ?? "" },
        attendant: (p.attendantId && amap.get(p.attendantId)) || "—",
      })),
    };
  }

  throw new HttpError(404, "not_found", `No admin handler for ${method} /${r.join("/")}`);
}

function pickGameFields(b: Body) {
  const out: Record<string, unknown> = {};
  for (const k of ["name", "description", "category", "icon", "location", "priceKobo", "durationMinutes", "minAge", "minHeightCm", "instructions", "rules", "safety", "status", "featured"] as const) {
    if (k in b) out[k] = k === "priceKobo" || k === "durationMinutes" ? Math.max(0, Math.round(Number(b[k]))) : b[k];
  }
  return out;
}
async function buildGame(c: Cols, b: Body): Promise<Game> {
  const name = String(b.name ?? "").trim();
  if (!name) throw new HttpError(400, "validation_error", "Name is required.");
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "game";
  let slug = base;
  let n = 2;
  while (await c.games.findOne({ slug })) slug = `${base}-${n++}`;
  return {
    _id: newId("game"), name, slug,
    description: String(b.description ?? ""), category: b.category === "kids" ? "kids" : "teen", icon: String(b.icon ?? "gamepad"), location: String(b.location ?? ""),
    priceKobo: Math.max(0, Math.round(Number(b.priceKobo ?? 100000))), durationMinutes: Math.max(1, Math.round(Number(b.durationMinutes ?? 60))),
    minAge: b.minAge == null || b.minAge === "" ? null : Number(b.minAge), minHeightCm: b.minHeightCm == null || b.minHeightCm === "" ? null : Number(b.minHeightCm),
    instructions: (b.instructions as string) || null, rules: (b.rules as string) || null, safety: (b.safety as string) || null,
    status: String(b.status ?? "active"), featured: Boolean(b.featured), createdAt: Date.now(),
  };
}
