"use client";

import { useEffect, useState } from "react";
import {
  Users,
  Gamepad2,
  Coins,
  ArrowDownCircle,
  Trophy,
  Banknote,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { api } from "@/lib/client";
import { pts, money } from "@/lib/format";
import { Loading } from "@/components/ui";

type Stats = {
  todaysVisitors: number;
  gamesPlayed: number;
  pointsSold: number;
  pointsRedeemed: number;
  rewardsIssued: number;
  rewardsCount: number;
  revenueKobo: number;
  activeSessions: number;
  failedOrExpiredPasses: number;
  popularGames: { gameId: string; name: string; plays: number }[];
  totalCustomers: number;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Stats>("/api/admin/stats").then(setStats).finally(() => setLoading(false));
  }, []);

  if (loading || !stats) return <Loading />;

  const cards = [
    { label: "Today's visitors", value: String(stats.todaysVisitors), icon: Users, tone: "indigo" },
    { label: "Games played", value: String(stats.gamesPlayed), icon: Gamepad2, tone: "violet" },
    { label: "Points sold", value: pts(stats.pointsSold), icon: Coins, tone: "amber" },
    { label: "Points redeemed", value: pts(stats.pointsRedeemed), icon: ArrowDownCircle, tone: "cyan" },
    { label: "Rewards issued", value: pts(stats.rewardsIssued), icon: Trophy, tone: "emerald" },
    { label: "Revenue (today)", value: money(stats.revenueKobo), icon: Banknote, tone: "emerald" },
    { label: "Active sessions", value: String(stats.activeSessions), icon: Activity, tone: "violet" },
    { label: "Failed / expired passes", value: String(stats.failedOrExpiredPasses), icon: AlertTriangle, tone: "red" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Dashboard</h1>
        <p className="text-sm text-white/50">{stats.totalCustomers} registered customers · figures reset daily</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${toneBg(c.tone)}`}>
              <c.icon size={18} />
            </div>
            <p className="text-2xl font-black">{c.value}</p>
            <p className="text-xs text-white/45">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="card p-5">
        <h2 className="mb-4 font-bold">Most popular games</h2>
        {stats.popularGames.length === 0 ? (
          <p className="text-sm text-white/40">No plays recorded yet.</p>
        ) : (
          <div className="space-y-3">
            {stats.popularGames.map((g, i) => {
              const max = stats.popularGames[0].plays || 1;
              return (
                <div key={g.gameId} className="flex items-center gap-3">
                  <span className="w-5 text-sm font-bold text-white/40">{i + 1}</span>
                  <span className="w-40 shrink-0 truncate text-sm font-medium">{g.name}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#58cc02] to-[#1cb0f6]"
                      style={{ width: `${(g.plays / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-sm font-bold">{g.plays}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function toneBg(tone: string) {
  const map: Record<string, string> = {
    indigo: "bg-indigo-500/15 text-indigo-300",
    violet: "bg-violet-500/15 text-violet-300",
    amber: "bg-amber-500/15 text-amber-300",
    cyan: "bg-cyan-500/15 text-cyan-300",
    emerald: "bg-emerald-500/15 text-emerald-300",
    red: "bg-red-500/15 text-red-300",
  };
  return map[tone] ?? "bg-white/10 text-white";
}
