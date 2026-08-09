"use client";

import { useEffect, useState } from "react";
import { Coins, Plus, Check, Sparkles } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { pts, timeAgo } from "@/lib/format";
import { useCustomer } from "@/components/customer/CustomerProvider";
import { Loading, ErrorNote } from "@/components/ui";

type Pkg = {
  id: string;
  name: string;
  points: number;
  bonusPoints: number;
  totalPoints: number;
  priceLabel: string;
};
type Txn = { id: string; amount: number; reason: string; createdAt: string; balanceAfter: number };

export default function WalletPage() {
  const { customer, refresh, setBalance } = useCustomer();
  const [packages, setPackages] = useState<Pkg[]>([]);
  const [txns, setTxns] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Pkg | null>(null);
  const [buying, setBuying] = useState(false);
  const [done, setDone] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const [p, w] = await Promise.all([
      api<{ packages: Pkg[] }>("/api/packages"),
      api<{ transactions: Txn[] }>("/api/wallet"),
    ]);
    setPackages(p.packages);
    setTxns(w.transactions);
  }

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function buy() {
    if (!selected) return;
    setBuying(true);
    setError("");
    try {
      // 1) initiate — records a pending purchase
      const init = await api<{ reference: string; pointsCredited: number }>("/api/purchases", {
        method: "POST",
        body: { packageId: selected.id },
      });
      // 2) simulate the payment provider confirming success
      const res = await api<{ credited: boolean; balance: number | null; pointsCredited: number }>(
        "/api/purchases/confirm",
        { method: "POST", body: { reference: init.reference, outcome: "success" } },
      );
      if (res.balance != null) setBalance(res.balance);
      setDone(res.pointsCredited);
      setSelected(null);
      await refresh();
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Payment failed.");
    } finally {
      setBuying(false);
    }
  }

  if (loading) return <Loading label="Loading wallet…" />;

  return (
    <div className="space-y-6 pt-1">
      {/* Balance */}
      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#1c2340] to-[#0a0e1a] p-6">
        <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-[#ffc800]/15 blur-3xl" />
        <p className="text-sm text-white/50">Wallet balance</p>
        <div className="mt-1 flex items-end gap-2">
          <Coins className="mb-2 text-[#ffc800]" />
          <span className="text-5xl font-black tracking-tight">{pts(customer.balance)}</span>
          <span className="mb-1.5 text-sm font-bold tracking-widest text-white/50">POINTS</span>
        </div>
      </section>

      {done != null && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4">
          <Check className="text-emerald-300" />
          <p className="text-sm font-semibold">Payment confirmed — {pts(done)} points added.</p>
        </div>
      )}

      {/* Packages */}
      <section>
        <h2 className="mb-1 text-lg font-bold">Buy points</h2>
        <p className="mb-3 text-xs text-white/45">Payment is simulated in this demo.</p>
        <div className="grid grid-cols-2 gap-3">
          {packages.map((p) => (
            <button
              key={p.id}
              onClick={() => { setSelected(p); setDone(null); }}
              className="card p-4 text-left transition hover:border-[#58cc02]/40"
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl font-black">{pts(p.points)}</span>
                <Coins size={18} className="text-[#ffc800]" />
              </div>
              <p className="text-xs text-white/45">points</p>
              {p.bonusPoints > 0 && (
                <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-300">
                  <Sparkles size={12} /> +{p.bonusPoints} bonus
                </p>
              )}
              <div className="mt-3 rounded-lg bg-white/5 py-1.5 text-center text-sm font-bold">
                {p.priceLabel}
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Ledger */}
      <section>
        <h2 className="mb-3 text-lg font-bold">Transaction history</h2>
        {txns.length === 0 ? (
          <div className="card p-6 text-center text-sm text-white/50">No transactions yet.</div>
        ) : (
          <div className="card divide-y divide-white/5">
            {txns.map((t) => (
              <div key={t.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm">{t.reason}</p>
                  <p className="text-xs text-white/40">{timeAgo(t.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className={`text-sm font-bold ${t.amount >= 0 ? "text-emerald-300" : "text-white/80"}`}>
                    {t.amount >= 0 ? "+" : ""}
                    {t.amount}
                  </p>
                  <p className="text-[11px] text-white/35">{pts(t.balanceAfter)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Buy confirmation sheet */}
      {selected && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4" onClick={() => !buying && setSelected(null)}>
          <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#141a2e] p-6" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <h2 className="text-xl font-bold">Confirm purchase</h2>
            <p className="mt-2 text-white/70">
              Buy <b className="text-white">{pts(selected.totalPoints)} points</b> for{" "}
              <b className="text-white">{selected.priceLabel}</b>.
            </p>
            {selected.bonusPoints > 0 && (
              <p className="mt-1 text-sm text-emerald-300">Includes {selected.bonusPoints} bonus points.</p>
            )}
            {error && <div className="mt-3"><ErrorNote message={error} /></div>}
            <div className="mt-5 space-y-2">
              <button className="btn-primary w-full py-4" onClick={buy} disabled={buying}>
                <Plus size={18} /> {buying ? "Processing payment…" : `Pay ${selected.priceLabel} (simulated)`}
              </button>
              <button className="btn-ghost w-full" onClick={() => setSelected(null)} disabled={buying}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
