"use client";

import { useEffect, useState } from "react";
import { DownloadSimple } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Loading } from "@/components/ui";
import { PeriodPicker } from "@/components/admin/PeriodPicker";

type NameRev = { name: string; revenueKobo: number; revenueLabel: string };
type Analytics = {
  period: string;
  days: string[];
  totalRevenueLabel: string;
  trends: { date: string; revenueKobo: number; revenueLabel: string; games: number; items: number }[];
  topGames: (NameRev & { plays: number })[];
  topItems: (NameRev & { qty: number })[];
  categorySplit: { kidsKobo: number; teenKobo: number; kidsLabel: string; teenLabel: string };
  typeSplit: { gamesKobo: number; itemsKobo: number; gamesLabel: string; itemsLabel: string };
  attendants: { name: string; orders: number; revenueKobo: number; revenueLabel: string }[];
  newCount: number;
  returningCount: number;
  topSpenders: NameRev[];
};

const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

// plain-English summary of the window, for the report/PDF
function buildSummary(d: Analytics, periodLabel: string): string[] {
  const games = d.trends.reduce((n, t) => n + t.games, 0);
  const items = d.trends.reduce((n, t) => n + t.items, 0);
  const busiest = [...d.trends].sort((a, b) => b.revenueKobo - a.revenueKobo)[0];
  const lines = [
    `Over ${periodLabel.toLowerCase()}, Creamy Castle took ${d.totalRevenueLabel} across ${games} game play${games === 1 ? "" : "s"} and ${items} item${items === 1 ? "" : "s"} sold.`,
    `Games brought in ${d.typeSplit.gamesLabel} and items ${d.typeSplit.itemsLabel}; kids games earned ${d.categorySplit.kidsLabel} versus ${d.categorySplit.teenLabel} from teen games.`,
  ];
  if (d.topGames[0]) lines.push(`The most popular game was ${d.topGames[0].name} with ${d.topGames[0].plays} play${d.topGames[0].plays === 1 ? "" : "s"} (${d.topGames[0].revenueLabel}).`);
  if (d.topItems[0]) lines.push(`The best-selling item was ${d.topItems[0].name} (${d.topItems[0].revenueLabel}).`);
  if (busiest && busiest.revenueKobo > 0) lines.push(`The busiest day was ${fmtDay(busiest.date)}, taking ${busiest.revenueLabel}.`);
  lines.push(`${d.newCount} new member${d.newCount === 1 ? "" : "s"} joined this window and ${d.returningCount} returned.`);
  if (d.topSpenders[0]) lines.push(`The top spender was ${d.topSpenders[0].name} (${d.topSpenders[0].revenueLabel}).`);
  return lines;
}

function RankBars({ rows, max }: { rows: { name: string; value: number; label: string; sub?: string }[]; max: number }) {
  if (rows.length === 0) return <p className="text-sm text-white/40">Nothing in this window.</p>;
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-sm font-medium sm:w-36">{r.name}{r.sub ? <span className="text-white/40"> · {r.sub}</span> : null}</span>
          <div className="gp-bar flex-1" style={{ marginTop: 0 }}><i style={{ width: `${max ? (r.value / max) * 100 : 0}%` }} /></div>
          <span className="w-20 shrink-0 text-right text-sm font-bold">{r.label}</span>
        </div>
      ))}
    </div>
  );
}

function SplitBar({ a, b }: { a: { label: string; value: number; money: string }; b: { label: string; value: number; money: string } }) {
  const total = a.value + b.value || 1;
  const aPct = (a.value / total) * 100;
  return (
    <>
      <div className="flex h-3.5 overflow-hidden rounded-full">
        <div style={{ width: `${aPct}%` }} className="bg-[#5a95f2]" />
        <div style={{ width: `${100 - aPct}%` }} className="bg-[#bbdefb]" />
      </div>
      <div className="mt-3 flex justify-between text-sm">
        <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#5a95f2] align-middle" />{a.label} <b>{a.money}</b></span>
        <span><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-full bg-[#bbdefb] align-middle" />{b.label} <b>{b.money}</b></span>
      </div>
    </>
  );
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("today");
  const [days, setDays] = useState<string[]>([]);

  useEffect(() => {
    setLoading(true);
    const qs = period === "custom" ? `custom&days=${days.join(",")}` : period;
    api<Analytics>(`/api/admin/analytics?period=${qs}`).then(setData).finally(() => setLoading(false));
  }, [period, days]);

  const periodLabel = period === "all" ? "All time" : period === "custom" ? (days.length === 1 ? days[0] : `${days.length} selected days`) : "Today";

  return (
    <div className="space-y-6">
      <div className="no-print admin-head flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Analytics</h1>
          <p className="text-sm text-white/50">Trends, best sellers, staff &amp; customers — {periodLabel.toLowerCase()}.</p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-1.5">
          <PeriodPicker period={period} days={days} onChange={(p, d) => { setPeriod(p); setDays(d); }} />
          <button onClick={() => window.print()} className="ml-1 inline-flex items-center gap-1.5 rounded-lg border border-b-[3px] border-[#2170ed] bg-[#5a95f2] px-3 py-1.5 text-sm font-semibold text-[#ffffff]"><DownloadSimple size={16} weight="duotone" /> Download PDF</button>
        </div>
      </div>

      {loading || !data ? (
        <Loading />
      ) : (
        <>
          <div className="print-only mb-2">
            <h2 className="text-xl font-black">Creamy Castle · Analytics report</h2>
            <p className="text-sm">{periodLabel} · generated {new Date().toLocaleString()}</p>
          </div>

          <div className="card p-5 print-only">
            <h2 className="mb-2 font-bold">Summary</h2>
            <div className="space-y-1.5 text-sm leading-relaxed text-white/70">
              {buildSummary(data, periodLabel).map((s, i) => <p key={i}>{s}</p>)}
            </div>
          </div>

          <div className="card p-5">
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="font-bold">Revenue trend</h2>
              <span className="text-sm text-white/50">Total <b className="text-[#0d47a1]">{data.totalRevenueLabel}</b></span>
            </div>
            {(() => {
              const max = Math.max(...data.trends.map((t) => t.revenueKobo), 1);
              return (
                <div className="flex h-44 items-end gap-1 overflow-x-auto">
                  {data.trends.map((t) => (
                    <div key={t.date} className="group flex min-w-[10px] flex-1 flex-col justify-end" title={`${fmtDay(t.date)} · ${t.revenueLabel}`}>
                      <div className="w-full rounded-t bg-[#5a95f2] transition group-hover:bg-[#0d47a1]" style={{ height: `${(t.revenueKobo / max) * 100}%`, minHeight: t.revenueKobo > 0 ? 3 : 0 }} />
                    </div>
                  ))}
                </div>
              );
            })()}
            <div className="mt-2 flex justify-between text-xs text-white/40">
              <span>{data.trends.length ? fmtDay(data.trends[0].date) : ""}</span>
              <span>{data.trends.length ? fmtDay(data.trends[data.trends.length - 1].date) : ""}</span>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="mb-4 font-bold">Top games</h2>
              <RankBars max={data.topGames[0]?.revenueKobo ?? 0} rows={data.topGames.map((g) => ({ name: g.name, value: g.revenueKobo, label: g.revenueLabel, sub: `${g.plays} plays` }))} />
            </div>
            <div className="card p-5">
              <h2 className="mb-4 font-bold">Top items</h2>
              <RankBars max={data.topItems[0]?.revenueKobo ?? 0} rows={data.topItems.map((it) => ({ name: it.name, value: it.revenueKobo, label: it.revenueLabel, sub: `×${it.qty}` }))} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="mb-3 font-bold">Games vs items</h2>
              <SplitBar a={{ label: "Games", value: data.typeSplit.gamesKobo, money: data.typeSplit.gamesLabel }} b={{ label: "Items", value: data.typeSplit.itemsKobo, money: data.typeSplit.itemsLabel }} />
            </div>
            <div className="card p-5">
              <h2 className="mb-3 font-bold">Kids vs teens (games)</h2>
              <SplitBar a={{ label: "Kids", value: data.categorySplit.kidsKobo, money: data.categorySplit.kidsLabel }} b={{ label: "Teens", value: data.categorySplit.teenKobo, money: data.categorySplit.teenLabel }} />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="mb-4 font-bold">Attendant performance</h2>
              <RankBars max={data.attendants[0]?.revenueKobo ?? 0} rows={data.attendants.map((a) => ({ name: a.name, value: a.revenueKobo, label: a.revenueLabel, sub: `${a.orders} orders` }))} />
            </div>
            <div className="card p-5">
              <h2 className="mb-4 font-bold">Customers</h2>
              <div className="mb-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-[#e3f3fd] border-b-[3px] p-3"><p className="text-2xl font-black">{data.newCount}</p><p className="text-xs text-white/45">New this window</p></div>
                <div className="rounded-xl border border-[#e3f3fd] border-b-[3px] p-3"><p className="text-2xl font-black">{data.returningCount}</p><p className="text-xs text-white/45">Returning</p></div>
              </div>
              <p className="mb-2 text-sm font-semibold text-white/50">Top spenders</p>
              <RankBars max={data.topSpenders[0]?.revenueKobo ?? 0} rows={data.topSpenders.map((s) => ({ name: s.name, value: s.revenueKobo, label: s.revenueLabel }))} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
