"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, Zap, Ticket, ArrowRight, Trophy, ChevronRight } from "lucide-react";
import { api } from "@/lib/client";
import { pts, timeAgo } from "@/lib/format";
import { useCustomer } from "@/components/customer/CustomerProvider";
import { GameCard, type GameLite } from "@/components/customer/GameCard";
import { Loading } from "@/components/ui";
import { PassCountdown } from "@/components/customer/PassCountdown";

type Reward = { id: string; name: string; description: string | null; points: number };
type Txn = { id: string; amount: number; reason: string; createdAt: string };

export default function HomePage() {
  const { customer, activePass } = useCustomer();
  const [games, setGames] = useState<GameLite[]>([]);
  const [featured, setFeatured] = useState<GameLite[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [recent, setRecent] = useState<Txn[]>([]);
  const [loading, setLoading] = useState(true);
  const [bonus, setBonus] = useState<number | null>(null);

  useEffect(() => {
    const b = sessionStorage.getItem("welcomeBonus");
    if (b) {
      setBonus(Number(b));
      sessionStorage.removeItem("welcomeBonus");
    }
    Promise.all([
      api<{ games: GameLite[]; featured: GameLite[] }>("/api/games"),
      api<{ rewards: Reward[] }>("/api/rewards"),
      api<{ transactions: Txn[] }>("/api/wallet"),
    ])
      .then(([g, r, w]) => {
        setGames(g.games);
        setFeatured(g.featured);
        setRewards(r.rewards);
        setRecent(w.transactions.slice(0, 4));
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-7">
      {bonus && (
        <div className="flex items-center gap-3 rounded-2xl border border-[#ffc800]/30 bg-gradient-to-r from-[#ffc800]/15 to-transparent p-4">
          <Sparkles className="text-[#ffc800]" />
          <div>
            <p className="font-bold">Welcome! You&apos;ve received {bonus} bonus points.</p>
            <p className="text-sm text-white/60">Spend them on any physical game at the venue.</p>
          </div>
        </div>
      )}

      {/* Balance hero */}
      <section className="on-brand relative overflow-hidden rounded-3xl border-2 border-[#46a302] bg-gradient-to-br from-[#58cc02] to-[#43a600] p-6 shadow-[0_6px_0_0_#3c9200]">
        <div className="pointer-events-none absolute -right-8 -top-10 text-8xl opacity-20 blur-[1px]">🕹️</div>
        <p className="text-sm font-bold uppercase tracking-wide text-white/80">Your balance</p>
        <div className="mt-1 flex items-end gap-2">
          <span className="text-6xl font-black tracking-tight text-white drop-shadow-sm">{pts(customer.balance)}</span>
          <span className="mb-2 text-sm font-black tracking-widest text-white/80">POINTS</span>
        </div>
        <div className="mt-5 flex gap-2">
          <a href="#catalogue" className="btn-gold flex-1">
            <Zap size={18} /> Play Now
          </a>
          <Link href="/wallet" className="btn-ghost">
            Buy points
          </Link>
        </div>
      </section>

      {/* Active pass */}
      {activePass && (
        <Link
          href="/pass"
          className="flex items-center gap-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 p-4"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-400/20 text-emerald-300">
            <Ticket size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold">Active Play Pass · {activePass.game?.name}</p>
            <p className="text-xs text-white/60">
              <PassCountdown initialSeconds={activePass.expiresInSeconds} status={activePass.status} /> · tap to view QR
            </p>
          </div>
          <ArrowRight className="text-emerald-300" size={18} />
        </Link>
      )}

      {loading ? (
        <Loading />
      ) : (
        <>
          {/* Featured */}
          {featured.length > 0 && (
            <section>
              <SectionTitle>Featured</SectionTitle>
              <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
                {featured.map((g) => (
                  <GameCard key={g.id} game={g} compact />
                ))}
              </div>
            </section>
          )}

          {/* Ways to earn */}
          {rewards.length > 0 && (
            <section>
              <SectionTitle>Ways to earn rewards</SectionTitle>
              <div className="grid grid-cols-2 gap-2">
                {rewards.map((r) => (
                  <div key={r.id} className="card p-3">
                    <div className="flex items-center gap-2">
                      <Trophy size={15} className="text-[#ffc800]" />
                      <p className="text-sm font-semibold">{r.name}</p>
                    </div>
                    <p className="mt-1 text-xs text-white/50">{r.description}</p>
                    <p className="mt-1.5 text-sm font-bold text-emerald-300">+{r.points} pts</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Catalogue */}
          <section id="catalogue" className="scroll-mt-20">
            <SectionTitle>Choose a physical game</SectionTitle>
            <p className="-mt-2 mb-3 text-xs text-white/45">
              Real activities on the arcade floor. Pay with points, get a Play Pass, scan at the
              station.
            </p>
            <div className="grid grid-cols-2 gap-3">
              {games.map((g) => (
                <GameCard key={g.id} game={g} />
              ))}
            </div>
          </section>

          {/* Recent activity */}
          {recent.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <SectionTitle className="mb-0">Recent activity</SectionTitle>
                <Link href="/activity" className="inline-flex items-center text-xs text-white/50 hover:text-white">
                  See all <ChevronRight size={14} />
                </Link>
              </div>
              <div className="card divide-y divide-white/5">
                {recent.map((t) => (
                  <div key={t.id} className="flex items-center justify-between px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm">{t.reason}</p>
                      <p className="text-xs text-white/40">{timeAgo(t.createdAt)}</p>
                    </div>
                    <span className={`text-sm font-bold ${t.amount >= 0 ? "text-emerald-300" : "text-white/70"}`}>
                      {t.amount >= 0 ? "+" : ""}
                      {t.amount}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function SectionTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <h2 className={`mb-3 text-lg font-bold ${className}`}>{children}</h2>;
}
