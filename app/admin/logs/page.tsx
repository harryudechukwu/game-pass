"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import { api } from "@/lib/client";
import { timeAgo, clockTime } from "@/lib/format";
import { Loading } from "@/components/ui";
import { CatalogTile } from "@/components/CatalogIcon";

type Log = {
  id: string;
  kind: "game" | "item";
  name: string;
  icon: string;
  amountLabel: string;
  quantity: number;
  createdAt: string;
  player: { firstName: string | null; phone: string };
};

const FILTERS = ["all", "game", "item"] as const;

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (f: string) => {
    const r = await api<{ logs: Log[] }>(`/api/admin/logs${f !== "all" ? `?kind=${f}` : ""}`);
    setLogs(r.logs);
  }, []);

  useEffect(() => { setLoading(true); load(filter).finally(() => setLoading(false)); }, [filter, load]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Purchase logs</h1>
        <p className="text-sm text-white/50">Everything attendants have logged, newest first.</p>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={clsx("rounded-lg px-3 py-1.5 text-sm capitalize", filter === f ? "bg-gradient-to-r from-[#58cc02] to-[#1cb0f6] font-semibold text-black" : "bg-white/5 text-white/60 hover:bg-white/10")}>
            {f === "all" ? "All" : `${f}s`}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : logs.length === 0 ? (
        <div className="card p-8 text-center text-white/40">Nothing logged in this view.</div>
      ) : (
        <div className="card divide-y divide-white/5">
          {logs.map((l) => (
            <div key={l.id} className="flex items-center gap-3 px-4 py-3">
              <CatalogTile name={l.icon} accent={l.kind === "item" ? "item" : "muted"} className="h-10 w-10" size={20} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{l.name}{l.kind === "item" && l.quantity > 1 ? ` ×${l.quantity}` : l.kind === "game" ? ` · ${l.quantity}h` : ""}</p>
                <p className="text-xs text-white/45">{l.player.firstName ?? "—"} · {l.player.phone}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-white/80">{l.amountLabel}</p>
                <p className="text-[11px] text-white/40" title={clockTime(l.createdAt)}>{timeAgo(l.createdAt)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
