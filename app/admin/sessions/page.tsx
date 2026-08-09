"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import { api } from "@/lib/client";
import { pts, timeAgo, clockTime } from "@/lib/format";
import { Loading, StatusPill } from "@/components/ui";

type Session = {
  id: string;
  status: string;
  pointsSpent: number;
  score: number | null;
  rewardPointsEarned: number;
  startTime: string | null;
  expectedEndTime: string | null;
  completionTime: string | null;
  createdAt: string;
  stationId: string | null;
  game?: { name: string };
  customer: { id: string; firstName: string | null };
};

const FILTERS = ["all", "authorized", "in_progress", "completed", "cancelled", "expired"];

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (f: string) => {
    const r = await api<{ sessions: Session[] }>(`/api/admin/sessions${f !== "all" ? `?status=${f}` : ""}`);
    setSessions(r.sessions);
  }, []);

  useEffect(() => {
    setLoading(true);
    load(filter).finally(() => setLoading(false));
  }, [filter, load]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Sessions</h1>
        <p className="text-sm text-white/50">Live and historical game sessions.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={clsx(
              "rounded-lg px-3 py-1.5 text-sm capitalize",
              filter === f ? "bg-gradient-to-r from-[#58cc02] to-[#1cb0f6] font-semibold text-black" : "bg-white/5 text-white/60 hover:bg-white/10",
            )}
          >
            {f.replace("_", " ")}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : sessions.length === 0 ? (
        <div className="card p-8 text-center text-white/40">No sessions in this view.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-white/40">
                <th className="px-4 py-3 font-medium">Game</th>
                <th className="px-4 py-3 font-medium">Player</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Score</th>
                <th className="px-4 py-3 font-medium">Reward</th>
                <th className="px-4 py-3 font-medium">Station</th>
                <th className="px-4 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 font-medium">{s.game?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-white/70">{s.customer.firstName ?? "guest"}</td>
                  <td className="px-4 py-3"><StatusPill status={s.status} /></td>
                  <td className="px-4 py-3">{s.score ?? "—"}</td>
                  <td className="px-4 py-3 text-emerald-300">{s.rewardPointsEarned ? `+${s.rewardPointsEarned}` : "—"}</td>
                  <td className="px-4 py-3 text-white/50">{s.stationId ?? "—"}</td>
                  <td className="px-4 py-3 text-white/50" title={clockTime(s.createdAt)}>{timeAgo(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
