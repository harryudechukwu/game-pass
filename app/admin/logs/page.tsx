"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/client";
import { timeAgo, clockTime } from "@/lib/format";
import { Loading } from "@/components/ui";

type Log = {
  id: string;
  loggedAt: string;
  game: { name: string } | null;
  player: { id?: string; firstName: string | null; phone: string };
  attendantId: string | null;
};

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ logs: Log[] }>("/api/admin/logs").then((r) => setLogs(r.logs)).finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Game logs</h1>
        <p className="text-sm text-white/50">Every game an attendant has logged, newest first.</p>
      </div>

      {loading ? (
        <Loading />
      ) : logs.length === 0 ? (
        <div className="card p-8 text-center text-white/40">Nothing logged yet.</div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs uppercase tracking-wide text-white/40">
                <th className="px-4 py-3 font-medium">Game</th>
                <th className="px-4 py-3 font-medium">Player</th>
                <th className="px-4 py-3 font-medium">Phone</th>
                <th className="px-4 py-3 font-medium">When</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 font-medium">{l.game?.name ?? "—"}</td>
                  <td className="px-4 py-3 text-white/70">{l.player.firstName ?? "—"}</td>
                  <td className="px-4 py-3 text-white/50">{l.player.phone}</td>
                  <td className="px-4 py-3 text-white/50" title={clockTime(l.loggedAt)}>{timeAgo(l.loggedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
