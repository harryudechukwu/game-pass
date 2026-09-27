"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Scan, Check, UserPlus, MagnifyingGlass as Search, Gift, ArrowCounterClockwise as RotateCcw, Minus, Plus, Timer, ShoppingBag, GameController as Gamepad2, SignOut as LogOut, Trash as Trash2, ShoppingCart, IconContext } from "@phosphor-icons/react";
import { api, ApiClientError } from "@/lib/client";
import { money } from "@/lib/format";
import { Spinner, ErrorNote } from "@/components/ui";

type Cat = { id: string; name: string; icon: string; priceKobo: number; priceLabel: string; category?: string; location?: string; durationMinutes?: number };
type Lookup = { phone: string; found: boolean; player: { name: string | null; firstName: string | null; spentLabel: string; gamesPlayed: number } | null };
type OrderLine = { kind: string; name: string; quantity: number; amountLabel: string };
type OrderResult = {
  purchases: OrderLine[];
  totalLabel: string;
  player: { firstName: string | null; phone: string; spentLabel: string };
  isNewPlayer: boolean;
  headsUpSeconds: number;
  hasGame: boolean;
  unlockedRewards: { id: string; name: string }[];
};
type RedeemResult = { code: string; reward: { name: string }; player: { firstName: string | null; phone: string } | null };
type CartLine = { key: string; kind: "game" | "item"; ref: Cat; qty: number };

const MAIN_TABS = [
  { key: "games", label: "Games", icon: Gamepad2 },
  { key: "items", label: "Items", icon: ShoppingBag },
] as const;

export default function AttendantPage() {
  const [games, setGames] = useState<Cat[]>([]);
  const [items, setItems] = useState<Cat[]>([]);
  const [headsUp, setHeadsUp] = useState(60);
  const [mainTab, setMainTab] = useState<"games" | "items">("games");
  const [phone, setPhone] = useState("");
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<OrderResult | null>(null);
  const [review, setReview] = useState(false);
  const [me, setMe] = useState<{ name: string } | null>(null);
  const [itemQuery, setItemQuery] = useState("");
  const [redeemMode, setRedeemMode] = useState(false);
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemBusy, setRedeemBusy] = useState(false);
  const [redeemError, setRedeemError] = useState("");
  const [redeemResult, setRedeemResult] = useState<RedeemResult | null>(null);
  const router = useRouter();

  const loadStatic = useCallback(async () => {
    const c = await api<{ games: Cat[]; items: Cat[]; headsUpSeconds: number }>("/api/attendant/catalogue");
    setGames(c.games);
    setItems(c.items);
    setHeadsUp(c.headsUpSeconds);
  }, []);

  useEffect(() => {
    api<{ attendant: { name: string } }>("/api/attendant/me")
      .then((r) => { setMe(r.attendant); return loadStatic(); })
      .catch((e) => { if (e instanceof ApiClientError && e.status === 401) router.replace("/attendant/login"); });
  }, [loadStatic, router]);

  function logout() {
    void api("/api/attendant/logout", { method: "POST" }).catch(() => {});
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

  function addToCart(kind: "game" | "item", ref: Cat) {
    setCart((prev) => {
      const existing = prev.find((l) => l.kind === kind && l.ref.id === ref.id);
      if (existing) return prev.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, { key: `${kind}:${ref.id}:${Date.now()}`, kind, ref, qty: 1 }];
    });
  }
  function setQty(key: string, qty: number) {
    setCart((prev) => prev.map((l) => (l.key === key ? { ...l, qty: Math.max(1, qty) } : l)));
  }
  function removeLine(key: string) {
    setCart((prev) => prev.filter((l) => l.key !== key));
  }

  const total = cart.reduce((s, l) => s + l.ref.priceKobo * l.qty, 0);
  const cartCount = cart.reduce((s, l) => s + l.qty, 0);

  async function submitOrder() {
    if (cart.length === 0) return;
    setBusy(true);
    setError("");
    try {
      const res = await api<OrderResult>("/api/attendant/order", {
        method: "POST",
        body: {
          phone,
          lines: cart.map((l) => ({ kind: l.kind, refId: l.ref.id, ...(l.kind === "game" ? { hours: l.qty } : { quantity: l.qty }) })),
        },
      });
      setResult(res);
      setCart([]);
      await loadStatic();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not record the order.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPhone(""); setLookup(null); setCart([]); setResult(null); setReview(false); setError("");
  }

  async function redeemReward() {
    setRedeemBusy(true); setRedeemError("");
    try {
      const res = await api<RedeemResult>("/api/attendant/redeem", { method: "POST", body: { code: redeemCode } });
      setRedeemResult(res);
    } catch (e) {
      setRedeemError(e instanceof ApiClientError ? e.message : "Could not redeem the code.");
    } finally {
      setRedeemBusy(false);
    }
  }
  function closeRedeem() { setRedeemMode(false); setRedeemCode(""); setRedeemResult(null); setRedeemError(""); }

  return (
    <IconContext.Provider value={{ weight: "duotone" }}>
    <main className="min-h-screen">
      <div className="border-b border-[#bbdefb] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#e3f3fd] text-[#0d47a1]"><Scan size={26} weight="duotone" /></div>
            <div>
              <p className="font-black tracking-tight">Attendant Console</p>
              <p className="text-xs text-white/40">Log the games and items a guest bought</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setRedeemMode(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-b-[3px] border-[#dfe3e9] bg-white px-3 py-1.5 text-sm font-semibold text-[#0d47a1]"><Gift size={17} /> Redeem reward</button>
            {me && <span className="pill hidden sm:inline-flex">{me.name}</span>}
            <button onClick={logout} className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white"><LogOut size={18} /> Sign out</button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 py-8">
        {result ? (
          <div className="card mx-auto max-w-lg border-2 border-emerald-400/30 p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300"><Check size={34} /></div>
            <h1 className="text-2xl font-black">Order logged</h1>
            <p className="mt-1 text-white/60">{result.purchases.length} item{result.purchases.length > 1 ? "s" : ""} for <b className="text-white">{result.player.firstName ?? result.player.phone}</b>{result.isNewPlayer && " (new player)"}.</p>
            <div className="mx-auto mt-4 max-w-sm space-y-1 rounded-xl border border-white/10 bg-white/5 p-3 text-left text-sm">
              {result.purchases.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="truncate text-white/80">{p.name}{p.quantity > 1 ? ` ×${p.quantity}` : ""}</span>
                  <span className="shrink-0 text-white/60">{p.amountLabel}</span>
                </div>
              ))}
              <div className="mt-1 flex items-center justify-between border-t border-white/10 pt-2 font-bold"><span>Total</span><span className="text-[#0d47a1]">{result.totalLabel}</span></div>
            </div>
            {result.hasGame && (
              <p className="mx-auto mt-3 inline-flex items-center gap-2 rounded-full bg-amber-400/10 px-4 py-2 text-sm text-amber-300"><Timer size={15} /> Game timers start after a {result.headsUpSeconds}s heads-up on their phone.</p>
            )}
            {result.unlockedRewards.length > 0 && (
              <div className="mx-auto mt-4 max-w-sm rounded-xl border border-[#ffc800]/30 bg-[#ffc800]/10 p-3 text-sm text-[#ffc800]"><Gift size={14} className="mr-1 inline" /> Unlocked: {result.unlockedRewards.map((r) => r.name).join(", ")}</div>
            )}
            <button className="btn-primary mt-6" onClick={reset}><RotateCcw size={16} /> New order</button>
          </div>
        ) : review ? (
          <div className="card mx-auto max-w-lg p-6">
            <h1 className="text-2xl font-black">Review order</h1>
            <p className="mt-1 text-white/55">Check the details before you log it.</p>
            {error && <div className="mt-4"><ErrorNote message={error} /></div>}
            <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-white/50">Player</span>
                <span className="font-semibold">{lookup?.player?.firstName ?? phone}{lookup && !lookup.found ? " · new guest" : ""}</span>
              </div>
              <div className="mt-3 space-y-2 border-t border-white/10 pt-3">
                {cart.map((l) => (
                  <div key={l.key} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-white/80">{l.ref.name}{l.kind === "game" ? ` · ${l.qty}h` : l.qty > 1 ? ` ×${l.qty}` : ""}</span>
                    <span className="shrink-0 text-white/70">{money(l.ref.priceKobo * l.qty, "NGN")}</span>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 font-bold">
                <span>Total</span><span className="text-xl text-[#0d47a1]">{money(total, "NGN")}</span>
              </div>
            </div>
            {cart.some((l) => l.kind === "game") && (
              <p className="mt-3 rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-300"><Timer size={13} className="mr-1 inline" /> Game timers start after a {headsUp}s heads-up on the player&apos;s phone.</p>
            )}
            <div className="mt-6 flex gap-3">
              <button className="btn-ghost flex-1" onClick={() => setReview(false)} disabled={busy}>Back to edit</button>
              <button className="btn-primary flex-1" onClick={submitOrder} disabled={busy}>{busy ? <Spinner /> : "Confirm & log"}</button>
            </div>
          </div>
        ) : redeemMode ? (
          <div className="card mx-auto max-w-lg p-6">
            <h1 className="text-2xl font-black">Redeem a reward</h1>
            <p className="mt-1 text-white/55">Enter the code the guest shows you at the desk.</p>
            {redeemError && <div className="mt-4"><ErrorNote message={redeemError} /></div>}
            {redeemResult ? (
              <div className="mt-5 text-center">
                <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e3f3fd] text-[#0d47a1]"><Gift size={32} weight="duotone" /></div>
                <p className="text-xl font-black">{redeemResult.reward.name}</p>
                <p className="mt-1 text-sm text-white/55">for {redeemResult.player?.firstName ?? redeemResult.player?.phone ?? "the guest"}</p>
                <p className="mx-auto mt-4 max-w-xs rounded-xl bg-[#e3f3fd] px-3 py-2 text-sm font-semibold text-[#0d47a1]">Hand the reward over — it&apos;s now marked as given.</p>
                <div className="mt-6 flex gap-3">
                  <button className="btn-ghost flex-1" onClick={() => { setRedeemResult(null); setRedeemCode(""); }}>Redeem another</button>
                  <button className="btn-primary flex-1" onClick={closeRedeem}>Done</button>
                </div>
              </div>
            ) : (
              <div className="mt-5">
                <label className="label">Reward code</label>
                <input className="input text-center text-2xl font-black uppercase tracking-[0.3em]" placeholder="25FZ7" value={redeemCode} onChange={(e) => setRedeemCode(e.target.value)} autoFocus />
                <div className="mt-5 flex gap-3">
                  <button className="btn-ghost flex-1" onClick={closeRedeem} disabled={redeemBusy}>Cancel</button>
                  <button className="btn-primary flex-1" onClick={redeemReward} disabled={redeemBusy || redeemCode.trim().length < 4}>{redeemBusy ? <Spinner /> : "Redeem"}</button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Left: player + catalogue */}
            <div className="space-y-4">
              <div className="card p-5">
                <h2 className="mb-3 font-bold">1 · Player phone number</h2>
                <div className="relative">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                  <input className="input pl-9 text-lg" inputMode="tel" placeholder="e.g. 08012345678" value={phone} onChange={(e) => setPhone(e.target.value)} autoFocus />
                </div>
                {lookup && (
                  <div className="mt-3">
                    {lookup.found && lookup.player ? (
                      <span className="pill"><Check size={14} /> Registered</span>
                    ) : (
                      <span className="pill"><UserPlus size={14} /> New guest</span>
                    )}
                  </div>
                )}
              </div>

              <div className="card p-5">
                <h2 className="mb-3 font-bold">2 · Add games &amp; items</h2>
                <div className="mb-3 flex flex-wrap gap-2">
                  {MAIN_TABS.map((t) => (
                    <button key={t.key} onClick={() => setMainTab(t.key)} className={`inline-flex items-center gap-2 rounded-lg border border-b-[3px] px-4 py-2 text-base ${mainTab === t.key ? "border-[#2170ed] bg-[#5a95f2] font-semibold text-[#ffffff]" : "border-transparent bg-white/5 text-white/60 hover:bg-white/10"}`}>
                      <t.icon size={20} /> {t.label}
                    </button>
                  ))}
                </div>
                {mainTab === "items" && (
                  <div className="relative mb-3 mt-3">
                    <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                    <input className="input pl-9" placeholder="Search items…" value={itemQuery} onChange={(e) => setItemQuery(e.target.value)} />
                  </div>
                )}
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {list.map((c) => {
                    const kind = mainTab === "items" ? "item" : "game";
                    const inCart = cart.find((l) => l.kind === kind && l.ref.id === c.id);
                    return (
                      <button key={c.id} onClick={() => addToCart(kind, c)} className={`relative flex min-h-[104px] flex-col justify-end rounded-2xl border border-b-[3px] border-[#dfe3e9] p-4 text-left transition ${inCart ? "bg-[#5a95f2]/10" : "hover:bg-[#f5f8fd]"}`}>
                        {inCart && <span className="absolute right-3 top-3 z-10 flex h-6 min-w-6 items-center justify-center rounded-full bg-[#5a95f2] px-1.5 text-sm font-bold text-white">{inCart.qty}</span>}
                        <p className="truncate pr-6 text-base font-bold sm:text-lg">{c.name}</p>
                        <p className="mt-1 text-sm font-semibold text-white/45 sm:text-base">{c.priceLabel}{mainTab !== "items" ? "/hr" : ""}</p>
                      </button>
                    );
                  })}
                  {list.length === 0 && <p className="col-span-full py-6 text-center text-sm text-white/40">{mainTab === "games" ? "No games here yet — add them in admin." : "No items yet — add them in admin."}</p>}
                </div>
              </div>
            </div>

            {/* Right: order (cart) + recent */}
            <div className="space-y-4">
              <div className="card p-5 lg:sticky lg:top-6">
                <h2 className="mb-3 flex items-center gap-2 font-bold"><ShoppingCart size={20} /> Order {cartCount > 0 && <span className="pill bg-white/10 text-white/70">{cartCount}</span>}</h2>
                {error && <div className="mb-3"><ErrorNote message={error} /></div>}
                {cart.length === 0 ? (
                  <p className="text-sm text-white/45">Tap games or items on the left to add them to the order.</p>
                ) : (
                  <div className="space-y-3">
                    {cart.map((l) => (
                      <div key={l.key} className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-base font-semibold">{l.ref.name}</p>
                          <p className="text-sm text-white/45">{money(l.ref.priceKobo * l.qty, "NGN")}{l.kind === "game" ? ` · ${l.qty}h` : ""}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button className="rounded-lg border border-[#bbdefb] bg-white p-2 text-[#0d47a1] hover:bg-[#0d47a1]/5" onClick={() => setQty(l.key, l.qty - 1)}><Minus size={18} /></button>
                          <span className="w-6 text-center text-base font-bold">{l.qty}</span>
                          <button className="rounded-lg border border-[#bbdefb] bg-white p-2 text-[#0d47a1] hover:bg-[#0d47a1]/5" onClick={() => setQty(l.key, l.qty + 1)}><Plus size={18} /></button>
                          <button className="ml-1 rounded-lg p-2 text-white/40 hover:text-red-500" onClick={() => removeLine(l.key)}><Trash2 size={20} /></button>
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center justify-between border-t border-white/10 pt-3">
                      <span className="text-base font-semibold">Total</span>
                      <span className="text-2xl font-black text-[#0d47a1]">{money(total, "NGN")}</span>
                    </div>
                    {cart.some((l) => l.kind === "game") && (
                      <p className="rounded-lg bg-amber-400/10 px-3 py-2 text-xs text-amber-300">Game timers start after a {headsUp}s heads-up on the player&apos;s phone.</p>
                    )}
                    <button className="btn-primary w-full py-4" disabled={phone.replace(/\s+/g, "").length < 6} onClick={() => { setError(""); setReview(true); }}>
                      Review order
                    </button>
                  </div>
                )}
              </div>

            </div>
          </div>
        )}
      </div>
    </main>
    </IconContext.Provider>
  );
}
