"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Gift, ArrowRight, Trophy, MapPin, Timer, ShoppingBag } from "lucide-react";
import { api } from "@/lib/client";
import { timeAgo } from "@/lib/format";
import { useCustomer } from "@/components/customer/CustomerProvider";
import { CatalogTile } from "@/components/CatalogIcon";
import { SessionTimer } from "@/components/customer/SessionTimer";
import { Loading } from "@/components/ui";

type Purchase = {
  id: string;
  kind: "game" | "item";
  name: string;
  icon: string;
  amountLabel: string;
  quantity: number;
  createdAt: string;
  location: string | null;
  headsUpEndsAt: string | null;
  mainEndsAt: string | null;
  sessionStatus: "heads_up" | "active" | "completed" | null;
};
type NextReward = { name: string; spendRequiredLabel: string; remainingLabel: string; progressPct: number } | null;
type HomeData = {
  spentLabel: string;
  gamesPlayed: number;
  activeSessions: Purchase[];
  purchases: Purchase[];
  nextReward: NextReward;
  claimable: { id: string; name: string }[];
};

export default function HomePage() {
  const { refresh } = useCustomer();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setData(await api<HomeData>("/api/home"));
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
    const t = setInterval(() => { load().catch(() => {}); refresh().catch(() => {}); }, 4000);
    return () => clearInterval(t);
  }, [load, refresh]);

  if (loading || !data) return <Loading label="Loading…" />;

  const feed = data.purchases.filter((p) => !(p.kind === "game" && p.sessionStatus !== "completed"));

  return (
    <div className="space-y-6">
      <div className="hidden items-end justify-between md:flex">
        <div>
          <h1 className="text-2xl font-black tracking-tight">My Games</h1>
          <p className="text-sm text-white/50">{data.gamesPlayed} completed · spend more to unlock rewards</p>
        </div>
      </div>

      {/* Total spent — full-width in the main container on all screens */}
      <section className="on-brand relative overflow-hidden rounded-3xl border-2 border-[#46a302] bg-gradient-to-br from-[#58cc02] to-[#43a600] p-6 shadow-[0_6px_0_0_#3c9200]">
        <p className="text-sm font-bold uppercase tracking-wide text-white/80">Total spent</p>
        <div className="mt-1 flex items-end gap-2">
          <span className="text-5xl font-black tracking-tight text-white drop-shadow-sm md:text-6xl">{data.spentLabel}</span>
        </div>
        <p className="mt-1 text-sm text-white/80">{data.gamesPlayed} games completed at the venue.</p>
      </section>

      {/* Claimable + progress — full width, stacked */}
      {data.claimable.length > 0 && (
        <Link href="/rewards" className="flex items-center gap-3 rounded-2xl border-2 border-[#ffc800]/40 bg-[#ffc800]/10 p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ffc800]/20 text-[#ffc800]"><Gift size={22} /></div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">{data.claimable.length === 1 ? "You've unlocked a reward!" : `${data.claimable.length} rewards unlocked!`}</p>
            <p className="truncate text-xs text-white/60">{data.claimable.map((c) => c.name).join(", ")} · tap to redeem</p>
          </div>
          <ArrowRight className="text-[#ffc800]" size={18} />
        </Link>
      )}
      {data.nextReward && (
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold"><Trophy size={15} className="text-[#ffc800]" /> Next reward: {data.nextReward.name}</span>
            <span className="text-xs text-white/50">{data.nextReward.spendRequiredLabel}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-[#58cc02] to-[#1cb0f6] transition-all" style={{ width: `${data.nextReward.progressPct}%` }} />
          </div>
          <p className="mt-2 text-xs text-white/55">Spend {data.nextReward.remainingLabel} more to unlock it.</p>
        </section>
      )}

      {/* Active sessions */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><Timer size={18} className="text-[#58cc02]" /> Active now</h2>
        {data.activeSessions.length === 0 ? (
          <div className="card p-6 text-center text-sm text-white/50">
            No active game. When you buy a game at the desk, the countdown shows up here.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {data.activeSessions.map((p) => (
              <div key={p.id} className="card space-y-3 p-4">
                <div className="flex items-center gap-3">
                  <CatalogTile name={p.icon} accent="teen" className="h-12 w-12" size={24} />
                  <div className="min-w-0">
                    <p className="truncate font-bold">{p.name}</p>
                    <p className="inline-flex items-center gap-1 text-xs text-white/45"><MapPin size={11} /> {p.location}</p>
                  </div>
                </div>
                <SessionTimer headsUpEndsAt={p.headsUpEndsAt} mainEndsAt={p.mainEndsAt} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Purchases feed */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-bold"><ShoppingBag size={18} className="text-white/70" /> Recent purchases</h2>
        {feed.length === 0 ? (
          <div className="card p-6 text-center text-sm text-white/50">Nothing yet. Games you finish and items you buy will appear here.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {feed.map((p) => (
              <div key={p.id} className="card flex items-center gap-3 p-3">
                <CatalogTile name={p.icon} accent={p.kind === "item" ? "item" : "muted"} className="h-12 w-12" size={22} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{p.name}{p.kind === "item" && p.quantity > 1 ? ` ×${p.quantity}` : ""}</p>
                  <p className="text-xs text-white/40">
                    {p.kind === "game" ? "Game · played" : "Item"} · {timeAgo(p.createdAt)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-bold text-white/80">{p.amountLabel}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
