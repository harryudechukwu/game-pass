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
  trends: { date: string; revenueKobo: number; revenueLabel: string; games: number; items: number; itemRevenueKobo: number; itemRevenueLabel: string; itemProfitKobo: number | null; itemProfitLabel: string | null; itemCoveragePct: number | null }[];
  hourlyRevenue: { hour: number; revenueKobo: number; revenueLabel: string }[];
  topGames: (NameRev & { plays: number })[];
  topItems: (NameRev & { qty: number })[];
  itemProfit: (NameRev & { id: string; qty: number; coveredRevenueKobo: number; costKobo: number; costLabel: string | null; profitKobo: number | null; profitLabel: string | null; coveragePct: number | null })[];
  itemFinancials: { itemRevenueKobo: number; itemRevenueLabel: string; coveredRevenueKobo: number; coveredRevenueLabel: string; costKobo: number; costLabel: string; grossProfitKobo: number; grossProfitLabel: string; marginPct: number | null; coveragePct: number | null; costedItemLines: number; itemLines: number };
  categorySplit: { kidsKobo: number; teenKobo: number; kidsLabel: string; teenLabel: string };
  typeSplit: { gamesKobo: number; itemsKobo: number; gamesLabel: string; itemsLabel: string };
  attendants: { name: string; orders: number; revenueKobo: number; revenueLabel: string }[];
  newCount: number;
  returningCount: number;
  topSpenders: NameRev[];
};

const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const fmtHour = (hour: number) => `${hour % 12 || 12} ${hour < 12 ? "AM" : "PM"}`;
const compactMoney = (kobo: number) => `₦${new Intl.NumberFormat("en-NG", { notation: "compact", maximumFractionDigits: 1 }).format(kobo / 100)}`;

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
  if (d.itemFinancials.costedItemLines > 0) lines.push(`Recorded item gross profit was ${d.itemFinancials.grossProfitLabel} on sales with known cost; those sales account for ${d.itemFinancials.coveragePct ?? 0}% of item revenue.`);
  else if (d.itemFinancials.itemLines > 0) lines.push("Item gross profit is unavailable because these sales have no recorded cost price.");
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

function RevenueTrend({ trends, hourlyRevenue, period }: { trends: Analytics["trends"]; hourlyRevenue: Analytics["hourlyRevenue"]; period: string }) {
  const isHourly = period === "today";
  const points = isHourly
    ? hourlyRevenue.map((h) => ({ key: String(h.hour), label: fmtHour(h.hour), revenueKobo: h.revenueKobo, revenueLabel: h.revenueLabel }))
    : trends.map((t) => ({ key: t.date, label: fmtDay(t.date), revenueKobo: t.revenueKobo, revenueLabel: t.revenueLabel }));
  const maxRevenue = points.reduce((max, p) => Math.max(max, p.revenueKobo), 0);
  if (maxRevenue === 0) return <div className="flex h-44 items-center justify-center text-sm text-[#7185a0]">No revenue in this period.</div>;

  const left = 65, right = 18, top = 30, bottom = 194, width = 600;
  const plotWidth = width - left - right;
  const plotHeight = bottom - top;
  const scaleMax = maxRevenue * 1.2;
  const slotWidth = plotWidth / points.length;
  const barWidth = Math.min(44, slotWidth * 0.55);
  const bars = points.map((point, i) => ({
    ...point,
    x: left + slotWidth * (i + 0.5),
    y: bottom - (point.revenueKobo / scaleMax) * plotHeight,
  }));
  const peakIndex = points.findIndex((p) => p.revenueKobo === maxRevenue);
  const tickCount = Math.min(5, bars.length);
  const labelTicks = new Set(isHourly ? [0, 6, 12, 18, 23] : Array.from({ length: tickCount }, (_, i) => Math.round((i * (bars.length - 1)) / Math.max(1, tickCount - 1))));

  return (
    <svg viewBox="0 0 600 235" className="block w-full" role="img" aria-label={isHourly ? "Hourly revenue for today" : `Daily revenue trend from ${trends[0].date} to ${trends[trends.length - 1].date}`}>
      <defs>
        <linearGradient id="revenue-bar-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4288f2" />
          <stop offset="100%" stopColor="#73a8f6" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((fraction) => {
        const y = bottom - (fraction * maxRevenue / scaleMax) * plotHeight;
        return (
          <g key={fraction}>
            <line x1={left} x2={width - right} y1={y} y2={y} stroke="#d8e6f8" strokeDasharray={fraction === 0 ? undefined : "4 6"} />
            <text x={left - 9} y={y + 4} textAnchor="end" fill="#7185a0" fontSize="14">{compactMoney(fraction * maxRevenue)}</text>
          </g>
        );
      })}
      {bars.map((bar, i) => (
        <g key={bar.key}>
          <title>{`${bar.label} · ${bar.revenueLabel}`}</title>
          {bar.revenueKobo > 0 && <rect x={bar.x - barWidth / 2} y={bar.y} width={barWidth} height={bottom - bar.y} rx={Math.min(7, barWidth / 2)} fill="url(#revenue-bar-fill)" />}
          {(bars.length <= 6 || (isHourly && i === peakIndex)) && <text x={bar.x} y={bar.revenueKobo > 0 ? bar.y - 10 : bottom - 10} textAnchor="middle" fill="#174b97" fontSize="15" fontWeight="700">{compactMoney(bar.revenueKobo)}</text>}
          {labelTicks.has(i) && <text x={bar.x} y="222" textAnchor="middle" fill="#7185a0" fontSize="14">{bar.label}</text>}
        </g>
      ))}
    </svg>
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
              <h2 className="font-bold">{data.period === "today" ? "Revenue by hour" : "Revenue trend"}</h2>
              <span className="text-sm text-white/50">Total <b className="text-[#0d47a1]">{data.totalRevenueLabel}</b></span>
            </div>
            <RevenueTrend trends={data.trends} hourlyRevenue={data.hourlyRevenue} period={data.period} />
          </div>

          <div className="card p-5">
            <h2 className="mb-1 font-bold">Item gross profit</h2>
            <p className="mb-4 text-sm text-white/50">Selling revenue minus the cost saved on each item sale. Game revenue and other business expenses are not included.</p>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-xl border border-[#e3f3fd] p-3"><p className="text-xl font-black">{data.itemFinancials.itemRevenueLabel}</p><p className="text-xs text-white/50">All item revenue</p></div>
              <div className="rounded-xl border border-[#e3f3fd] p-3"><p className="text-xl font-black">{data.itemFinancials.costedItemLines ? data.itemFinancials.coveredRevenueLabel : "—"}</p><p className="text-xs text-white/50">Revenue with known cost</p></div>
              <div className="rounded-xl border border-[#e3f3fd] p-3"><p className="text-xl font-black">{data.itemFinancials.costedItemLines ? data.itemFinancials.costLabel : "—"}</p><p className="text-xs text-white/50">Cost of goods sold</p></div>
              <div className="rounded-xl border border-[#e3f3fd] p-3"><p className="text-xl font-black">{data.itemFinancials.costedItemLines ? data.itemFinancials.grossProfitLabel : "—"}</p><p className="text-xs text-white/50">Gross profit · {data.itemFinancials.marginPct == null ? "margin unavailable" : `${data.itemFinancials.marginPct}% margin`}</p></div>
            </div>
            <p className="mt-3 text-sm text-white/55">
              {data.itemFinancials.itemLines === 0 ? "No item sales in this period." : `${data.itemFinancials.costedItemLines} of ${data.itemFinancials.itemLines} item sale lines have a saved cost (${data.itemFinancials.coveragePct ?? 0}% of item revenue). Profit and margin cover only those lines.`}
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card overflow-x-auto p-5">
              <h2 className="mb-3 font-bold">Gross profit by item</h2>
              <p className="mb-3 text-xs text-white/50">Revenue includes every sale; cost and profit use only sales with a saved cost.</p>
              {data.itemProfit.length === 0 ? <p className="text-sm text-white/40">No item sales in this period.</p> : (
                <table className="w-full min-w-[560px] text-left text-sm">
                  <thead className="text-xs text-white/50"><tr><th className="pb-2 pr-3">Item</th><th className="pb-2 pr-3 text-right">Units</th><th className="pb-2 pr-3 text-right">Revenue</th><th className="pb-2 pr-3 text-right">Cost</th><th className="pb-2 text-right">Gross profit</th></tr></thead>
                  <tbody className="divide-y divide-[#e3f3fd]">{data.itemProfit.map((it) => (
                    <tr key={it.id}><td className="py-2 pr-3 font-medium">{it.name}<span className="block text-xs font-normal text-white/45">{it.coveragePct == null ? "Cost coverage unavailable" : `${it.coveragePct}% revenue costed`}</span></td><td className="py-2 pr-3 text-right">{it.qty}</td><td className="py-2 pr-3 text-right">{it.revenueLabel}</td><td className="py-2 pr-3 text-right">{it.costLabel ?? "—"}</td><td className="py-2 text-right font-bold">{it.profitLabel ?? "—"}</td></tr>
                  ))}</tbody>
                </table>
              )}
            </div>
            <div className="card overflow-x-auto p-5">
              <h2 className="mb-3 font-bold">Daily item revenue and profit</h2>
              {data.trends.every((t) => t.items === 0) ? <p className="text-sm text-white/40">No item sales in this period.</p> : (
                <table className="w-full min-w-[380px] text-left text-sm">
                  <thead className="text-xs text-white/50"><tr><th className="pb-2 pr-3">Day</th><th className="pb-2 pr-3 text-right">Revenue</th><th className="pb-2 text-right">Gross profit</th></tr></thead>
                  <tbody className="divide-y divide-[#e3f3fd]">{data.trends.filter((t) => t.items > 0).map((t) => (
                    <tr key={t.date}><td className="py-2 pr-3">{t.date}<span className="block text-xs text-white/45">{t.itemCoveragePct == null ? "Cost coverage unavailable" : `${t.itemCoveragePct}% revenue costed`}</span></td><td className="py-2 pr-3 text-right">{t.itemRevenueLabel}</td><td className="py-2 text-right font-bold">{t.itemProfitLabel ?? "—"}</td></tr>
                  ))}</tbody>
                </table>
              )}
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
