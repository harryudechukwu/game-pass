"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Gamepad2, MapPin, Clock, Gift, Sparkles, ArrowRight, Trophy } from "lucide-react";
import { api } from "@/lib/client";
import { timeAgo } from "@/lib/format";
import { useCustomer } from "@/components/customer/CustomerProvider";
import { Loading } from "@/components/ui";

type Log = {
  id: string;
  loggedAt: string;
  game: { id: string; name: string; imageUrl: string; location: string; durationLabel: string } | null;
};
type NextReward = { name: string; gamesRequired: number; remaining: number } | null;

export default function HomePage() {
  const { refresh } = useCustomer();
  const [logs, setLogs] = useState<Log[]>([]);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [nextReward, setNextReward] = useState<NextReward>(null);
  const [claimable, setClaimable] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [l, r] = await Promise.all([
      api<{ gamesPlayed: number; logs: Log[] }>("/api/logs"),
      api<{ nextReward: NextReward; rewards: { id: string; name: string; claimable: boolean }[] }>("/api/rewards"),
    ]);
    setLogs(l.logs);
    setGamesPlayed(l.gamesPlayed);
    setNextReward(r.nextReward);
    setClaimable(r.rewards.filter((x) => x.claimable).map((x) => ({ id: x.id, name: x.name })));
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
    const t = setInterval(() => { load().catch(() => {}); refresh().catch(() => {}); }, 4000);
    return () => clearInterval(t);
  }, [load, refresh]);

  const progressPct = nextReward
    ? Math.min(100, Math.round(((nextReward.gamesRequired - nextReward.remaining) / nextReward.gamesRequired) * 100))
    : 100;

  return (
    <div className="space-y-6">
      {/* Games-played hero */}
      <section className="on-brand relative overflow-hidden rounded-3xl border-2 border-[#46a302] bg-gradient-to-br from-[#58cc02] to-[#43a600] p-6 shadow-[0_6px_0_0_#3c9200]">
        <div className="pointer-events-none absolute -right-6 -top-8 text-8xl opacity-20">🎮</div>
        <p className="text-sm font-bold uppercase tracking-wide text-white/80">Games played</p>
        <div className="mt-1 flex items-end gap-2">
          <span className="text-6xl font-black tracking-tight text-white drop-shadow-sm">{gamesPlayed}</span>
          <span className="mb-2 text-sm font-black tracking-widest text-white/80">GAMES</span>
        </div>
        <p className="mt-1 text-sm text-white/80">Play at the venue, then have the attendant log it here.</p>
      </section>

      {/* Claimable rewards callout */}
      {claimable.length > 0 && (
        <Link href="/rewards" className="flex items-center gap-3 rounded-2xl border-2 border-[#ffc800]/40 bg-[#ffc800]/10 p-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#ffc800]/20 text-[#ffc800]">
            <Gift size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">
              {claimable.length === 1 ? "You've unlocked a reward!" : `You've unlocked ${claimable.length} rewards!`}
            </p>
            <p className="truncate text-xs text-white/60">{claimable.map((c) => c.name).join(", ")} · tap to redeem</p>
          </div>
          <ArrowRight className="text-[#ffc800]" size={18} />
        </Link>
      )}

      {/* Progress to next reward */}
      {nextReward && (
        <section className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold">
              <Trophy size={15} className="text-[#ffc800]" /> Next reward: {nextReward.name}
            </span>
            <span className="text-xs text-white/50">{gamesPlayed}/{nextReward.gamesRequired}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-gradient-to-r from-[#58cc02] to-[#1cb0f6] transition-all" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="mt-2 text-xs text-white/55">
            {nextReward.remaining === 1 ? "1 more game" : `${nextReward.remaining} more games`} to unlock it.
          </p>
        </section>
      )}

      {/* Logged games feed */}
      <section>
        <h2 className="mb-3 text-lg font-bold">Your games</h2>
        {loading ? (
          <Loading />
        ) : logs.length === 0 ? (
          <div className="card p-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/5 text-white/40">
              <Gamepad2 size={26} />
            </div>
            <p className="font-semibold">No games logged yet</p>
            <p className="mt-1 text-sm text-white/50">
              After you play at the venue, ask the attendant to log it — it&apos;ll show up right here.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((l, i) => (
              <div
                key={l.id}
                className={`card flex items-center gap-3 overflow-hidden p-3 ${i === 0 ? "border-[#58cc02]/40" : ""}`}
              >
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-[#1c2340] to-[#0a0e1a]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {l.game?.imageUrl && <img src={l.game.imageUrl} alt="" className="h-full w-full object-cover" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-bold">{l.game?.name ?? "Game"}</p>
                    {i === 0 && (
                      <span className="pill shrink-0 bg-[#58cc02]/15 text-[#58cc02]"><Sparkles size={11} /> new</span>
                    )}
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-white/45">
                    <span className="inline-flex items-center gap-1"><MapPin size={11} /> {l.game?.location}</span>
                    <span className="inline-flex items-center gap-1"><Clock size={11} /> {l.game?.durationLabel}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-white/40">Logged {timeAgo(l.loggedAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
