import QRCode from "qrcode";
import {
  db,
  persist,
  newId,
  now,
  type Store,
  type Customer,
  type Game,
  type GameSession,
  type PlayPass,
  type RewardRule,
  type WalletTxn,
} from "@/lib/local/store";

// Client-side replacement for the backend. Every "endpoint" is a synchronous
// operation over the localStorage-backed store. Because JS is single-threaded
// there are no races, so the wallet invariants hold trivially.

export class LocalError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const SIGNUP_BONUS = 100;
const PLAY_PASS_TTL_SECONDS = 120;
const OTP_TTL_MS = 5 * 60 * 1000;

// ── serializers (shapes match the previous REST API) ──────────────────────
const iso = (ms: number | null | undefined) => (ms == null ? null : new Date(ms).toISOString());
const firstNameOf = (name: string | null) => (name ? (name.trim().split(/\s+/)[0] ?? null) : null);
const durationLabel = (s: number) => (Math.round(s / 60) >= 1 ? `${Math.round(s / 60)} min` : `${s}s`);
function money(kobo: number, currency: string) {
  const symbol = currency === "NGN" ? "₦" : "";
  return `${symbol}${(kobo / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function sGame(g: Game) {
  return {
    id: g.id, slug: g.slug, name: g.name, description: g.description, imageUrl: g.imageUrl,
    pointCost: g.pointCost, durationSeconds: g.durationSeconds, durationLabel: durationLabel(g.durationSeconds),
    minPlayers: g.minPlayers, maxPlayers: g.maxPlayers,
    playersLabel: g.minPlayers === g.maxPlayers ? `${g.minPlayers} player${g.minPlayers > 1 ? "s" : ""}` : `${g.minPlayers}–${g.maxPlayers} players`,
    location: g.location, minAge: g.minAge, minHeightCm: g.minHeightCm,
    instructions: g.instructions, rules: g.rules, safety: g.safety,
    status: g.status, selfServiceMode: g.selfServiceMode, featured: g.featured, available: g.status === "active",
  };
}
function sPass(s: Store, p: PlayPass, qrDataUrl?: string) {
  const game = s.games.find((g) => g.id === p.gameId);
  const session = s.sessions.find((x) => x.playPassId === p.id);
  return {
    id: p.id, status: p.status, pointCost: p.pointCost, createdAt: iso(p.createdAt), expiresAt: iso(p.expiresAt),
    activatedAt: iso(p.activatedAt), expiresInSeconds: Math.max(0, Math.floor((p.expiresAt - Date.now()) / 1000)),
    game: game ? sGame(game) : undefined, sessionId: session?.id ?? null, sessionStatus: session?.status ?? null, qrDataUrl,
  };
}
function sSession(s: Store, x: GameSession) {
  const game = s.games.find((g) => g.id === x.gameId);
  return {
    id: x.id, status: x.status, pointsSpent: x.pointsSpent, score: x.score, rewardPointsEarned: x.rewardPointsEarned,
    startTime: iso(x.startTime), expectedEndTime: iso(x.expectedEndTime), completionTime: iso(x.completionTime),
    createdAt: iso(x.createdAt), game: game ? sGame(game) : undefined,
  };
}
function sTxn(t: WalletTxn) {
  return {
    id: t.id, amount: t.amount, type: t.type, reason: t.reason, balanceAfter: t.balanceAfter,
    referenceType: t.referenceType ?? null, referenceId: t.referenceId ?? null, createdAt: iso(t.createdAt),
  };
}
function sCustomer(c: Customer) {
  return { id: c.id, phone: c.phone, name: c.name, firstName: firstNameOf(c.name), balance: c.balance, suspended: c.suspended, createdAt: iso(c.createdAt) };
}

// ── wallet primitives ─────────────────────────────────────────────────────
type CreditInput = { customerId: string; amount: number; type: string; reason: string; referenceType?: string; referenceId?: string; createdByAdminId?: string };
function credit(s: Store, i: CreditInput): { txnId: string; balance: number } {
  const c = s.customers.find((x) => x.id === i.customerId);
  if (!c) throw new LocalError(404, "customer_not_found", "Customer not found");
  c.balance += i.amount;
  const t: WalletTxn = { id: newId("txn"), customerId: c.id, amount: i.amount, type: i.type, reason: i.reason, balanceAfter: c.balance, referenceType: i.referenceType, referenceId: i.referenceId, createdByAdminId: i.createdByAdminId, createdAt: now() };
  s.txns.push(t);
  return { txnId: t.id, balance: c.balance };
}
function debit(s: Store, i: CreditInput): { txnId: string; balance: number } {
  const c = s.customers.find((x) => x.id === i.customerId);
  if (!c) throw new LocalError(404, "customer_not_found", "Customer not found");
  if (c.suspended) throw new LocalError(403, "account_suspended", "This account is suspended");
  if (c.balance < i.amount) throw new LocalError(402, "insufficient_points", `Not enough points. Balance is ${c.balance}, this costs ${i.amount}.`);
  c.balance -= i.amount;
  const t: WalletTxn = { id: newId("txn"), customerId: c.id, amount: -i.amount, type: i.type, reason: i.reason, balanceAfter: c.balance, referenceType: i.referenceType, referenceId: i.referenceId, createdByAdminId: i.createdByAdminId, createdAt: now() };
  s.txns.push(t);
  return { txnId: t.id, balance: c.balance };
}

// ── play-pass lifecycle ───────────────────────────────────────────────────
function refundAndClose(s: Store, p: PlayPass, terminal: "cancelled" | "expired"): number {
  let refunded = 0;
  if (p.status === "created" || p.status === "activated") {
    const game = s.games.find((g) => g.id === p.gameId);
    credit(s, { customerId: p.customerId, amount: p.pointCost, type: "refund", reason: `Refund — ${terminal} Play Pass (${game?.name ?? "game"})`, referenceType: "play_pass", referenceId: p.id });
    refunded = p.pointCost;
  }
  p.status = terminal;
  for (const x of s.sessions) {
    if (x.playPassId === p.id && ["authorized", "pending", "in_progress"].includes(x.status)) {
      x.status = terminal === "cancelled" ? "cancelled" : "expired";
    }
  }
  return refunded;
}
function expireStale(s: Store, customerId?: string) {
  for (const p of s.passes) {
    if (["created", "activated"].includes(p.status) && p.expiresAt < Date.now() && (!customerId || p.customerId === customerId)) {
      refundAndClose(s, p, "expired");
    }
  }
}
function activePass(s: Store, customerId: string): PlayPass | undefined {
  return [...s.passes].reverse().find((p) => p.customerId === customerId && ["created", "activated", "in_progress"].includes(p.status));
}

// ── rewards ───────────────────────────────────────────────────────────────
function evaluateRewards(s: Store, session: GameSession, isFirstVisit: boolean, completedCount: number) {
  const issued: { ruleId: string; name: string; points: number }[] = [];
  const rules = [...s.rules].filter((r) => r.active).sort((a, b) => b.priority - a.priority);
  for (const rule of rules) {
    let matched = false;
    if (rule.conditionType === "play_completed") matched = true;
    else if (rule.conditionType === "score_above") matched = session.score != null && rule.threshold != null && session.score > rule.threshold;
    else if (rule.conditionType === "games_count") matched = rule.threshold != null && rule.threshold > 0 && completedCount % rule.threshold === 0;
    else if (rule.conditionType === "first_visit") matched = isFirstVisit;
    if (!matched) continue;
    if (rule.conditionType === "first_visit" && s.issues.some((i) => i.customerId === session.customerId && i.ruleId === rule.id)) continue;
    credit(s, { customerId: session.customerId, amount: rule.points, type: "reward", reason: `Reward — ${rule.name}`, referenceType: "reward", referenceId: rule.id });
    s.issues.push({ id: newId("iss"), customerId: session.customerId, ruleId: rule.id, sessionId: session.id, points: rule.points, createdAt: now() });
    issued.push({ ruleId: rule.id, name: rule.name, points: rule.points });
  }
  return issued;
}

// ── auth helpers ──────────────────────────────────────────────────────────
function requireCustomer(s: Store): Customer {
  const id = s.sessionCustomerId;
  const c = id ? s.customers.find((x) => x.id === id) : null;
  if (!c) throw new LocalError(401, "unauthorized", "Please sign in.");
  if (c.suspended) throw new LocalError(403, "account_suspended", "This account is suspended.");
  return c;
}
function requireAdmin(s: Store, role?: "admin") {
  const a = s.adminId ? s.admins.find((x) => x.id === s.adminId) : null;
  if (!a) throw new LocalError(401, "unauthorized", "Admin sign-in required.");
  if (role === "admin" && a.role !== "admin") throw new LocalError(403, "forbidden", "This action requires an admin account.");
  return a;
}

async function qr(token: string) {
  const svg = await QRCode.toString(token, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#0b1220", light: "#ffffff" } });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

// ── request router ────────────────────────────────────────────────────────
type Body = Record<string, unknown> | undefined;

export async function localApi(path: string, method: string, body: Body, headers?: Record<string, string>): Promise<unknown> {
  const s = db();
  const [rawPath, qs] = path.split("?");
  const q = new URLSearchParams(qs ?? "");
  const parts = rawPath.split("/").filter(Boolean); // e.g. ["api","playpass","current"]
  const r = parts.slice(1); // drop "api"
  const b = (body ?? {}) as Record<string, unknown>;
  const idemKey = headers?.["Idempotency-Key"] ?? headers?.["idempotency-key"];

  const done = <T>(data: T) => {
    persist();
    return data;
  };

  // ── auth ──
  if (r[0] === "auth" && r[1] === "otp" && method === "POST") {
    const phone = String(b.phone ?? "").replace(/\s+/g, "");
    if (phone.length < 6) throw new LocalError(400, "validation_error", "Enter a valid phone number.");
    const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
    s.otps = s.otps.filter((o) => o.phone !== phone);
    s.otps.push({ phone, code, expiresAt: now() + OTP_TTL_MS, consumed: false });
    const isRegistered = s.customers.some((c) => c.phone === phone);
    return done({ phone, isRegistered, devCode: code });
  }
  if (r[0] === "auth" && r[1] === "verify" && method === "POST") {
    const phone = String(b.phone ?? "").replace(/\s+/g, "");
    const code = String(b.code ?? "");
    const otp = s.otps.find((o) => o.phone === phone && !o.consumed && o.expiresAt > now());
    if (!otp) throw new LocalError(400, "otp_invalid", "Code expired or not found. Request a new one.");
    if (otp.code !== code) throw new LocalError(400, "otp_invalid", "Incorrect code.");
    otp.consumed = true;
    let customer = s.customers.find((c) => c.phone === phone);
    let isNew = false;
    if (!customer) {
      const name = (b.name as string | undefined)?.trim();
      const dob = b.dateOfBirth as string | undefined;
      if (!name || !dob || !b.acceptTerms) throw new LocalError(400, "registration_incomplete", "Enter your name, date of birth, and accept the terms to create your account.");
      customer = { id: newId("cus"), phone, name, dateOfBirth: new Date(dob).getTime() || null, termsAcceptedAt: now(), balance: 0, suspended: false, suspendedReason: null, firstVisitAt: null, createdAt: now() };
      s.customers.push(customer);
      credit(s, { customerId: customer.id, amount: SIGNUP_BONUS, type: "signup_bonus", reason: "Welcome bonus" });
      isNew = true;
    }
    if (customer.suspended) throw new LocalError(403, "account_suspended", "This account is suspended. Contact staff.");
    s.sessionCustomerId = customer.id;
    return done({ isNew, signupBonus: isNew ? SIGNUP_BONUS : 0, customer: sCustomer(customer) });
  }
  if (r[0] === "auth" && r[1] === "logout" && method === "POST") {
    s.sessionCustomerId = null;
    return done({ loggedOut: true });
  }
  if (r[0] === "me" && method === "GET") {
    const c = requireCustomer(s);
    expireStale(s, c.id);
    const p = activePass(s, c.id);
    return done({ customer: sCustomer(c), activePass: p ? sPass(s, p) : null });
  }

  // ── catalogue ──
  if (r[0] === "games" && !r[1] && method === "GET") {
    const games = s.games.filter((g) => ["active", "maintenance"].includes(g.status)).sort((a, z) => Number(z.featured) - Number(a.featured) || a.createdAt - z.createdAt).map(sGame);
    return { games, featured: games.filter((g) => g.featured && g.available) };
  }
  if (r[0] === "games" && r[1] && method === "GET") {
    const g = s.games.find((x) => x.id === r[1] || x.slug === r[1]);
    if (!g || g.status === "inactive") throw new LocalError(404, "game_not_found", "Game not found.");
    return { game: sGame(g) };
  }
  if (r[0] === "rewards" && method === "GET") {
    return { rewards: s.rules.filter((x) => x.active).sort((a, z) => z.priority - a.priority).map((x) => ({ id: x.id, name: x.name, description: x.description, points: x.points, conditionType: x.conditionType, threshold: x.threshold })) };
  }
  if (r[0] === "packages" && method === "GET") {
    return { packages: s.packages.filter((p) => p.active).sort((a, z) => a.sortOrder - z.sortOrder).map((p) => ({ id: p.id, name: p.name, points: p.points, bonusPoints: p.bonusPoints, totalPoints: p.points + p.bonusPoints, priceKobo: p.priceKobo, currency: p.currency, priceLabel: money(p.priceKobo, p.currency) })) };
  }

  // ── wallet / activity ──
  if (r[0] === "wallet" && method === "GET") {
    const c = requireCustomer(s);
    const transactions = s.txns.filter((t) => t.customerId === c.id).sort((a, z) => z.createdAt - a.createdAt).slice(0, 100).map(sTxn);
    return { balance: c.balance, transactions };
  }
  if (r[0] === "activity" && method === "GET") {
    const c = requireCustomer(s);
    const transactions = s.txns.filter((t) => t.customerId === c.id).sort((a, z) => z.createdAt - a.createdAt).slice(0, 100).map(sTxn);
    const sessions = s.sessions.filter((x) => x.customerId === c.id).sort((a, z) => z.createdAt - a.createdAt).slice(0, 50).map((x) => sSession(s, x));
    return { balance: c.balance, transactions, sessions };
  }

  // ── play pass ──
  if (r[0] === "playpass" && !r[1] && method === "POST") {
    const c = requireCustomer(s);
    const key = idemKey ? `pp:${c.id}:${idemKey}` : null;
    if (key && s.idempotency[key]) {
      const p = s.passes.find((x) => x.id === s.idempotency[key]);
      if (p) return done({ playPass: sPass(s, p, await qr(p.qrToken)), balance: c.balance, replay: true });
    }
    const game = s.games.find((g) => g.id === String(b.gameId));
    if (!game) throw new LocalError(404, "game_not_found", "Game not found.");
    if (game.status !== "active") throw new LocalError(409, "game_unavailable", `${game.name} is currently unavailable.`);
    expireStale(s, c.id);
    if (activePass(s, c.id)) throw new LocalError(409, "pass_active", "You already have an active Play Pass. Use or cancel it before buying another.");
    const d = debit(s, { customerId: c.id, amount: game.pointCost, type: "play_spend", reason: `Play Pass — ${game.name}` });
    const p: PlayPass = { id: newId("pass"), customerId: c.id, gameId: game.id, pointCost: game.pointCost, status: "created", qrToken: `pp_${newId("t").slice(2)}`, createdAt: now(), expiresAt: now() + PLAY_PASS_TTL_SECONDS * 1000, activatedAt: null };
    s.passes.push(p);
    const txn = s.txns.find((t) => t.id === d.txnId);
    if (txn) { txn.referenceType = "play_pass"; txn.referenceId = p.id; }
    if (key) s.idempotency[key] = p.id;
    return done({ playPass: sPass(s, p, await qr(p.qrToken)), balance: d.balance });
  }
  if (r[0] === "playpass" && r[1] === "current" && method === "GET") {
    const c = requireCustomer(s);
    expireStale(s, c.id);
    const p = activePass(s, c.id);
    if (!p) return done({ playPass: null });
    return done({ playPass: { ...sPass(s, p, await qr(p.qrToken)), qrToken: p.qrToken } });
  }
  if (r[0] === "playpass" && r[1] && r[2] === "cancel" && method === "POST") {
    const c = requireCustomer(s);
    const p = s.passes.find((x) => x.id === r[1]);
    if (!p || p.customerId !== c.id) throw new LocalError(404, "pass_not_found", "Play Pass not found.");
    if (!["created", "activated"].includes(p.status)) throw new LocalError(409, "pass_not_cancellable", "This Play Pass can no longer be cancelled.");
    const refunded = refundAndClose(s, p, "cancelled");
    return done({ cancelled: true, refunded });
  }
  if (r[0] === "playpass" && r[1] && !r[2] && method === "GET") {
    const c = requireCustomer(s);
    const p = s.passes.find((x) => x.id === r[1]);
    if (!p || p.customerId !== c.id) throw new LocalError(404, "pass_not_found", "Play Pass not found.");
    const showQr = p.status === "created" || p.status === "activated";
    return { playPass: { ...sPass(s, p, showQr ? await qr(p.qrToken) : undefined), qrToken: p.qrToken } };
  }

  // ── purchases (simulated) ──
  if (r[0] === "purchases" && !r[1] && method === "POST") {
    const c = requireCustomer(s);
    const pkg = s.packages.find((p) => p.id === String(b.packageId));
    if (!pkg || !pkg.active) throw new LocalError(404, "package_not_found", "That package is not available.");
    const purchase = { id: newId("pur"), customerId: c.id, packageId: pkg.id, pointsCredited: pkg.points + pkg.bonusPoints, amountKobo: pkg.priceKobo, currency: pkg.currency, reference: `gp_${newId("r").slice(2)}`, status: "pending", createdAt: now(), updatedAt: now() };
    s.purchases.push(purchase);
    return done({ reference: purchase.reference, amountKobo: purchase.amountKobo, currency: purchase.currency, pointsCredited: purchase.pointsCredited, package: { id: pkg.id, name: pkg.name }, simulated: true });
  }
  if (r[0] === "purchases" && r[1] === "confirm" && method === "POST") {
    const c = requireCustomer(s);
    const purchase = s.purchases.find((p) => p.reference === String(b.reference));
    if (!purchase) throw new LocalError(404, "purchase_not_found", "Purchase not found.");
    if (purchase.customerId !== c.id) throw new LocalError(403, "forbidden", "This purchase belongs to another account.");
    if (purchase.status === "success") return done({ status: "success", credited: false, pointsCredited: purchase.pointsCredited, balance: c.balance });
    if (purchase.status === "failed") throw new LocalError(409, "purchase_failed", "This purchase already failed. Start a new one.");
    if (b.outcome === "failed") { purchase.status = "failed"; purchase.updatedAt = now(); return done({ status: "failed", credited: false, pointsCredited: purchase.pointsCredited, balance: null }); }
    const pkg = s.packages.find((p) => p.id === purchase.packageId);
    const cr = credit(s, { customerId: c.id, amount: purchase.pointsCredited, type: "purchase", reason: `Purchased ${pkg?.name ?? "points"}`, referenceType: "purchase", referenceId: purchase.id });
    purchase.status = "success"; purchase.updatedAt = now();
    return done({ status: "success", credited: true, pointsCredited: purchase.pointsCredited, balance: cr.balance });
  }

  // ── station ──
  if (r[0] === "station" && r[1] === "lookup" && method === "GET") {
    const p = s.passes.find((x) => x.qrToken === q.get("token"));
    if (!p) throw new LocalError(404, "pass_not_found", "Play Pass not recognised.");
    const c = s.customers.find((x) => x.id === p.customerId);
    const g = s.games.find((x) => x.id === p.gameId)!;
    const session = s.sessions.find((x) => x.playPassId === p.id);
    return { playPassId: p.id, status: p.status, customerFirstName: firstNameOf(c?.name ?? null), game: { id: g.id, name: g.name, status: g.status }, pointCost: p.pointCost, expiresInSeconds: Math.max(0, Math.floor((p.expiresAt - Date.now()) / 1000)), sessionId: session?.id ?? null, sessionStatus: session?.status ?? null };
  }
  if (r[0] === "station" && r[1] === "activate" && method === "POST") {
    const key = idemKey ? `act:${idemKey}` : null;
    if (key && s.idempotency[key]) {
      const x = s.sessions.find((z) => z.id === s.idempotency[key]);
      if (x) return done({ authorized: true, replay: true, message: "PLAY AUTHORIZED", session: sSession(s, x), game: { id: x.gameId, name: s.games.find((g) => g.id === x.gameId)?.name } });
    }
    const p = b.qrToken ? s.passes.find((x) => x.qrToken === b.qrToken) : s.passes.find((x) => x.id === b.playPassId);
    if (!p) throw new LocalError(404, "pass_not_found", "Play Pass not recognised.");
    const c = s.customers.find((x) => x.id === p.customerId);
    if (!c || c.suspended) throw new LocalError(403, "customer_invalid", "Play Pass owner cannot play right now.");
    if (p.expiresAt < Date.now() || p.status === "expired") {
      if (["created", "activated"].includes(p.status)) refundAndClose(s, p, "expired");
      persist();
      throw new LocalError(410, "pass_expired", "This Play Pass has expired.");
    }
    if (["completed", "cancelled"].includes(p.status)) throw new LocalError(409, "pass_used", "This Play Pass has already been used.");
    const g = s.games.find((x) => x.id === p.gameId)!;
    if (g.status !== "active") throw new LocalError(409, "game_unavailable", "This game is currently unavailable.");
    if (b.expectedGameId && b.expectedGameId !== p.gameId) throw new LocalError(409, "game_mismatch", "This Play Pass is for a different game.");
    let session = s.sessions.find((x) => x.playPassId === p.id);
    if (session && session.status !== "authorized") throw new LocalError(409, "session_started", "A session has already started for this pass.");
    if (p.status === "activated" && session) return done({ authorized: true, replay: true, message: "PLAY AUTHORIZED", session: sSession(s, session), game: { id: g.id, name: g.name } });
    p.status = "activated"; p.activatedAt = now();
    session = { id: newId("ses"), customerId: p.customerId, gameId: p.gameId, playPassId: p.id, pointsSpent: p.pointCost, status: "authorized", startTime: null, expectedEndTime: null, completionTime: null, score: null, rewardPointsEarned: 0, stationId: (b.stationId as string) ?? null, createdAt: now() };
    s.sessions.push(session);
    if (key) s.idempotency[key] = session.id;
    return done({ authorized: true, replay: false, message: "PLAY AUTHORIZED", session: sSession(s, session), game: { id: g.id, name: g.name } });
  }
  if (r[0] === "station" && r[1] === "start" && method === "POST") {
    const x = s.sessions.find((z) => z.id === b.sessionId);
    if (!x) throw new LocalError(404, "session_not_found", "Session not found.");
    if (x.status === "in_progress") return done({ started: true, replay: true, session: sSession(s, x) });
    if (x.status !== "authorized") throw new LocalError(409, "bad_state", `Cannot start a session that is ${x.status}.`);
    const g = s.games.find((z) => z.id === x.gameId)!;
    x.status = "in_progress"; x.startTime = now(); x.expectedEndTime = now() + g.durationSeconds * 1000; x.stationId = (b.stationId as string) ?? x.stationId;
    const p = s.passes.find((z) => z.id === x.playPassId); if (p) p.status = "in_progress";
    return done({ started: true, replay: false, session: sSession(s, x) });
  }
  if (r[0] === "station" && r[1] === "complete" && method === "POST") {
    const x = s.sessions.find((z) => z.id === b.sessionId);
    if (!x) throw new LocalError(404, "session_not_found", "Session not found.");
    if (x.status === "completed") return done({ completed: true, replay: true, session: sSession(s, x), rewards: s.issues.filter((i) => i.sessionId === x.id).map((i) => ({ ruleId: i.ruleId, name: "", points: i.points })), rewardPointsEarned: x.rewardPointsEarned });
    if (!["authorized", "in_progress"].includes(x.status)) throw new LocalError(409, "bad_state", `Cannot complete a session that is ${x.status}.`);
    x.status = "completed"; x.completionTime = now(); x.startTime = x.startTime ?? now();
    if (b.score != null) x.score = Number(b.score);
    const p = s.passes.find((z) => z.id === x.playPassId); if (p) p.status = "completed";
    const c = s.customers.find((z) => z.id === x.customerId)!;
    let isFirstVisit = false;
    if (!c.firstVisitAt) { c.firstVisitAt = now(); isFirstVisit = true; }
    const completedCount = s.sessions.filter((z) => z.customerId === x.customerId && z.status === "completed").length;
    const rewards = evaluateRewards(s, x, isFirstVisit, completedCount);
    x.rewardPointsEarned = rewards.reduce((sum, r2) => sum + r2.points, 0);
    return done({ completed: true, replay: false, session: sSession(s, x), rewards, rewardPointsEarned: x.rewardPointsEarned });
  }
  if (r[0] === "station" && r[1] === "fault" && method === "POST") {
    const x = s.sessions.find((z) => z.id === b.sessionId);
    if (!x) throw new LocalError(404, "session_not_found", "Session not found.");
    if (["completed", "cancelled", "expired"].includes(x.status)) throw new LocalError(409, "bad_state", `Session already ${x.status}.`);
    const p = s.passes.find((z) => z.id === x.playPassId)!;
    const refunded = refundAndClose(s, p, "cancelled");
    x.status = "cancelled";
    return done({ cancelled: true, refunded });
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
    const visitors = new Set(s.sessions.filter((x) => x.createdAt >= t0).map((x) => x.customerId));
    const popular = Object.entries(s.sessions.reduce<Record<string, number>>((m, x) => { m[x.gameId] = (m[x.gameId] ?? 0) + 1; return m; }, {}))
      .sort((a, z) => z[1] - a[1]).slice(0, 5)
      .map(([gameId, plays]) => ({ gameId, name: s.games.find((g) => g.id === gameId)?.name ?? "—", plays }));
    return {
      todaysVisitors: visitors.size,
      gamesPlayed: s.sessions.filter((x) => x.status === "completed" && (x.completionTime ?? 0) >= t0).length,
      pointsSold: s.purchases.filter((p) => p.status === "success" && p.updatedAt >= t0).reduce((n, p) => n + p.pointsCredited, 0),
      pointsRedeemed: Math.abs(s.txns.filter((x) => x.type === "play_spend" && x.createdAt >= t0).reduce((n, x) => n + x.amount, 0)),
      rewardsIssued: s.txns.filter((x) => x.type === "reward" && x.createdAt >= t0).reduce((n, x) => n + x.amount, 0),
      rewardsCount: s.txns.filter((x) => x.type === "reward" && x.createdAt >= t0).length,
      revenueKobo: s.purchases.filter((p) => p.status === "success" && p.updatedAt >= t0).reduce((n, p) => n + p.amountKobo, 0),
      activeSessions: s.sessions.filter((x) => ["authorized", "in_progress"].includes(x.status)).length,
      failedOrExpiredPasses: s.passes.filter((p) => ["expired", "cancelled"].includes(p.status) && p.createdAt >= t0).length,
      popularGames: popular,
      totalCustomers: s.customers.length,
    };
  }

  // games
  if (r[1] === "games" && !r[2] && method === "GET") { requireAdmin(s); return { games: s.games.map(sGame) }; }
  if (r[1] === "games" && !r[2] && method === "POST") {
    requireAdmin(s);
    const g = buildGame(s, b);
    s.games.push(g);
    return done({ game: sGame(g) });
  }
  if (r[1] === "games" && r[2] && method === "PATCH") {
    requireAdmin(s);
    const g = s.games.find((x) => x.id === r[2]);
    if (!g) throw new LocalError(404, "game_not_found", "Game not found.");
    Object.assign(g, pickGameFields(b));
    return done({ game: sGame(g) });
  }
  if (r[1] === "games" && r[2] && method === "DELETE") {
    requireAdmin(s, "admin");
    if (s.passes.some((p) => p.gameId === r[2]) || s.sessions.some((x) => x.gameId === r[2])) throw new LocalError(409, "game_in_use", "This game has play history. Deactivate it instead of deleting.");
    s.games = s.games.filter((x) => x.id !== r[2]);
    return done({ deleted: true });
  }

  // rewards
  if (r[1] === "rewards" && !r[2] && method === "GET") { requireAdmin(s); return { rewards: [...s.rules].sort((a, z) => z.priority - a.priority) }; }
  if (r[1] === "rewards" && !r[2] && method === "POST") {
    requireAdmin(s);
    const rule: RewardRule = { id: newId("rule"), name: String(b.name), description: (b.description as string) ?? null, conditionType: String(b.conditionType), threshold: b.threshold == null ? null : Number(b.threshold), points: Number(b.points), active: b.active !== false, expiryDays: b.expiryDays == null ? null : Number(b.expiryDays), priority: Number(b.priority ?? 0), createdAt: now() };
    s.rules.push(rule);
    return done({ reward: rule });
  }
  if (r[1] === "rewards" && r[2] && method === "PATCH") {
    requireAdmin(s);
    const rule = s.rules.find((x) => x.id === r[2]);
    if (!rule) throw new LocalError(404, "reward_not_found", "Reward not found.");
    for (const k of ["name", "description", "conditionType", "points", "active", "priority"] as const) if (k in b) (rule as Record<string, unknown>)[k] = b[k];
    if ("threshold" in b) rule.threshold = b.threshold == null ? null : Number(b.threshold);
    return done({ reward: rule });
  }
  if (r[1] === "rewards" && r[2] && method === "DELETE") {
    requireAdmin(s, "admin");
    const rule = s.rules.find((x) => x.id === r[2]);
    if (rule && s.issues.some((i) => i.ruleId === rule.id)) { rule.active = false; return done({ disabled: true }); }
    s.rules = s.rules.filter((x) => x.id !== r[2]);
    return done({ deleted: true });
  }

  // customers
  if (r[1] === "customers" && !r[2] && method === "GET") {
    requireAdmin(s);
    const query = (q.get("q") ?? "").trim().toLowerCase();
    const rows = s.customers.filter((c) => !query || (c.name ?? "").toLowerCase().includes(query) || c.phone.includes(query)).sort((a, z) => z.createdAt - a.createdAt).slice(0, 50)
      .map((c) => ({ id: c.id, name: c.name, firstName: firstNameOf(c.name), phone: c.phone, balance: c.balance, suspended: c.suspended, sessions: s.sessions.filter((x) => x.customerId === c.id).length, createdAt: iso(c.createdAt) }));
    return { customers: rows };
  }
  if (r[1] === "customers" && r[2] && !r[3] && method === "GET") {
    requireAdmin(s);
    const c = s.customers.find((x) => x.id === r[2]);
    if (!c) throw new LocalError(404, "customer_not_found", "Customer not found.");
    const ledgerSum = s.txns.filter((t) => t.customerId === c.id).reduce((n, t) => n + t.amount, 0);
    return {
      customer: sCustomer(c),
      suspendedReason: c.suspendedReason,
      transactions: s.txns.filter((t) => t.customerId === c.id).sort((a, z) => z.createdAt - a.createdAt).slice(0, 100).map(sTxn),
      sessions: s.sessions.filter((x) => x.customerId === c.id).sort((a, z) => z.createdAt - a.createdAt).slice(0, 50).map((x) => sSession(s, x)),
      purchases: s.purchases.filter((p) => p.customerId === c.id).sort((a, z) => z.createdAt - a.createdAt).slice(0, 50),
      integrity: { balance: c.balance, ledgerSum, consistent: c.balance === ledgerSum },
    };
  }
  if (r[1] === "customers" && r[2] && r[3] === "adjust" && method === "POST") {
    const admin = requireAdmin(s);
    const c = s.customers.find((x) => x.id === r[2]);
    if (!c) throw new LocalError(404, "customer_not_found", "Customer not found.");
    const amount = Number(b.amount); const reason = String(b.reason ?? "");
    if (!amount) throw new LocalError(400, "validation_error", "Amount cannot be zero.");
    if (reason.length < 3) throw new LocalError(400, "validation_error", "A reason is required.");
    const res = amount > 0
      ? credit(s, { customerId: c.id, amount, type: "admin_credit", reason: `Admin adjustment: ${reason}`, createdByAdminId: admin.id, referenceType: "admin", referenceId: admin.id })
      : debit(s, { customerId: c.id, amount: Math.abs(amount), type: "admin_debit", reason: `Admin adjustment: ${reason}`, createdByAdminId: admin.id, referenceType: "admin", referenceId: admin.id });
    return done({ balance: res.balance, transactionId: res.txnId });
  }
  if (r[1] === "customers" && r[2] && r[3] === "suspend" && method === "POST") {
    requireAdmin(s);
    const c = s.customers.find((x) => x.id === r[2]);
    if (!c) throw new LocalError(404, "customer_not_found", "Customer not found.");
    c.suspended = Boolean(b.suspend);
    c.suspendedReason = c.suspended ? ((b.reason as string) ?? "Suspended by staff") : null;
    return done({ suspended: c.suspended });
  }

  // sessions
  if (r[1] === "sessions" && method === "GET") {
    requireAdmin(s);
    const status = q.get("status");
    const list = s.sessions.filter((x) => !status || x.status === status).sort((a, z) => z.createdAt - a.createdAt).slice(0, 100).map((x) => ({
      ...sSession(s, x),
      customer: { id: x.customerId, firstName: firstNameOf(s.customers.find((c) => c.id === x.customerId)?.name ?? null) },
      stationId: x.stationId,
    }));
    return { sessions: list };
  }

  throw new LocalError(404, "not_found", `No local admin handler for ${method} ${r.join("/")}`);
}

function pickGameFields(b: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const k of ["name", "description", "imageUrl", "pointCost", "durationSeconds", "minPlayers", "maxPlayers", "location", "minAge", "minHeightCm", "instructions", "rules", "safety", "status", "selfServiceMode", "featured"] as const) {
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
    description: String(b.description ?? ""), imageUrl: String(b.imageUrl ?? ""),
    pointCost: Number(b.pointCost ?? 0), durationSeconds: Number(b.durationSeconds ?? 60),
    minPlayers: Number(b.minPlayers ?? 1), maxPlayers: Number(b.maxPlayers ?? 1),
    location: String(b.location ?? ""), minAge: b.minAge == null ? null : Number(b.minAge), minHeightCm: b.minHeightCm == null ? null : Number(b.minHeightCm),
    instructions: (b.instructions as string) ?? null, rules: (b.rules as string) ?? null, safety: (b.safety as string) ?? null,
    status: String(b.status ?? "active"), selfServiceMode: b.selfServiceMode !== false, featured: Boolean(b.featured), createdAt: now(),
  };
}
