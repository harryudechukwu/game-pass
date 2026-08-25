import {
  db,
  persist,
  newId,
  now,
  type Store,
  type Game,
  type GameLog,
  type Player,
  type Reward,
} from "@/lib/local/store";

// Client-side engine. Every "endpoint" is a synchronous operation over the
// localStorage store. Single-threaded, so no races.

export class LocalError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// ── serializers ───────────────────────────────────────────────────────────
const iso = (ms: number | null | undefined) => (ms == null ? null : new Date(ms).toISOString());
const firstNameOf = (name: string | null) => (name ? (name.trim().split(/\s+/)[0] ?? null) : null);
const durationLabel = (s: number) => (Math.round(s / 60) >= 1 ? `${Math.round(s / 60)} min` : `${s}s`);

function sGame(g: Game) {
  return {
    id: g.id, slug: g.slug, name: g.name, description: g.description, imageUrl: g.imageUrl,
    location: g.location, durationSeconds: g.durationSeconds, durationLabel: durationLabel(g.durationSeconds),
    minPlayers: g.minPlayers, maxPlayers: g.maxPlayers,
    playersLabel: g.minPlayers === g.maxPlayers ? `${g.minPlayers} player${g.minPlayers > 1 ? "s" : ""}` : `${g.minPlayers}–${g.maxPlayers} players`,
    minAge: g.minAge, minHeightCm: g.minHeightCm, instructions: g.instructions, rules: g.rules, safety: g.safety,
    status: g.status, featured: g.featured, available: g.status === "active",
  };
}
function gameLite(g: Game | undefined) {
  return g ? { id: g.id, name: g.name, imageUrl: g.imageUrl, location: g.location, durationLabel: durationLabel(g.durationSeconds) } : null;
}
function sLog(s: Store, l: GameLog) {
  return { id: l.id, loggedAt: iso(l.loggedAt), note: l.note, game: gameLite(s.games.find((g) => g.id === l.gameId)) };
}
function sPlayer(p: Player) {
  return { id: p.id, phone: p.phone, name: p.name, firstName: firstNameOf(p.name), createdAt: iso(p.createdAt) };
}

// ── helpers ───────────────────────────────────────────────────────────────
const gamesPlayed = (s: Store, playerId: string) => s.logs.filter((l) => l.playerId === playerId).length;
const isRedeemed = (s: Store, playerId: string, rewardId: string) => s.redemptions.some((x) => x.playerId === playerId && x.rewardId === rewardId);
function claimableRewards(s: Store, playerId: string) {
  const count = gamesPlayed(s, playerId);
  return s.rewards.filter((r) => r.active && count >= r.gamesRequired && !isRedeemed(s, playerId, r.id));
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
  const r = rawPath.split("/").filter(Boolean).slice(1); // drop "api"
  const b = (body ?? {}) as Record<string, unknown>;
  const done = <T>(d: T) => { persist(); return d; };

  // ── player auth ──
  if (r[0] === "auth" && r[1] === "login" && method === "POST") {
    const phone = normPhone(b.phone);
    if (phone.length < 6) throw new LocalError(400, "validation_error", "Enter a valid phone number.");
    let player = s.players.find((p) => p.phone === phone);
    let isNew = false;
    if (!player) {
      player = { id: newId("ply"), phone, name: (b.name as string)?.trim() || null, createdAt: now() };
      s.players.push(player);
      isNew = true;
    }
    s.sessionPlayerId = player.id;
    return done({ player: sPlayer(player), isNew });
  }
  if (r[0] === "auth" && r[1] === "logout" && method === "POST") {
    s.sessionPlayerId = null;
    return done({ loggedOut: true });
  }
  if (r[0] === "me" && method === "GET") {
    const p = requirePlayer(s);
    return { player: sPlayer(p), gamesPlayed: gamesPlayed(s, p.id), claimable: claimableRewards(s, p.id).length };
  }

  // ── player: logged games feed ──
  if (r[0] === "logs" && method === "GET") {
    const p = requirePlayer(s);
    const logs = s.logs.filter((l) => l.playerId === p.id).sort((a, z) => z.loggedAt - a.loggedAt).map((l) => sLog(s, l));
    return { gamesPlayed: logs.length, logs };
  }

  // ── player: rewards + redeem ──
  if (r[0] === "rewards" && !r[1] && method === "GET") {
    const p = requirePlayer(s);
    const count = gamesPlayed(s, p.id);
    const rewards = [...s.rewards].filter((x) => x.active).sort((a, z) => a.gamesRequired - z.gamesRequired).map((x) => {
      const red = s.redemptions.find((y) => y.playerId === p.id && y.rewardId === x.id);
      const unlocked = count >= x.gamesRequired;
      return { id: x.id, name: x.name, description: x.description, gamesRequired: x.gamesRequired, unlocked, redeemed: !!red, code: red?.code ?? null, claimable: unlocked && !red };
    });
    const nextReward = [...s.rewards].filter((x) => x.active && x.gamesRequired > count).sort((a, z) => a.gamesRequired - z.gamesRequired)[0] ?? null;
    return { gamesPlayed: count, nextReward: nextReward ? { name: nextReward.name, gamesRequired: nextReward.gamesRequired, remaining: nextReward.gamesRequired - count } : null, rewards };
  }
  if (r[0] === "rewards" && r[1] && r[2] === "redeem" && method === "POST") {
    const p = requirePlayer(s);
    const reward = s.rewards.find((x) => x.id === r[1]);
    if (!reward || !reward.active) throw new LocalError(404, "reward_not_found", "Reward not found.");
    if (gamesPlayed(s, p.id) < reward.gamesRequired) throw new LocalError(403, "reward_locked", `Play ${reward.gamesRequired} games to unlock this reward.`);
    if (isRedeemed(s, p.id, reward.id)) throw new LocalError(409, "already_redeemed", "You've already redeemed this reward.");
    const code = rewardCode();
    s.redemptions.push({ id: newId("red"), playerId: p.id, rewardId: reward.id, code, redeemedAt: now() });
    return done({ redeemed: true, code, reward: { name: reward.name, description: reward.description } });
  }

  // ── attendant (open in the demo) ──
  if (r[0] === "attendant" && r[1] === "games" && method === "GET") {
    return { games: s.games.filter((g) => g.status === "active").sort((a, z) => Number(z.featured) - Number(a.featured) || a.createdAt - z.createdAt).map(sGame) };
  }
  if (r[0] === "attendant" && r[1] === "lookup" && method === "GET") {
    const phone = normPhone(q.get("phone"));
    const p = s.players.find((x) => x.phone === phone);
    return { phone, found: !!p, player: p ? { ...sPlayer(p), gamesPlayed: gamesPlayed(s, p.id) } : null };
  }
  if (r[0] === "attendant" && r[1] === "log" && method === "POST") {
    const phone = normPhone(b.phone);
    if (phone.length < 6) throw new LocalError(400, "validation_error", "Enter the player's phone number.");
    const game = s.games.find((g) => g.id === String(b.gameId));
    if (!game) throw new LocalError(404, "game_not_found", "Pick a game to log.");
    if (game.status !== "active") throw new LocalError(409, "game_unavailable", "That game is not active.");
    let player = s.players.find((x) => x.phone === phone);
    let isNewPlayer = false;
    if (!player) {
      player = { id: newId("ply"), phone, name: (b.name as string)?.trim() || null, createdAt: now() };
      s.players.push(player);
      isNewPlayer = true;
    } else if (!player.name && (b.name as string)?.trim()) {
      player.name = (b.name as string).trim();
    }
    const log: GameLog = { id: newId("log"), playerId: player.id, gameId: game.id, attendantId: s.adminId ?? "attendant", note: (b.note as string) || null, loggedAt: now() };
    s.logs.push(log);
    const count = gamesPlayed(s, player.id);
    return done({ log: { ...sLog(s, log), game: sGame(game) }, player: { ...sPlayer(player), gamesPlayed: count }, isNewPlayer, unlockedRewards: claimableRewards(s, player.id).map((x) => ({ id: x.id, name: x.name })) });
  }
  if (r[0] === "attendant" && r[1] === "recent" && method === "GET") {
    const logs = [...s.logs].sort((a, z) => z.loggedAt - a.loggedAt).slice(0, 12).map((l) => {
      const p = s.players.find((x) => x.id === l.playerId);
      return { id: l.id, loggedAt: iso(l.loggedAt), game: gameLite(s.games.find((g) => g.id === l.gameId)), player: { firstName: firstNameOf(p?.name ?? null), phone: p?.phone ?? "" } };
    });
    return { logs };
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

  if (r[1] === "stats" && method === "GET") {
    requireAdmin(s);
    const start = new Date(); start.setHours(0, 0, 0, 0); const t0 = start.getTime();
    const popular = Object.entries(s.logs.reduce<Record<string, number>>((m, l) => { m[l.gameId] = (m[l.gameId] ?? 0) + 1; return m; }, {}))
      .sort((a, z) => z[1] - a[1]).slice(0, 5)
      .map(([gameId, plays]) => ({ gameId, name: s.games.find((g) => g.id === gameId)?.name ?? "—", plays }));
    return {
      totalPlayers: s.players.length,
      gamesLoggedToday: s.logs.filter((l) => l.loggedAt >= t0).length,
      gamesLoggedTotal: s.logs.length,
      rewardsRedeemedToday: s.redemptions.filter((x) => x.redeemedAt >= t0).length,
      rewardsRedeemedTotal: s.redemptions.length,
      activeRewards: s.rewards.filter((x) => x.active).length,
      activeGames: s.games.filter((g) => g.status === "active").length,
      popularGames: popular,
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
    if (s.logs.some((l) => l.gameId === r[2])) throw new LocalError(409, "game_in_use", "This game has play history. Deactivate it instead of deleting.");
    s.games = s.games.filter((x) => x.id !== r[2]);
    return done({ deleted: true });
  }

  // rewards
  if (r[1] === "rewards" && !r[2] && method === "GET") { requireAdmin(s); return { rewards: [...s.rewards].sort((a, z) => a.gamesRequired - z.gamesRequired) }; }
  if (r[1] === "rewards" && !r[2] && method === "POST") {
    requireAdmin(s);
    const name = String(b.name ?? "").trim();
    if (!name) throw new LocalError(400, "validation_error", "Name is required.");
    const reward: Reward = { id: newId("rwd"), name, description: (b.description as string) || null, gamesRequired: Math.max(1, Number(b.gamesRequired ?? 1)), active: b.active !== false, createdAt: now() };
    s.rewards.push(reward);
    return done({ reward });
  }
  if (r[1] === "rewards" && r[2] && method === "PATCH") {
    requireAdmin(s);
    const reward = s.rewards.find((x) => x.id === r[2]);
    if (!reward) throw new LocalError(404, "reward_not_found", "Reward not found.");
    if ("name" in b) reward.name = String(b.name);
    if ("description" in b) reward.description = (b.description as string) || null;
    if ("gamesRequired" in b) reward.gamesRequired = Math.max(1, Number(b.gamesRequired));
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
    const rows = s.players.filter((p) => !query || (p.name ?? "").toLowerCase().includes(query) || p.phone.includes(query)).sort((a, z) => z.createdAt - a.createdAt).slice(0, 100)
      .map((p) => ({ id: p.id, phone: p.phone, name: p.name, firstName: firstNameOf(p.name), gamesPlayed: gamesPlayed(s, p.id), redemptions: s.redemptions.filter((x) => x.playerId === p.id).length, createdAt: iso(p.createdAt) }));
    return { players: rows };
  }
  if (r[1] === "players" && r[2] && method === "GET") {
    requireAdmin(s);
    const p = s.players.find((x) => x.id === r[2]);
    if (!p) throw new LocalError(404, "player_not_found", "Player not found.");
    return {
      player: { ...sPlayer(p), gamesPlayed: gamesPlayed(s, p.id) },
      logs: s.logs.filter((l) => l.playerId === p.id).sort((a, z) => z.loggedAt - a.loggedAt).map((l) => sLog(s, l)),
      redemptions: s.redemptions.filter((x) => x.playerId === p.id).sort((a, z) => z.redeemedAt - a.redeemedAt).map((x) => ({ id: x.id, rewardName: s.rewards.find((y) => y.id === x.rewardId)?.name ?? "—", code: x.code, redeemedAt: iso(x.redeemedAt) })),
    };
  }

  // logs
  if (r[1] === "logs" && method === "GET") {
    requireAdmin(s);
    const logs = [...s.logs].sort((a, z) => z.loggedAt - a.loggedAt).slice(0, 200).map((l) => {
      const p = s.players.find((x) => x.id === l.playerId);
      return { id: l.id, loggedAt: iso(l.loggedAt), game: gameLite(s.games.find((g) => g.id === l.gameId)), player: { id: p?.id, firstName: firstNameOf(p?.name ?? null), phone: p?.phone ?? "" }, attendantId: l.attendantId };
    });
    return { logs };
  }

  throw new LocalError(404, "not_found", `No local admin handler for ${method} ${r.join("/")}`);
}

function pickGameFields(b: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of ["name", "description", "imageUrl", "location", "durationSeconds", "minPlayers", "maxPlayers", "minAge", "minHeightCm", "instructions", "rules", "safety", "status", "featured"] as const) {
    if (k in b) out[k] = b[k];
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
    description: String(b.description ?? ""), imageUrl: String(b.imageUrl ?? ""), location: String(b.location ?? ""),
    durationSeconds: Number(b.durationSeconds ?? 60), minPlayers: Number(b.minPlayers ?? 1), maxPlayers: Number(b.maxPlayers ?? 1),
    minAge: b.minAge == null || b.minAge === "" ? null : Number(b.minAge), minHeightCm: b.minHeightCm == null || b.minHeightCm === "" ? null : Number(b.minHeightCm),
    instructions: (b.instructions as string) || null, rules: (b.rules as string) || null, safety: (b.safety as string) || null,
    status: String(b.status ?? "active"), featured: Boolean(b.featured), createdAt: now(),
  };
}
