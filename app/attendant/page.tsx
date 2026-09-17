"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanLine, Check, UserPlus, Search, Gift, RotateCcw, Minus, Plus, Timer, ShoppingBag, Gamepad2, LogOut } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { money, timeAgo } from "@/lib/format";
import { Spinner, ErrorNote } from "@/components/ui";
import { CatalogTile } from "@/components/CatalogIcon";

type Cat = { id: string; name: string; icon: string; priceKobo: number; priceLabel: string; category?: string; location?: string; durationMinutes?: number };
type Lookup = { phone: string; found: boolean; player: { name: string | null; firstName: string | null; spentLabel: string; gamesPlayed: number } | null };
type Recent = { id: string; kind: string; name: string; icon: string; amountLabel: string; quantity: number; createdAt: string; player: { firstName: string | null; phone: string } };
type Result = { player: { firstName: string | null; phone: string; spentLabel: string }; purchase: { kind: string; name: string }; isNewPlayer: boolean; headsUpSeconds: number; unlockedRewards: { id: string; name: string }[] };
type Selected = { kind: "game" | "item"; ref: Cat } | null;

const MAIN_TABS = [
  { key: "games", label: "Games", icon: Gamepad2 },
  { key: "items", label: "Items", icon: ShoppingBag },
] as const;

export default function AttendantPage() {
  const [games, setGames] = useState<Cat[]>([]);
  const [items, setItems] = useState<Cat[]>([]);
  const [headsUp, setHeadsUp] = useState(60);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [mainTab, setMainTab] = useState<"games" | "items">("games");
  const [phone, setPhone] = useState("");
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [selected, setSelected] = useState<Selected>(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [me, setMe] = useState<{ name: string } | null>(null);
  const [itemQuery, setItemQuery] = useState("");
  const router = useRouter();

  const loadStatic = useCallback(async () => {
    const [c, rec] = await Promise.all([
      api<{ games: Cat[]; items: Cat[]; headsUpSeconds: number }>("/api/attendant/catalogue"),
      api<{ purchases: Recent[] }>("/api/attendant/recent"),
    ]);
    setGames(c.games);
    setItems(c.items);
    setHeadsUp(c.headsUpSeconds);
    setRecent(rec.purchases);
  }, []);

  useEffect(() => {
    api<{ attendant: { name: string } }>("/api/attendant/me")
      .then((r) => { setMe(r.attendant); return loadStatic(); })
      .catch((e) => { if (e instanceof ApiClientError && e.status === 401) router.replace("/attendant/login"); });
  }, [loadStatic, router]);

  async function logout() {
    await api("/api/attendant/logout", { method: "POST" }).catch(() => {});
    router.replace("/attendant/login");
  }

  useEffect(() => {
    if (phone.replace(/\s+/g, "").length < 6) { setLookup(null); return; }
    const t = setTimeout(() => { api<Lookup>(`/api/attendant/lookup?phone=${encodeURIComponent(phone)}`).then(setLookup).catch(() => setLookup(null)); }, 300);
    return () => clearTimeout(t);
  }, [phone]);

  const list = mainTab === "items"
    ? items.filter((i) => i.name.toLowerCase().includes(itemQuery.trim().toLowerCase()))
    : games;
  const total = selected ? selected.ref.priceKobo * qty : 0;

  async function charge() {
    if (!selected) return;
    setBusy(true);
    setError("");
    try {
      const res = await api<Result>("/api/attendant/purchase", {
        method: "POST",
        body: { phone, kind: selected.kind, refId: selected.ref.id, ...(selected.kind === "game" ? { hours: qty } : { quantity: qty }) },
      });
      setResult(res);
      await loadStatic();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not log the purchase.");
    } finally {
      setBusy(false);
    }
  }

  function pick(kind: "game" | "item", ref: Cat) {
    setSelected({ kind, ref });
    setQty(1);
  }
  function reset() {
    setPhone(""); setLookup(null); setSelected(null); setQty(1); setResult(null); setError("");
  }

  return (
    <main className="min-h-screen">
      <div className="border-b border-white/10 bg-black/30">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#2f6bff] to-[#1cb0f6] text-white"><ScanLine size={22} /></div>
            <div>
              <p className="font-black tracking-tight">Attendant Console</p>
              <p className="text-xs text-white/40">Log a game or an item a guest bought</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {me && <span className="hidden text-sm font-semibold text-white/60 sm:inline">{me.name}</span>}
            <button onClick={logout} className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white"><LogOut size={16} /> Sign out</button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {result ? (
          <div className="card mx-auto max-w-lg border-2 border-emerald-400/30 p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300"><Check size={34} /></div>
            <h1 className="text-2xl font-black">Purchase logged</h1>
            <p className="mt-1 text-white/60"><b className="text-white">{result.purchase.name}</b> for <b className="text-white">{result.player.firstName ?? result.player.phone}</b>{result.isNewPlayer && " (new player)"}.</p>
            {result.purchase.kind === "game" && (
              <p className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full bg-amber-400/10 px-4 py-2 text-sm text-amber-300"><Timer size={15} /> Timer starts after a {result.headsUpSeconds}s heads-up on their phone.</p>
            )}
            <p className="mt-3 text-sm text-white/60">Total spent now <b className="text-white">{result.player.spentLabel}</b></p>
            {result.unlockedRewards.length > 0 && (
              <div className="mx-auto mt-4 max-w-sm rounded-xl border border-[#ffc800]/30 bg-[#ffc800]/10 p-3 text-sm text-[#ffc800]"><Gift size={14} className="mr-1 inline" /> Unlocked: {result.unlockedRewards.map((r) => r.name).join(", ")}</div>
            )}
            <button className="btn-primary mt-6" onClick={reset}><RotateCcw size={16} /> New purchase</button>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left: player + catalogue */}
            <div className="space-y-4 lg:col-span-2">
              <div className="card p-5">
                <h2 className="mb-3 font-bold">1 · Player phone number</h2>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input className="input pl-9 text-lg" inputMode="tel" placeholder="e.g. 08012345678" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />
                </div>
                {lookup && (
                  <div className="mt-3">
                    {lookup.found && lookup.player ? (
                      <span className="pill bg-emerald-500/15 text-emerald-300"><Check size={13} /> Registered · spent {lookup.player.spentLabel}</span>
                    ) : (
                      <span className="pill bg-[#2f6bff]/15 text-[#2f6bff]"><UserPlus size={13} /> New guest · identified by phone</span>
                    )}
                  </div>
                )}
              </div>

              <div className="card p-5">
                <h2 className="mb-3 font-bold">2 · What did they buy?</h2>
                <div className="mb-3 flex flex-wrap gap-2">
                  {MAIN_TABS.map((t) => (
                    <button key={t.key} onClick={() => setMainTab(t.key)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm ${mainTab === t.key ? "bg-gradient-to-r from-[#2f6bff] to-[#1cb0f6] font-semibold text-white" : "bg-white/5 text-white/60 hover:bg-white/10"}`}>
                      <t.icon size={14} /> {t.label}
                    </button>
                  ))}
                </div>
                {mainTab === "items" && (
                  <div className="relative mb-3 mt-3">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <input className="input pl-9" placeholder="Search items…" value={itemQuery} onChange={(e) => setItemQuery(e.target.value)} />
                  </div>
                )}
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {list.map((c) => {
                    const sel = selected?.ref.id === c.id;
                    return (
                      <button key={c.id} onClick={() => pick(mainTab === "items" ? "item" : "game", c)} className={`relative rounded-2xl border-2 p-3 text-left transition ${sel ? "border-[#6c9bff] bg-[#2f6bff]/10 shadow-[0_0_0_2px_#6c9bff]" : "border-white/10 hover:border-white/25"}`}>
                        {sel && <span className="absolute right-2 top-2 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-[#2f6bff] text-white shadow"><Check size={13} /></span>}
                        <CatalogTile name={c.icon} accent={mainTab === "items" ? "item" : c.category === "kids" ? "kids" : "teen"} className="mb-2 h-11 w-11" size={22} />
                        <p className="truncate text-sm font-semibold">{c.name}</p>
                        <p className="text-xs text-white/45">{c.priceLabel}{mainTab !== "items" ? "/hr" : ""}</p>
                      </button>
                    );
                  })}
                  {list.length === 0 && <p className="col-span-full py-6 text-center text-sm text-white/40">{mainTab === "games" ? "No games here yet — add them in admin." : "No items yet — add them in admin."}</p>}
                </div>
              </div>
            </div>

            {/* Right: summary + recent */}
            <div className="space-y-4">
              <div className="card p-5 lg:sticky lg:top-6">
                <h2 className="mb-3 font-bold">3 · Confirm & log</h2>
                {error && <div className="mb-3"><ErrorNote message={error} /></div>}
                {!selected ? (
                  <p className="text-sm text-white/45">Pick a game or item to continue.</p>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <CatalogTile name={selected.ref.icon} accent={selected.kind === "item" ? "item" : "brand"} className="h-12 w-12" size={24} />
                      <div className="min-w-0">
                        <p className="truncate font-bold">{selected.ref.name}</p>
                        <p className="text-xs text-white/45">{selected.ref.priceLabel}{selected.kind === "game" ? " / hour" : " each"}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/60">{selected.kind === "game" ? "Hours" : "Quantity"}</span>
                      <div className="flex items-center gap-3">
                        <button className="rounded-lg border border-white/10 bg-white/5 p-1.5" onClick={() => setQty((n) => Math.max(1, n - 1))}><Minus size={14} /></button>
                        <span className="w-6 text-center font-bold">{qty}</span>
                        <button className="rounded-lg border border-white/10 bg-white/5 p-1.5" onClick={() => setQty((n) => n + 1)}><Plus size={14} /></button>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-white/10 pt-3">
                      <span className="font-semibold">Total</span>
                      <span className="text-xl font-black text-[#2f6bff]">{money(total, "NGN")}</span>
                    </div>
                    {selected.kind === "game" && (
                      <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-300">Player gets a {headsUp}s heads-up, then {qty} hour{qty > 1 ? "s" : ""} of play time.</p>
                    )}
                    <button className="btn-primary w-full py-4" disabled={busy || phone.replace(/\s+/g, "").length < 6} onClick={charge}>
                      {busy ? <Spinner /> : selected.kind === "item" ? "Record Sale" : "Record Game"}
                    </button>
                  </div>
                )}
              </div>

              {recent.length > 0 && (
                <div className="card p-4">
                  <h3 className="mb-2 text-sm font-semibold text-white/50">Recently logged</h3>
                  <div className="space-y-1">
                    {recent.slice(0, 6).map((l) => (
                      <div key={l.id} className="flex items-center justify-between gap-2 text-sm">
                        <span className="truncate"><b>{l.name}</b> · {l.player.firstName ?? l.player.phone}</span>
                        <span className="shrink-0 text-xs text-white/40">{timeAgo(l.createdAt)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
