"use client";

import { useCallback, useEffect, useState } from "react";
import { Gift, Lock, Check, Ticket, Copy } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { useCustomer } from "@/components/customer/CustomerProvider";
import { Loading, ErrorNote } from "@/components/ui";

type Reward = {
  id: string;
  name: string;
  description: string | null;
  gamesRequired: number;
  unlocked: boolean;
  redeemed: boolean;
  code: string | null;
  claimable: boolean;
};

export default function RewardsPage() {
  const { refresh } = useCustomer();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ gamesPlayed: number; rewards: Reward[] }>("/api/rewards");
    setRewards(r.rewards);
    setGamesPlayed(r.gamesPlayed);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function redeem(id: string) {
    setBusy(id);
    setError("");
    try {
      await api(`/api/rewards/${id}/redeem`, { method: "POST" });
      await load();
      await refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not redeem.");
    } finally {
      setBusy(null);
    }
  }

  function copy(code: string) {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  if (loading) return <Loading label="Loading rewards…" />;

  return (
    <div className="space-y-5 pt-1">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Rewards</h1>
        <p className="text-sm text-white/50">Keep playing to unlock these. Show the code to an attendant to claim.</p>
      </div>

      {error && <ErrorNote message={error} />}

      <div className="space-y-3">
        {rewards.map((r) => (
          <div
            key={r.id}
            className={`card p-4 ${r.claimable ? "border-2 border-[#ffc800]/50" : ""} ${!r.unlocked ? "opacity-90" : ""}`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                  r.redeemed ? "bg-emerald-500/15 text-emerald-300" : r.claimable ? "bg-[#ffc800]/20 text-[#ffc800]" : "bg-white/8 text-white/40"
                }`}
              >
                {r.redeemed ? <Check size={20} /> : r.unlocked ? <Gift size={20} /> : <Lock size={18} />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold">{r.name}</h3>
                  <span className="pill shrink-0 bg-white/5 text-white/60">{r.gamesRequired} games</span>
                </div>
                {r.description && <p className="mt-0.5 text-sm text-white/55">{r.description}</p>}

                {/* State */}
                {r.redeemed && r.code ? (
                  <button
                    onClick={() => copy(r.code!)}
                    className="mt-3 flex w-full items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-left"
                  >
                    <span className="inline-flex items-center gap-2 text-sm text-emerald-300">
                      <Ticket size={15} /> Code <b className="font-mono tracking-widest">{r.code}</b>
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-white/50">
                      <Copy size={13} /> {copied === r.code ? "Copied" : "Copy"}
                    </span>
                  </button>
                ) : r.claimable ? (
                  <button className="btn-gold mt-3 w-full" disabled={busy === r.id} onClick={() => redeem(r.id)}>
                    <Gift size={16} /> {busy === r.id ? "Redeeming…" : "Redeem now"}
                  </button>
                ) : (
                  <div className="mt-3">
                    <div className="h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#58cc02] to-[#1cb0f6]"
                        style={{ width: `${Math.min(100, Math.round((gamesPlayed / r.gamesRequired) * 100))}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-white/45">
                      {Math.max(0, r.gamesRequired - gamesPlayed)} more game
                      {r.gamesRequired - gamesPlayed === 1 ? "" : "s"} to unlock
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        {rewards.length === 0 && (
          <div className="card p-8 text-center text-white/50">No rewards available yet — check back soon.</div>
        )}
      </div>
    </div>
  );
}
