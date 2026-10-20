"use client";

import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import { api } from "@/lib/client";
import { saleTimeLabel, timeAgo, clockTime } from "@/lib/format";
import { Loading } from "@/components/ui";
import { Pager } from "@/components/admin/Pager";

type Log = {
  id: string;
  kind: "game" | "item";
  name: string;
  icon: string;
  amountLabel: string;
  quantity: number;
  createdAt: string;
  player: { firstName: string | null; phone: string } | null;
  attendant: string;
  entrySource: "manual" | null;
  recordedAt: string | null;
  recordedByName: string | null;
  entryNote: string | null;
  occurredDate: string | null;
  occurredTime: string | null;
  entryTimezone: string | null;
  walkIn: boolean;
  edited: boolean;
  editedAt: string | null;
  editedByName: string | null;
  originalQuantity: number | null;
  originalAmountLabel: string | null;
  voided: boolean;
  voidedAt: string | null;
  voidedByName: string | null;
};

const FILTERS = ["all", "game", "item"] as const;

export default function AdminLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);

  const load = useCallback(async (f: string, p: number) => {
    const params = new URLSearchParams({ page: String(p) });
    if (f !== "all") params.set("kind", f);
    const r = await api<{ logs: Log[]; pages: number }>(`/api/admin/logs?${params}`);
    setLogs(r.logs); setPages(r.pages);
  }, []);

  useEffect(() => { setLoading(true); load(filter, page).finally(() => setLoading(false)); }, [filter, page, load]);

  return (
    <div className="space-y-5">
      <div className="admin-head">
        <h1 className="text-2xl font-black tracking-tight">Purchase logs</h1>
        <p className="text-sm text-white/50">Attendant sales, manual entries, corrections and voids, ordered by sale date.</p>
      </div>

      <div className="flex gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => { setFilter(f); setPage(1); }} className={clsx("rounded-lg px-3 py-1.5 text-sm capitalize", filter === f ? "bg-[#5a95f2] font-semibold text-[#ffffff]" : "bg-white/5 text-white/60 hover:bg-white/10")}>
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
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className={`min-w-0 truncate font-medium ${l.voided ? "text-white/45 line-through" : ""}`}>{l.name}{l.kind === "item" && l.quantity > 1 ? ` ×${l.quantity}` : l.kind === "game" ? ` · ${l.quantity}h` : ""}</p>
                  {l.edited && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">Corrected</span>}
                  {l.voided && <span className="rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-bold text-red-700">Voided</span>}
                </div>
                <p className="text-xs text-white/45">{l.player ? `${l.player.firstName ?? "—"} · ${l.player.phone}` : "Walk-in guest · no phone"}</p>
                {l.edited && <p className="mt-1 text-xs text-amber-800">Quantity corrected from {l.originalQuantity ?? "—"} to {l.quantity}{l.originalAmountLabel ? ` · original total ${l.originalAmountLabel}` : ""}{l.editedByName ? ` · by ${l.editedByName}` : ""}{l.editedAt ? ` · ${timeAgo(l.editedAt)}` : ""}</p>}
                {l.voided && <p className="mt-1 text-xs text-red-700">Voided{l.voidedByName ? ` by ${l.voidedByName}` : ""}{l.voidedAt ? ` · ${timeAgo(l.voidedAt)}` : ""} · excluded from revenue{l.walkIn ? "" : " and member spend"}</p>}
                {l.entrySource === "manual" && <p className="mt-1 text-xs font-semibold text-[#0d47a1]">Manual entry by {l.recordedByName ?? "operator"} · {l.occurredDate} {l.occurredTime ?? "time not recorded"} {l.entryTimezone}</p>}
                {l.entrySource === "manual" && l.entryNote && <p className="mt-0.5 text-xs text-white/50">{l.entryNote}</p>}
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-xs font-medium text-white/60">by {l.entrySource === "manual" ? l.recordedByName ?? "operator" : l.attendant}</p>
                <p className="text-[11px] text-white/40">{l.entrySource === "manual" ? "operator" : "attendant"}</p>
              </div>
              <div className="text-right">
                <p className={`font-bold ${l.voided ? "text-white/40 line-through" : "text-white/80"}`}>{l.amountLabel}</p>
                <p className="text-[11px] text-white/40" title={l.entrySource === "manual" && !l.occurredTime ? "Time not recorded" : clockTime(l.createdAt)}>{saleTimeLabel(l)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <Pager page={page} pages={pages} onPage={setPage} />
    </div>
  );
}
