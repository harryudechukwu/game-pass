// Browser-only demo backend. When NEXT_PUBLIC_DEMO=1, lib/client.ts routes
// every api() call here instead of to /api/... — so the whole app runs on
// in-memory sample data with NO MongoDB and NO real auth. State lives for the
// tab session and resets on a full page reload (always a clean demo).

import { ApiClientError } from "@/lib/client";
import { money } from "@/lib/format";

const ngn = (k: number) => money(k, "NGN");
const DAY = 86400000;
const nid = (p: string) => `${p}_${Math.random().toString(36).slice(2, 10)}`;

// deterministic RNG so the demo looks the same on each load
let _s = 987654321;
const rnd = () => ((_s = (_s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const rint = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];

type Member = { _id: string; phone: string; name: string | null; createdAt: number };
type Game = { _id: string; name: string; slug: string; category: "kids" | "teen"; icon: string; location: string; priceKobo: number; durationMinutes: number; description: string; status: string; featured: boolean; minAge: number | null; minHeightCm: number | null; instructions: string | null; rules: string | null; safety: string | null; createdAt: number };
type Item = { _id: string; name: string; icon: string; priceKobo: number; active: boolean; description: string | null; createdAt: number };
type Reward = { _id: string; name: string; description: string | null; spendRequiredKobo: number; terms: string[] | null; active: boolean; createdAt: number };
type Purchase = { _id: string; playerId: string; kind: "game" | "item"; refId: string; name: string; icon: string; amountKobo: number; quantity: number; attendantId: string | null; createdAt: number; headsUpEndsAt: number | null; mainEndsAt: number | null; location: string | null; voidedAt?: number | null; voidedByName?: string | null; editedAt?: number | null; editedByName?: string | null; originalQuantity?: number | null; originalAmountKobo?: number | null };
type Redemption = { _id: string; playerId: string; rewardId: string; code: string; redeemedAt: number; fulfilledAt?: number | null; fulfilledByName?: string | null };
type Attendant = { _id: string; name: string; username: string; password: string; active: boolean; graceUntil: number | null; createdAt: number };
type Admin = { _id: string; name: string; email: string; password: string; role: string; active: boolean };

type Store = {
  members: Member[]; games: Game[]; items: Item[]; rewards: Reward[];
  purchases: Purchase[]; redemptions: Redemption[]; attendants: Attendant[]; admins: Admin[];
  settings: { headsUpSeconds: number; attendantOpenMin: number; attendantCloseMin: number; attendantGraceMin: number; timezone: string };
  session: { playerId: string | null; adminId: string | null; attendantId: string | null };
};

function build(): Store {
  _s = 987654321;
  const now = Date.now();
  const admins: Admin[] = [
    { _id: "adm_owner", name: "Store Owner", email: "owner@creamycastle.demo", password: "demo1234", role: "admin", active: true },
    { _id: "adm_mgr", name: "Ngozi (Manager)", email: "manager@creamycastle.demo", password: "demo1234", role: "manager", active: true },
  ];
  const attendants: Attendant[] = [
    { _id: "att_front", name: "Front Desk", username: "frontdesk", password: "1234", active: true, graceUntil: null, createdAt: now - 120 * DAY },
    { _id: "att_bola", name: "Bola", username: "bola", password: "1234", active: true, graceUntil: null, createdAt: now - 60 * DAY },
    { _id: "att_emeka", name: "Emeka (former)", username: "emeka", password: "1234", active: false, graceUntil: null, createdAt: now - 200 * DAY },
  ];
  const games: Game[] = [
    g("Kids Play Zone", "kids", "gamepad", 100000, 60, "Soft-play area"),
    g("Teen Arcade", "teen", "joystick", 150000, 60, "Arcade floor"),
    g("Bumper Cars", "teen", "car", 120000, 30, "Track"),
    g("VR Experience", "teen", "vr", 200000, 30, "VR room"),
    g("Bowling Lane", "teen", "bowling", 180000, 60, "Lanes"),
    g("Bouncy Castle", "kids", "castle", 80000, 60, "Play hall"),
  ];
  const items: Item[] = [
    it("Ice Cream Cone", "ice-cream", 50000),
    it("Popcorn", "popcorn", 40000),
    it("Slushie", "cup", 45000),
    it("Cotton Candy", "candy", 35000),
    it("Bottled Water", "water", 20000),
  ];
  const rewards: Reward[] = [
    { _id: "rwd_1", name: "Free Game Token", description: "One free 1-hour game.", spendRequiredKobo: 500000, terms: ["Redeemable at Creamy Castle.", "Valid for 30 days once unlocked."], active: true, createdAt: now - 100 * DAY },
    { _id: "rwd_2", name: "Free Ice Cream", description: "A scoop on the house.", spendRequiredKobo: 1000000, terms: null, active: true, createdAt: now - 100 * DAY },
    { _id: "rwd_3", name: "₦2,000 Off", description: "₦2,000 off your next visit.", spendRequiredKobo: 2500000, terms: null, active: true, createdAt: now - 100 * DAY },
    { _id: "rwd_4", name: "Birthday Party 15% Off", description: "15% off a party booking.", spendRequiredKobo: 5000000, terms: null, active: true, createdAt: now - 100 * DAY },
    { _id: "rwd_5", name: "VIP Day Pass", description: "Unlimited games for a day.", spendRequiredKobo: 10000000, terms: null, active: true, createdAt: now - 100 * DAY },
  ];
  const names = ["Ada Obi", "Chidi Nwosu", "Zainab Bello", "Tunde Alao", "Ifeoma Eze", "Musa Sani", "Grace Okon", "Kelechi Umeh", "Halima Yusuf", "David Ade", "Bisi Cole", "Uche Kalu", "Ngozi Ani", "Femi Ojo", "Sade Balo", "Ibrahim Dan", "Chioma Obi", "Sam Peters"];
  const members: Member[] = names.map((n, i) => ({ _id: `ply_${i}`, phone: demoPhone(i), name: n, createdAt: now - rint(1, 60) * DAY }));
  // make the prefilled member (Ada) a known number
  members[0].phone = "08031234567";

  const purchases: Purchase[] = [];
  const reds: Redemption[] = [];
  for (const m of members) {
    const n = rint(2, 14);
    for (let k = 0; k < n; k++) {
      const isGame = rnd() > 0.4;
      const created = now - rint(0, 30) * DAY - rint(0, 20) * 3600000;
      if (isGame) {
        const gm = pick(games);
        const hrs = rint(1, 2);
        purchases.push({ _id: nid("pur"), playerId: m._id, kind: "game", refId: gm._id, name: gm.name, icon: gm.icon, amountKobo: gm.priceKobo * hrs, quantity: hrs, attendantId: pick(attendants.filter((a) => a.active))._id, createdAt: created, headsUpEndsAt: created + 60000, mainEndsAt: created - DAY, location: gm.location });
      } else {
        const item = pick(items);
        const qty = rint(1, 3);
        purchases.push({ _id: nid("pur"), playerId: m._id, kind: "item", refId: item._id, name: item.name, icon: item.icon, amountKobo: item.priceKobo * qty, quantity: qty, attendantId: pick(attendants.filter((a) => a.active))._id, createdAt: created, headsUpEndsAt: null, mainEndsAt: null, location: null });
      }
    }
  }
  purchases.sort((a, z) => z.createdAt - a.createdAt);
  // a couple of voided sales for realism
  purchases.filter((p) => !p.voidedAt).slice(3, 5).forEach((p) => { p.voidedAt = p.createdAt + 3600000; p.voidedByName = "Store Owner"; });
  // a redemption or two for members who cleared the first reward
  for (const m of members) {
    const s = purchases.filter((p) => p.playerId === m._id && !p.voidedAt).reduce((x, p) => x + p.amountKobo, 0);
    if (s >= rewards[0].spendRequiredKobo && rnd() > 0.5) {
      reds.push({ _id: nid("red"), playerId: m._id, rewardId: rewards[0]._id, code: rewardCode(), redeemedAt: now - rint(1, 10) * DAY, fulfilledAt: rnd() > 0.5 ? now - rint(0, 5) * DAY : null, fulfilledByName: "Bola" });
    }
  }

  return {
    members, games, items, rewards, purchases, redemptions: reds, attendants, admins,
    settings: { headsUpSeconds: 60, attendantOpenMin: 360, attendantCloseMin: 1140, attendantGraceMin: 30, timezone: "Africa/Lagos" },
    session: { playerId: null, adminId: null, attendantId: null },
  };

  function g(name: string, category: "kids" | "teen", icon: string, priceKobo: number, durationMinutes: number, location: string): Game {
    return { _id: nid("game"), name, slug: name.toLowerCase().replace(/\s+/g, "-"), category, icon, location, priceKobo, durationMinutes, description: `${name} at Creamy Castle.`, status: "active", featured: rnd() > 0.6, minAge: null, minHeightCm: null, instructions: null, rules: null, safety: null, createdAt: now - 100 * DAY };
  }
  function it(name: string, icon: string, priceKobo: number): Item {
    return { _id: nid("item"), name, icon, priceKobo, active: true, description: null, createdAt: now - 100 * DAY };
  }
}
function demoPhone(i: number) { return `0803${String(1000000 + i * 7331).slice(0, 7)}`; }
function rewardCode() { const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; let s = ""; for (let i = 0; i < 5; i++) s += c[Math.floor(rnd() * c.length)]; return `GP-${s}`; }

let store = build();

// ── helpers ──
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const firstName = (n: string | null) => (n ? n.trim().split(/\s+/)[0] : null);
const spentOf = (pid: string) => store.purchases.filter((p) => p.playerId === pid && !p.voidedAt).reduce((s, p) => s + p.amountKobo, 0);
const gamesPlayedOf = (pid: string) => store.purchases.filter((p) => p.playerId === pid && p.kind === "game" && !p.voidedAt).length;
const activeRewards = () => store.rewards.filter((r) => r.active).sort((a, b) => a.spendRequiredKobo - b.spendRequiredKobo);
const err = (status: number, code: string, msg: string): never => { throw new ApiClientError(msg, code, status); };
const dayStr = (ts: number) => new Date(ts).toISOString().slice(0, 10);
const todayStr = () => new Date().toISOString().slice(0, 10);

function sPurchase(p: Purchase) {
  const t = Date.now();
  const status = p.kind === "game" && p.mainEndsAt != null ? (p.headsUpEndsAt != null && t < p.headsUpEndsAt ? "heads_up" : t < p.mainEndsAt ? "active" : "completed") : null;
  return { id: p._id, kind: p.kind, name: p.name, icon: p.icon, amountKobo: p.amountKobo, amountLabel: ngn(p.amountKobo), quantity: p.quantity, createdAt: new Date(p.createdAt).toISOString(), location: p.location, headsUpEndsAt: p.headsUpEndsAt ? new Date(p.headsUpEndsAt).toISOString() : null, mainEndsAt: p.mainEndsAt ? new Date(p.mainEndsAt).toISOString() : null, sessionStatus: status, voided: p.voidedAt != null };
}
const sMember = (m: Member) => ({ id: m._id, phone: m.phone, name: m.name, firstName: firstName(m.name), createdAt: new Date(m.createdAt).toISOString() });
const sGame = (g: Game) => ({ id: g._id, slug: g.slug, name: g.name, description: g.description, category: g.category, icon: g.icon, location: g.location, priceKobo: g.priceKobo, priceLabel: ngn(g.priceKobo), durationMinutes: g.durationMinutes, minAge: g.minAge, minHeightCm: g.minHeightCm, instructions: g.instructions, rules: g.rules, safety: g.safety, status: g.status, featured: g.featured, available: g.status === "active" });
const sItem = (i: Item) => ({ id: i._id, name: i.name, description: i.description, icon: i.icon, priceKobo: i.priceKobo, priceLabel: ngn(i.priceKobo), active: i.active });

function nextReward(spent: number) {
  const nr = activeRewards().find((r) => r.spendRequiredKobo > spent);
  if (!nr) return null;
  return { name: nr.name, spendRequiredKobo: nr.spendRequiredKobo, spendRequiredLabel: ngn(nr.spendRequiredKobo), remainingKobo: nr.spendRequiredKobo - spent, remainingLabel: ngn(nr.spendRequiredKobo - spent), progressPct: Math.min(100, Math.round((spent / nr.spendRequiredKobo) * 100)) };
}
function paginate<T>(arr: T[], q: URLSearchParams, size: number) {
  const page = Math.max(1, Math.floor(Number(q.get("page")) || 1));
  const pages = Math.max(1, Math.ceil(arr.length / size));
  return { items: arr.slice((page - 1) * size, page * size), total: arr.length, page, pages };
}

// ── router ──
export async function demoApi<T = unknown>(path: string, method: string, body: unknown): Promise<T> {
  await sleep(160); // let skeleton loaders show, feels real
  const u = new URL(path, "http://demo.local");
  const r = u.pathname.split("/").filter(Boolean).slice(1); // drop "api"
  const q = u.searchParams;
  const b = (body ?? {}) as Record<string, unknown>;
  return route(r, method, b, q) as T;
}

function route(r: string[], method: string, b: Record<string, unknown>, q: URLSearchParams): unknown {
  const S = store;
  // ── member ──
  if (r[0] === "auth" && r[1] === "login" && method === "POST") {
    const phone = String(b.phone ?? "").replace(/\s+/g, "");
    let m = S.members.find((x) => x.phone === phone);
    let isNew = false;
    if (!m) { m = { _id: nid("ply"), phone, name: (b.name as string)?.trim() || null, createdAt: Date.now() }; S.members.push(m); isNew = true; }
    S.session.playerId = m._id;
    return { player: sMember(m), isNew };
  }
  if (r[0] === "auth" && r[1] === "logout") { S.session.playerId = null; return { loggedOut: true }; }

  if (r[0] === "me") {
    const m = reqMember();
    const spent = spentOf(m._id);
    const redeemed = new Set(S.redemptions.filter((x) => x.playerId === m._id).map((x) => x.rewardId));
    const claimable = activeRewards().filter((x) => spent >= x.spendRequiredKobo && !redeemed.has(x._id)).length;
    return { player: sMember(m), spentKobo: spent, spentLabel: ngn(spent), activeSessions: 0, claimable };
  }
  if (r[0] === "home") {
    const m = reqMember();
    const spent = spentOf(m._id);
    const redeemed = new Set(S.redemptions.filter((x) => x.playerId === m._id).map((x) => x.rewardId));
    const purchases = S.purchases.filter((p) => p.playerId === m._id && !p.voidedAt).sort((a, z) => z.createdAt - a.createdAt);
    const claimable = activeRewards().filter((x) => spent >= x.spendRequiredKobo && !redeemed.has(x._id)).map((x) => ({ id: x._id, name: x.name }));
    const upcomingRewards = activeRewards().filter((x) => spent < x.spendRequiredKobo).slice(0, 4).map((x) => ({ id: x._id, name: x.name, remainingLabel: ngn(x.spendRequiredKobo - spent), spendRequiredLabel: ngn(x.spendRequiredKobo), progressPct: Math.min(100, Math.round((spent / x.spendRequiredKobo) * 100)) }));
    return { spentKobo: spent, spentLabel: ngn(spent), gamesPlayed: gamesPlayedOf(m._id), activeSessions: [], purchases: purchases.map(sPurchase), nextReward: nextReward(spent), claimable, upcomingRewards };
  }
  if (r[0] === "purchases") {
    const m = reqMember();
    const list = S.purchases.filter((p) => p.playerId === m._id && !p.voidedAt).sort((a, z) => z.createdAt - a.createdAt);
    const pg = paginate(list, q, 15);
    return { purchases: pg.items.map(sPurchase), total: pg.total, page: pg.page, pages: pg.pages };
  }
  if (r[0] === "rewards" && !r[1] && method === "GET") {
    const m = reqMember();
    const spent = spentOf(m._id);
    const codeMap = new Map(S.redemptions.filter((x) => x.playerId === m._id).map((d) => [d.rewardId, d.code]));
    const rewards = activeRewards().map((x) => { const code = codeMap.get(x._id) ?? null; const unlocked = spent >= x.spendRequiredKobo; return { id: x._id, name: x.name, description: x.description, spendRequiredKobo: x.spendRequiredKobo, spendRequiredLabel: ngn(x.spendRequiredKobo), terms: x.terms, unlocked, redeemed: !!code, code, claimable: unlocked && !code, progressPct: Math.min(100, Math.round((spent / x.spendRequiredKobo) * 100)) }; });
    return { spentKobo: spent, spentLabel: ngn(spent), nextReward: nextReward(spent), rewards };
  }
  if (r[0] === "rewards" && r[1] && r[2] === "redeem" && method === "POST") {
    const m = reqMember();
    const reward = S.rewards.find((x) => x._id === r[1]);
    if (!reward) return err(404, "reward_not_found", "Reward not found.");
    if (spentOf(m._id) < reward.spendRequiredKobo) return err(403, "reward_locked", `Spend ${ngn(reward.spendRequiredKobo)} to unlock this reward.`);
    let red = S.redemptions.find((x) => x.playerId === m._id && x.rewardId === reward._id);
    if (!red) { red = { _id: nid("red"), playerId: m._id, rewardId: reward._id, code: rewardCode(), redeemedAt: Date.now() }; S.redemptions.push(red); }
    return { redeemed: true, code: red.code, reward: { name: reward.name, description: reward.description } };
  }

  // ── attendant ──
  if (r[0] === "attendant" && r[1] === "login" && method === "POST") {
    const att = S.attendants.find((a) => a.username === String(b.username ?? "").trim().toLowerCase());
    if (!att || att.password !== String(b.password ?? "")) return err(401, "invalid_credentials", "Incorrect username or password.");
    if (!att.active) return err(403, "deactivated", "This attendant account has been deactivated.");
    S.session.attendantId = att._id;
    return { attendant: { id: att._id, name: att.name, username: att.username } };
  }
  if (r[0] === "attendant" && r[1] === "logout") { S.session.attendantId = null; return { loggedOut: true }; }
  if (r[0] === "attendant" && r[1] === "me") { const a = reqAtt(); return { attendant: { id: a._id, name: a.name, username: a.username } }; }
  if (r[0] === "attendant" && r[1] === "catalogue") {
    reqAtt();
    return { games: S.games.filter((g) => g.status === "active").map(sGame), items: S.items.filter((i) => i.active).map(sItem), headsUpSeconds: S.settings.headsUpSeconds };
  }
  if (r[0] === "attendant" && r[1] === "lookup") {
    reqAtt();
    const phone = String(q.get("phone") ?? "").replace(/\s+/g, "");
    const m = S.members.find((x) => x.phone === phone);
    if (!m) return { phone, found: false, player: null };
    return { phone, found: true, player: { ...sMember(m), spentKobo: spentOf(m._id), spentLabel: ngn(spentOf(m._id)), gamesPlayed: gamesPlayedOf(m._id) } };
  }
  if (r[0] === "attendant" && r[1] === "order" && method === "POST") {
    const a = reqAtt();
    const phone = String(b.phone ?? "").replace(/\s+/g, "");
    let m = S.members.find((x) => x.phone === phone);
    let isNewPlayer = false;
    if (!m) { m = { _id: nid("ply"), phone, name: (b.name as string)?.trim() || null, createdAt: Date.now() }; S.members.push(m); isNewPlayer = true; }
    const lines = Array.isArray(b.lines) ? (b.lines as Record<string, unknown>[]) : [];
    const now = Date.now();
    const made: Purchase[] = [];
    for (const line of lines) {
      if (line.kind === "game") {
        const g = S.games.find((x) => x._id === String(line.refId)); if (!g) continue;
        const hrs = Math.max(1, Math.floor(Number(line.hours ?? 1)) || 1);
        made.push({ _id: nid("pur"), playerId: m._id, kind: "game", refId: g._id, name: g.name, icon: g.icon, amountKobo: g.priceKobo * hrs, quantity: hrs, attendantId: a._id, createdAt: now, headsUpEndsAt: now + S.settings.headsUpSeconds * 1000, mainEndsAt: now + S.settings.headsUpSeconds * 1000 + hrs * g.durationMinutes * 60000, location: g.location });
      } else {
        const it = S.items.find((x) => x._id === String(line.refId)); if (!it) continue;
        const qty = Math.max(1, Math.floor(Number(line.quantity ?? 1)) || 1);
        made.push({ _id: nid("pur"), playerId: m._id, kind: "item", refId: it._id, name: it.name, icon: it.icon, amountKobo: it.priceKobo * qty, quantity: qty, attendantId: a._id, createdAt: now, headsUpEndsAt: null, mainEndsAt: null, location: null });
      }
    }
    S.purchases.push(...made);
    const spent = spentOf(m._id);
    const redeemed = new Set(S.redemptions.filter((x) => x.playerId === m!._id).map((x) => x.rewardId));
    const unlocked = activeRewards().filter((x) => spent >= x.spendRequiredKobo && !redeemed.has(x._id)).map((x) => ({ id: x._id, name: x.name }));
    const totalKobo = made.reduce((s, p) => s + p.amountKobo, 0);
    return { purchases: made.map(sPurchase), totalKobo, totalLabel: ngn(totalKobo), player: { ...sMember(m), spentKobo: spent, spentLabel: ngn(spent) }, isNewPlayer, headsUpSeconds: S.settings.headsUpSeconds, hasGame: made.some((p) => p.kind === "game"), unlockedRewards: unlocked };
  }
  if (r[0] === "attendant" && r[1] === "redeem" && method === "POST") {
    const a = reqAtt();
    const raw = String(b.code ?? "").trim().toUpperCase().replace(/\s+/g, "");
    const code = raw.startsWith("GP-") ? raw : `GP-${raw}`;
    const red = S.redemptions.find((x) => x.code === code);
    if (!red) return err(404, "code_not_found", "No reward matches that code.");
    if (red.fulfilledAt) return err(409, "already_fulfilled", `Already given${red.fulfilledByName ? ` by ${red.fulfilledByName}` : ""}.`);
    red.fulfilledAt = Date.now(); red.fulfilledByName = a.name;
    const reward = S.rewards.find((x) => x._id === red.rewardId);
    const m = S.members.find((x) => x._id === red.playerId);
    return { code, reward: { name: reward?.name ?? "Reward" }, player: m ? { firstName: firstName(m.name), phone: m.phone } : null };
  }
  if (r[0] === "attendant" && r[1] === "member") {
    reqAtt();
    const phone = String(q.get("phone") ?? "").replace(/\s+/g, "");
    const m = S.members.find((x) => x.phone === phone);
    if (!m) return err(404, "member_not_found", "No member with that phone number.");
    const spent = spentOf(m._id);
    const redMap = new Map(S.redemptions.filter((x) => x.playerId === m._id).map((d) => [d.rewardId, d]));
    const rewards = activeRewards().map((x) => { const red = redMap.get(x._id); const unlocked = spent >= x.spendRequiredKobo; return { id: x._id, name: x.name, spendRequiredLabel: ngn(x.spendRequiredKobo), unlocked, redeemed: !!red, code: red?.code ?? null, status: red?.fulfilledAt ? "Given" : red ? "Redeemed" : unlocked ? "Ready to redeem" : `${ngn(x.spendRequiredKobo - spent)} to go` }; });
    const purchases = S.purchases.filter((p) => p.playerId === m._id && !p.voidedAt).sort((a, z) => z.createdAt - a.createdAt).slice(0, 50);
    return { member: { ...sMember(m), spentKobo: spent, spentLabel: ngn(spent), gamesPlayed: gamesPlayedOf(m._id) }, purchases: purchases.map(sPurchase), rewards };
  }
  if (r[0] === "attendant" && r[1] === "recent") {
    reqAtt();
    const recent = [...S.purchases].sort((a, z) => z.createdAt - a.createdAt).slice(0, 12);
    return { purchases: recent.map((p) => { const m = S.members.find((x) => x._id === p.playerId); return { ...sPurchase(p), player: { firstName: firstName(m?.name ?? null), phone: m?.phone ?? "" } }; }) };
  }

  // ── admin / manager ──
  if (r[0] === "admin") return adminRoute(r, method, b, q);

  return err(404, "not_found", `Demo: no handler for ${method} /${r.join("/")}`);

  function reqMember(): Member { const m = S.members.find((x) => x._id === S.session.playerId); if (!m) return err(401, "unauthorized", "Please sign in."); return m; }
  function reqAtt(): Attendant { const a = S.attendants.find((x) => x._id === S.session.attendantId); if (!a) return err(401, "unauthorized", "Attendant sign-in required."); return a; }
}

function adminRoute(r: string[], method: string, b: Record<string, unknown>, q: URLSearchParams): unknown {
  const S = store;
  if (r[1] === "login" && method === "POST") {
    const a = S.admins.find((x) => x.email === String(b.email ?? "").toLowerCase());
    if (!a || a.password !== String(b.password ?? "")) return err(401, "invalid_credentials", "Incorrect email or password.");
    if (!a.active) return err(403, "deactivated", "This account has been deactivated.");
    S.session.adminId = a._id;
    return { admin: { id: a._id, name: a.name, email: a.email, role: a.role } };
  }
  if (r[1] === "logout") { S.session.adminId = null; return { loggedOut: true }; }
  const me = S.admins.find((x) => x._id === S.session.adminId);
  if (!me) return err(401, "unauthorized", "Admin sign-in required.");
  const isMgr = me.role === "manager";
  if (r[1] === "me") return { admin: { id: me._id, name: me.name, email: me.email, role: me.role } };

  if (r[1] === "settings" && method === "GET") return { headsUpSeconds: S.settings.headsUpSeconds, attendantOpenMin: S.settings.attendantOpenMin, attendantCloseMin: S.settings.attendantCloseMin, attendantGraceMin: S.settings.attendantGraceMin, timezone: S.settings.timezone };
  if (r[1] === "settings" && method === "PATCH") { Object.assign(S.settings, Object.fromEntries(Object.entries(b).filter(([k]) => k in S.settings))); return { ...S.settings }; }

  if (r[1] === "stats" || r[1] === "analytics") return analytics(r[1], q);
  if (r[1] === "overview") {
    const t0 = new Date(); t0.setHours(0, 0, 0, 0);
    const today = S.purchases.filter((p) => !p.voidedAt && p.createdAt >= t0.getTime());
    const rev = today.reduce((s, p) => s + p.amountKobo, 0);
    return { revenueTodayKobo: rev, revenueTodayLabel: ngn(rev), gamesToday: today.filter((p) => p.kind === "game").length, itemsToday: today.filter((p) => p.kind === "item").reduce((s, p) => s + p.quantity, 0), activeSessions: 0, rewardsToday: S.redemptions.filter((x) => x.redeemedAt >= t0.getTime()).length };
  }

  // catalogue CRUD
  if (r[1] === "games" && !r[2] && method === "GET") return { games: S.games.map(sGame) };
  if (r[1] === "games" && !r[2] && method === "POST") { const g = mkGame(b); S.games.push(g); return { game: sGame(g) }; }
  if (r[1] === "games" && r[2] && method === "PATCH") { const g = S.games.find((x) => x._id === r[2]); if (!g) return err(404, "not_found", "Game not found."); Object.assign(g, pickFields(b, ["name", "description", "category", "icon", "location", "priceKobo", "durationMinutes", "minAge", "minHeightCm", "instructions", "rules", "safety", "status", "featured"])); return { game: sGame(g) }; }
  if (r[1] === "games" && r[2] && method === "DELETE") { S.games = S.games.filter((x) => x._id !== r[2]); return { deleted: true }; }

  if (r[1] === "items" && !r[2] && method === "GET") return { items: S.items.map(sItem) };
  if (r[1] === "items" && !r[2] && method === "POST") { const i: Item = { _id: nid("item"), name: String(b.name ?? "Item"), description: (b.description as string) || null, icon: String(b.icon ?? "coins"), priceKobo: Math.max(0, Math.round(Number(b.priceKobo ?? 0))), active: b.active !== false, createdAt: Date.now() }; S.items.push(i); return { item: sItem(i) }; }
  if (r[1] === "items" && r[2] && method === "PATCH") { const i = S.items.find((x) => x._id === r[2]); if (!i) return err(404, "not_found", "Item not found."); Object.assign(i, pickFields(b, ["name", "description", "icon", "priceKobo", "active"])); return { item: sItem(i) }; }
  if (r[1] === "items" && r[2] && method === "DELETE") { S.items = S.items.filter((x) => x._id !== r[2]); return { deleted: true }; }

  if (r[1] === "rewards" && !r[2] && method === "GET") return { rewards: activeRewardsAll().map((x) => ({ id: x._id, name: x.name, description: x.description, spendRequiredKobo: x.spendRequiredKobo, spendRequiredLabel: ngn(x.spendRequiredKobo), terms: x.terms, active: x.active })) };
  if (r[1] === "rewards" && !r[2] && method === "POST") { const rw: Reward = { _id: nid("rwd"), name: String(b.name ?? "Reward"), description: (b.description as string) || null, spendRequiredKobo: Math.max(100, Math.round(Number(b.spendRequiredKobo ?? 100))), terms: Array.isArray(b.terms) ? (b.terms as string[]) : typeof b.terms === "string" ? (b.terms as string).split("\n").filter(Boolean) : null, active: b.active !== false, createdAt: Date.now() }; S.rewards.push(rw); return { reward: { id: rw._id, ...rw } }; }
  if (r[1] === "rewards" && r[2] && method === "PATCH") { const rw = S.rewards.find((x) => x._id === r[2]); if (!rw) return err(404, "not_found", "Reward not found."); Object.assign(rw, pickFields(b, ["name", "description", "spendRequiredKobo", "active"])); return { reward: { id: rw._id, ...rw } }; }
  if (r[1] === "rewards" && r[2] && method === "DELETE") { S.rewards = S.rewards.filter((x) => x._id !== r[2]); return { deleted: true }; }

  // sales
  if (r[1] === "sales" && !r[2] && method === "GET") {
    const list = [...S.purchases].sort((a, z) => z.createdAt - a.createdAt);
    const pg = paginate(list, q, 20);
    return {
      sales: pg.items.map((p) => { const m = S.members.find((x) => x._id === p.playerId); return { id: p._id, kind: p.kind, name: p.name, quantity: p.quantity, amountLabel: ngn(p.amountKobo), createdAt: new Date(p.createdAt).toISOString(), player: m ? { firstName: firstName(m.name), phone: m.phone } : null, edited: p.editedAt != null, editedByName: p.editedByName ?? null, originalQuantity: p.originalQuantity ?? null, originalAmountLabel: p.originalAmountKobo != null ? ngn(p.originalAmountKobo) : null, voided: p.voidedAt != null, voidedByName: p.voidedByName ?? null }; }),
      total: pg.total, page: pg.page, pages: pg.pages,
    };
  }
  if (r[1] === "sales" && r[2] && r[3] === "void" && method === "POST") { const p = S.purchases.find((x) => x._id === r[2]); if (!p) return err(404, "not_found", "Sale not found."); p.voidedAt = Date.now(); p.voidedByName = me.name; return { ok: true, warning: null }; }
  if (r[1] === "sales" && r[2] && method === "PATCH") { const p = S.purchases.find((x) => x._id === r[2]); if (!p) return err(404, "not_found", "Sale not found."); const nq = Math.max(1, Math.floor(Number(b.quantity ?? p.quantity)) || 1); if (nq !== p.quantity) { if (p.originalQuantity == null) { p.originalQuantity = p.quantity; p.originalAmountKobo = p.amountKobo; } const unit = Math.round(p.amountKobo / Math.max(1, p.quantity)); p.quantity = nq; p.amountKobo = unit * nq; p.editedAt = Date.now(); p.editedByName = me.name; } return { ok: true }; }

  // logs
  if (r[1] === "logs" && method === "GET") {
    const kind = q.get("kind");
    let list = [...S.purchases].sort((a, z) => z.createdAt - a.createdAt);
    if (kind && kind !== "all") list = list.filter((p) => p.kind === kind);
    const pg = paginate(list, q, 20);
    return {
      logs: pg.items.map((p) => { const m = S.members.find((x) => x._id === p.playerId); const at = S.attendants.find((a) => a._id === p.attendantId); return { ...sPurchase(p), player: { id: p.playerId, firstName: firstName(m?.name ?? null), phone: m?.phone ?? "" }, attendant: at?.name ?? "—" }; }),
      total: pg.total, page: pg.page, pages: pg.pages,
    };
  }

  // attendants
  if (r[1] === "attendants" && !r[2] && method === "GET") return { attendants: S.attendants.map((a) => ({ id: a._id, name: a.name, username: a.username, password: a.password, active: a.active, graceUntil: a.graceUntil, createdAt: new Date(a.createdAt).toISOString() })) };
  if (r[1] === "attendants" && !r[2] && method === "POST") { const u = String(b.username ?? "").trim().toLowerCase(); if (S.attendants.some((a) => a.username === u)) return err(409, "username_taken", "That username is already taken."); const a: Attendant = { _id: nid("att"), name: String(b.name ?? ""), username: u, password: String(b.password ?? ""), active: true, graceUntil: null, createdAt: Date.now() }; S.attendants.push(a); return { attendant: { id: a._id, name: a.name, username: a.username, active: true, createdAt: new Date(a.createdAt).toISOString() } }; }
  if (r[1] === "attendants" && r[2] && r[3] === "grace" && method === "POST") { const a = S.attendants.find((x) => x._id === r[2]); if (!a) return err(404, "not_found", "Attendant not found."); const mins = Math.max(1, Math.min(240, Math.floor(Number(b.minutes ?? 30)) || 30)); a.graceUntil = Date.now() + mins * 60000; return { graceUntil: a.graceUntil, minutes: mins }; }
  if (r[1] === "attendants" && r[2] && method === "PATCH") { const a = S.attendants.find((x) => x._id === r[2]); if (!a) return err(404, "not_found", "Attendant not found."); a.active = b.active !== false; return { attendant: { id: a._id, active: a.active } }; }

  // managers (admin only)
  if (r[1] === "managers") {
    if (isMgr) return err(403, "forbidden", "Managers can't access this.");
    if (!r[2] && method === "GET") return { managers: S.admins.filter((a) => a.role === "manager").map((m) => ({ id: m._id, name: m.name, email: m.email, password: m.password, active: m.active })) };
    if (!r[2] && method === "POST") { const email = String(b.email ?? "").toLowerCase(); if (S.admins.some((a) => a.email === email)) return err(409, "email_taken", "That email is already in use."); const m: Admin = { _id: nid("mgr"), name: String(b.name ?? ""), email, password: String(b.password ?? ""), role: "manager", active: true }; S.admins.push(m); return { manager: { id: m._id, name: m.name, email: m.email } }; }
    if (r[2] && method === "PATCH") { const m = S.admins.find((x) => x._id === r[2]); if (!m) return err(404, "not_found", "Manager not found."); m.active = b.active !== false; return { manager: { id: m._id, active: m.active } }; }
  }

  // members (players)
  if (r[1] === "players" && !r[2] && method === "GET") {
    const query = (q.get("q") ?? "").trim().toLowerCase();
    let rows = S.members
      .filter((m) => !query || (m.name ?? "").toLowerCase().includes(query) || m.phone.includes(query))
      .map((m) => ({ id: m._id, phone: m.phone, name: m.name, firstName: firstName(m.name), spentKobo: spentOf(m._id), spentLabel: ngn(spentOf(m._id)), gamesPlayed: gamesPlayedOf(m._id), redemptions: S.redemptions.filter((x) => x.playerId === m._id).length, createdAt: new Date(m.createdAt).toISOString() }))
      .sort((a, z) => z.spentKobo - a.spentKobo);
    const pg = paginate(rows, q, 20);
    return { players: pg.items, total: pg.total, page: pg.page, pages: pg.pages };
  }
  if (r[1] === "players" && r[2] && method === "GET") {
    const m = S.members.find((x) => x._id === r[2]); if (!m) return err(404, "not_found", "Member not found.");
    const spent = spentOf(m._id);
    const reds = S.redemptions.filter((x) => x.playerId === m._id).sort((a, z) => z.redeemedAt - a.redeemedAt);
    const rmap = new Map(S.rewards.map((x) => [x._id, x.name]));
    const redSet = new Map(reds.map((x) => [x.rewardId, x]));
    const dueRewards = activeRewards().map((x) => { const red = redSet.get(x._id); const unlocked = spent >= x.spendRequiredKobo; return { id: x._id, name: x.name, spendRequiredLabel: ngn(x.spendRequiredKobo), unlocked, redeemed: !!red, status: red?.fulfilledAt ? "Given" : red ? "Redeemed" : unlocked ? "Ready to redeem" : `${ngn(x.spendRequiredKobo - spent)} to go` }; });
    return {
      player: { ...sMember(m), spentKobo: spent, spentLabel: ngn(spent), gamesPlayed: gamesPlayedOf(m._id) },
      purchases: S.purchases.filter((p) => p.playerId === m._id).sort((a, z) => z.createdAt - a.createdAt).map(sPurchase),
      redemptions: reds.map((x) => ({ id: x._id, rewardName: rmap.get(x.rewardId) ?? "—", code: x.code, redeemedAt: new Date(x.redeemedAt).toISOString() })),
      dueRewards,
    };
  }

  return err(404, "not_found", `Demo: no admin handler for ${method} /${r.join("/")}`);

  function activeRewardsAll() { return [...S.rewards].sort((a, b) => a.spendRequiredKobo - b.spendRequiredKobo); }
}

function pickFields(b: Record<string, unknown>, keys: string[]) {
  const out: Record<string, unknown> = {};
  for (const k of keys) if (k in b) out[k] = k === "priceKobo" || k === "durationMinutes" || k === "spendRequiredKobo" ? Math.max(0, Math.round(Number(b[k]))) : b[k];
  return out;
}
function mkGame(b: Record<string, unknown>): Game {
  const name = String(b.name ?? "New game");
  return { _id: nid("game"), name, slug: name.toLowerCase().replace(/\s+/g, "-"), category: b.category === "kids" ? "kids" : "teen", icon: String(b.icon ?? "gamepad"), location: String(b.location ?? ""), priceKobo: Math.max(0, Math.round(Number(b.priceKobo ?? 100000))), durationMinutes: Math.max(1, Math.round(Number(b.durationMinutes ?? 60))), description: String(b.description ?? ""), status: String(b.status ?? "active"), featured: Boolean(b.featured), minAge: null, minHeightCm: null, instructions: null, rules: null, safety: null, createdAt: Date.now() };
}

function analytics(kind: string, q: URLSearchParams) {
  const S = store;
  const period = String(q.get("period") ?? "today");
  let days: string[] = [];
  if (period === "custom") days = String(q.get("days") ?? "").split(",").map((d) => d.trim()).filter(Boolean);
  else if (period !== "all") days = [todayStr()];
  const inPeriod = (ts: number) => period === "all" || days.includes(dayStr(ts));
  const ps = S.purchases.filter((p) => !p.voidedAt && inPeriod(p.createdAt));

  if (kind === "stats") {
    const rev = ps.reduce((s, p) => s + p.amountKobo, 0);
    const plays = new Map<string, number>();
    ps.filter((p) => p.kind === "game").forEach((p) => plays.set(p.refId, (plays.get(p.refId) ?? 0) + 1));
    const popularGames = [...plays.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([gid, n]) => ({ gameId: gid, name: S.games.find((g) => g._id === gid)?.name ?? "—", plays: n }));
    return { period, totalPlayers: S.members.length, revenueKobo: rev, revenueLabel: ngn(rev), gamesLogged: ps.filter((p) => p.kind === "game").length, itemsSold: ps.filter((p) => p.kind === "item").reduce((s, p) => s + p.quantity, 0), activeSessions: 0, rewardsRedeemed: S.redemptions.filter((x) => inPeriod(x.redeemedAt)).length, popularGames, headsUpSeconds: S.settings.headsUpSeconds };
  }

  // analytics
  const bmap = new Map<string, { rev: number; games: number; items: number }>();
  for (const p of ps) { const d = dayStr(p.createdAt); const x = bmap.get(d) ?? { rev: 0, games: 0, items: 0 }; x.rev += p.amountKobo; if (p.kind === "game") x.games++; else x.items += p.quantity; bmap.set(d, x); }
  let axis: string[];
  if (period === "all") { const start = ps.length ? dayStr(Math.min(...ps.map((p) => p.createdAt))) : todayStr(); axis = daysBetween(start, todayStr()); }
  else axis = [...days].sort();
  const trends = axis.map((d) => { const x = bmap.get(d) ?? { rev: 0, games: 0, items: 0 }; return { date: d, revenueKobo: x.rev, revenueLabel: ngn(x.rev), games: x.games, items: x.items }; });
  const gStats = new Map<string, { name: string; plays: number; rev: number }>();
  const iStats = new Map<string, { name: string; qty: number; rev: number }>();
  for (const p of ps) { if (p.kind === "game") { const s = gStats.get(p.refId) ?? { name: p.name, plays: 0, rev: 0 }; s.plays++; s.rev += p.amountKobo; gStats.set(p.refId, s); } else { const s = iStats.get(p.refId) ?? { name: p.name, qty: 0, rev: 0 }; s.qty += p.quantity; s.rev += p.amountKobo; iStats.set(p.refId, s); } }
  const topGames = [...gStats.values()].sort((a, b) => b.rev - a.rev).slice(0, 6).map((s) => ({ name: s.name, plays: s.plays, revenueKobo: s.rev, revenueLabel: ngn(s.rev) }));
  const topItems = [...iStats.values()].sort((a, b) => b.rev - a.rev).slice(0, 6).map((s) => ({ name: s.name, qty: s.qty, revenueKobo: s.rev, revenueLabel: ngn(s.rev) }));
  let kids = 0, teen = 0;
  for (const [rid, s] of gStats) { if (S.games.find((g) => g._id === rid)?.category === "kids") kids += s.rev; else teen += s.rev; }
  const gamesKobo = ps.filter((p) => p.kind === "game").reduce((s, p) => s + p.amountKobo, 0);
  const itemsKobo = ps.filter((p) => p.kind === "item").reduce((s, p) => s + p.amountKobo, 0);
  const aStats = new Map<string, { orders: Set<string>; rev: number }>();
  for (const p of ps) { const aid = p.attendantId ?? "—"; const s = aStats.get(aid) ?? { orders: new Set<string>(), rev: 0 }; s.orders.add(`${p.playerId}:${p.createdAt}`); s.rev += p.amountKobo; aStats.set(aid, s); }
  const attendants = [...aStats.entries()].map(([aid, s]) => ({ name: S.attendants.find((a) => a._id === aid)?.name ?? "Unassigned", orders: s.orders.size, revenueKobo: s.rev, revenueLabel: ngn(s.rev) })).sort((a, b) => b.revenueKobo - a.revenueKobo);
  const pids = [...new Set(ps.map((p) => p.playerId))];
  const spend = new Map<string, number>();
  for (const p of ps) spend.set(p.playerId, (spend.get(p.playerId) ?? 0) + p.amountKobo);
  let newCount = 0, returningCount = 0;
  for (const pid of pids) { const m = S.members.find((x) => x._id === pid); if (m && period !== "all" && days.includes(dayStr(m.createdAt))) newCount++; else returningCount++; }
  const topSpenders = pids.map((pid) => ({ name: S.members.find((x) => x._id === pid)?.name ?? "Guest", revenueKobo: spend.get(pid) ?? 0 })).sort((a, b) => b.revenueKobo - a.revenueKobo).slice(0, 6).map((s) => ({ name: s.name, revenueKobo: s.revenueKobo, revenueLabel: ngn(s.revenueKobo) }));
  return { period, days, totalRevenueLabel: ngn(gamesKobo + itemsKobo), trends, topGames, topItems, categorySplit: { kidsKobo: kids, teenKobo: teen, kidsLabel: ngn(kids), teenLabel: ngn(teen) }, typeSplit: { gamesKobo, itemsKobo, gamesLabel: ngn(gamesKobo), itemsLabel: ngn(itemsKobo) }, attendants, newCount, returningCount, topSpenders };
}
function daysBetween(start: string, end: string): string[] {
  const out: string[] = []; let cur = new Date(`${start}T00:00:00`); const last = new Date(`${end}T00:00:00`);
  for (let i = 0; i < 120 && cur <= last; i++) { out.push(cur.toISOString().slice(0, 10)); cur = new Date(cur.getTime() + DAY); }
  return out;
}
