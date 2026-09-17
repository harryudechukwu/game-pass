"use client";

import { useEffect, useState } from "react";
import { Users, Gamepad2, Activity, Gift, Banknote, ShoppingBag, Timer } from "lucide-react";
import { api } from "@/lib/client";
import { Loading } from "@/components/ui";

type Stats = {
  totalPlayers: number;
  revenueTodayLabel: string;
  revenueTotalLabel: string;
  gamesLoggedToday: number;
  itemsSoldToday: number;
  activeSessions: number;
  rewardsRedeemedTotal: number;
  popularGames: { gameId: string; name: string; plays: number }[];
  headsUpSeconds: number;
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [headsUp, setHeadsUp] = useState(60);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    api<Stats>("/api/admin/stats").then((s) => { setStats(s); setHeadsUp(s.headsUpSeconds); }).finally(() => setLoading(false));
  }, []);

  async function saveHeadsUp() {
    await api("/api/admin/settings", { method: "PATCH", body: { headsUpSeconds: Number(headsUp) } });
    setSavedMsg("Saved");
    setTimeout(() => setSavedMsg(""), 1500);
  }

  if (loading || !stats) return <Loading />;

  const cards = [
    { label: "Revenue today", value: stats.revenueTodayLabel, icon: Banknote, tone: "emerald" },
    { label: "Revenue all time", value: stats.revenueTotalLabel, icon: Banknote, tone: "emerald" },
    { label: "Total players", value: String(stats.totalPlayers), icon: Users, tone: "indigo" },
    { label: "Games today", value: String(stats.gamesLoggedToday), icon: Gamepad2, tone: "violet" },
    { label: "Items sold today", value: String(stats.itemsSoldToday), icon: ShoppingBag, tone: "cyan" },
    { label: "Active game sessions", value: String(stats.activeSessions), icon: Activity, tone: "violet" },
    { label: "Rewards redeemed", value: String(stats.rewardsRedeemedTotal), icon: Gift, tone: "amber" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Dashboard</h1>
        <p className="text-sm text-white/50">Rewards unlock by amount spent. Daily figures reset at midnight.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <div className={`mb-3 inline-flex h-9 w-9 items-center justify-center rounded-lg ${toneBg(c.tone)}`}><c.icon size={18} /></div>
            <p className="text-2xl font-black">{c.value}</p>
            <p className="text-xs text-white/45">{c.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="card p-5 lg:col-span-2">
          <h2 className="mb-4 font-bold">Most played games</h2>
          {stats.popularGames.length === 0 ? (
            <p className="text-sm text-white/40">No games logged yet.</p>
          ) : (
            <div className="space-y-3">
              {stats.popularGames.map((g, i) => {
                const max = stats.popularGames[0].plays || 1;
                return (
                  <div key={g.gameId} className="flex items-center gap-3">
                    <span className="w-5 text-sm font-bold text-white/40">{i + 1}</span>
                    <span className="w-40 shrink-0 truncate text-sm font-medium">{g.name}</span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-white/5"><div className="h-full rounded-full bg-gradient-to-r from-[#2f6bff] to-[#1cb0f6]" style={{ width: `${(g.plays / max) * 100}%` }} /></div>
                    <span className="w-10 text-right text-sm font-bold">{g.plays}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="card p-5">
          <h2 className="mb-1 flex items-center gap-2 font-bold"><Timer size={16} className="text-amber-300" /> Heads-up timer</h2>
          <p className="mb-3 text-xs text-white/45">Seconds a player gets to walk to the game before the play timer starts.</p>
          <div className="flex items-center gap-2">
            <input type="number" min={0} max={600} className="input" value={headsUp} onChange={(e) => setHeadsUp(Number(e.target.value))} />
            <button className="btn-primary shrink-0" onClick={saveHeadsUp}>Save</button>
          </div>
          {savedMsg && <p className="mt-2 text-xs text-emerald-300">{savedMsg}</p>}
          <div className="mt-3 flex gap-2">
            {[30, 60, 90].map((n) => (
              <button key={n} onClick={() => setHeadsUp(n)} className="rounded-lg bg-white/5 px-3 py-1.5 text-xs hover:bg-white/10">{n}s</button>
            ))}
          </div>
        </div>
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
  };
  return map[tone] ?? "bg-white/10 text-white";
}
