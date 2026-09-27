"use client";

import { useEffect, useState } from "react";
import { Money, Users, GameController, ShoppingBag, Pulse, Gift, Timer } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Loading } from "@/components/ui";

type Stats = {
  period: string;
  totalPlayers: number;
  revenueLabel: string;
  gamesLogged: number;
  itemsSold: number;
  activeSessions: number;
  rewardsRedeemed: number;
  popularGames: { gameId: string; name: string; plays: number }[];
  headsUpSeconds: number;
};

const PERIODS = [
  { key: "today", label: "Today" },
  { key: "week", label: "7 days" },
  { key: "month", label: "30 days" },
  { key: "all", label: "All time" },
];

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("today");
  const [headsUp, setHeadsUp] = useState(60);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    setLoading(true);
    api<Stats>(`/api/admin/stats?period=${period}`).then((s) => { setStats(s); setHeadsUp(s.headsUpSeconds); }).finally(() => setLoading(false));
  }, [period]);

  async function saveHeadsUp() {
    await api("/api/admin/settings", { method: "PATCH", body: { headsUpSeconds: Number(headsUp) } });
    setSavedMsg("Saved");
    setTimeout(() => setSavedMsg(""), 1500);
  }

  const periodLabel = PERIODS.find((p) => p.key === period)?.label ?? "Today";
  const cards = stats
    ? [
        { label: `Revenue · ${periodLabel}`, value: stats.revenueLabel, icon: Money },
        { label: `Games · ${periodLabel}`, value: String(stats.gamesLogged), icon: GameController },
        { label: `Items · ${periodLabel}`, value: String(stats.itemsSold), icon: ShoppingBag },
        { label: `Rewards · ${periodLabel}`, value: String(stats.rewardsRedeemed), icon: Gift },
        { label: "Active sessions", value: String(stats.activeSessions), icon: Pulse },
        { label: "Total players", value: String(stats.totalPlayers), icon: Users },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="admin-head flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Dashboard</h1>
          <p className="text-sm text-white/50">Pick a window to analyse. "Active sessions" and "Total players" are live.</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map((p) => (
            <button key={p.key} onClick={() => setPeriod(p.key)} className={`rounded-lg border border-b-[3px] px-3 py-1.5 text-sm font-semibold transition ${period === p.key ? "border-[#2170ed] bg-[#5a95f2] text-[#ffffff]" : "border-[#e3f3fd] bg-white text-[#0d47a1] hover:bg-[#f4f8fd]"}`}>{p.label}</button>
          ))}
        </div>
      </div>

      {loading || !stats ? (
        <Loading />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {cards.map((c) => (
              <div key={c.label} className="card p-4">
                <c.icon size={30} weight="duotone" className="mb-3 text-[#0d47a1]" />
                <p className="text-2xl font-black">{c.value}</p>
                <p className="text-xs text-white/45">{c.label}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="card p-5 lg:col-span-2">
              <h2 className="mb-4 font-bold">Most played games · {periodLabel}</h2>
              {stats.popularGames.length === 0 ? (
                <p className="text-sm text-white/40">No games logged in this window.</p>
              ) : (
                <div className="space-y-3">
                  {stats.popularGames.map((g, i) => {
                    const max = stats.popularGames[0].plays || 1;
                    return (
                      <div key={g.gameId} className="flex items-center gap-3">
                        <span className="w-5 text-sm font-bold text-white/40">{i + 1}</span>
                        <span className="w-40 shrink-0 truncate text-sm font-medium">{g.name}</span>
                        <div className="gp-bar flex-1" style={{ marginTop: 0 }}><i style={{ width: `${(g.plays / max) * 100}%` }} /></div>
                        <span className="w-10 text-right text-sm font-bold">{g.plays}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="card p-5">
              <h2 className="mb-1 flex items-center gap-2 font-bold"><Timer size={18} weight="duotone" className="text-[#0d47a1]" /> Heads-up timer</h2>
              <p className="mb-3 text-xs text-white/45">Seconds a player gets to walk to the game before the play timer starts.</p>
              <div className="flex items-center gap-2">
                <input type="number" min={0} max={600} className="input" value={headsUp} onChange={(e) => setHeadsUp(Number(e.target.value))} />
                <button className="btn-primary shrink-0" onClick={saveHeadsUp}>Save</button>
              </div>
              {savedMsg && <p className="mt-2 text-xs font-semibold text-[#0d47a1]">{savedMsg}</p>}
              <div className="mt-3 flex gap-2">
                {[30, 60, 90].map((n) => (
                  <button key={n} onClick={() => setHeadsUp(n)} className="rounded-lg border border-[#e3f3fd] bg-white px-3 py-1.5 text-xs font-semibold text-[#0d47a1] hover:bg-[#e3f3fd]">{n}s</button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
