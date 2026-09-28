"use client";

import { useState } from "react";
import { CaretLeft, CaretRight } from "@phosphor-icons/react";

// Today / All time / Custom period selector. Custom opens a calendar where one
// or several individual days can be picked (aggregated by the backend).
type Props = {
  period: string; // "today" | "all" | "custom"
  days: string[]; // YYYY-MM-DD, when custom
  onChange: (period: string, days: string[]) => void;
};

const fmt = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const WD = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export function PeriodPicker({ period, days, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const now = new Date();
  const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const todayStr = fmt(now.getFullYear(), now.getMonth(), now.getDate());
  const first = new Date(view.y, view.m, 1).getDay();
  const count = new Date(view.y, view.m + 1, 0).getDate();

  function toggle(ds: string) {
    onChange("custom", days.includes(ds) ? days.filter((d) => d !== ds) : [...days, ds].sort());
  }
  const btn = (on: boolean) =>
    `rounded-lg border border-b-[3px] px-3 py-1.5 text-sm font-semibold transition ${on ? "border-[#2170ed] bg-[#5a95f2] text-[#ffffff]" : "border-[#e3f3fd] bg-white text-[#0d47a1] hover:bg-[#f4f8fd]"}`;

  return (
    <div className="no-print relative flex flex-wrap items-center gap-1.5">
      <button onClick={() => { onChange("today", []); setOpen(false); }} className={btn(period === "today")}>Today</button>
      <button onClick={() => { onChange("all", []); setOpen(false); }} className={btn(period === "all")}>All time</button>
      <button onClick={() => setOpen((o) => !o)} className={btn(period === "custom")}>
        {period === "custom" && days.length ? `${days.length} day${days.length > 1 ? "s" : ""}` : "Custom"}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-40 mt-2 w-72 rounded-2xl border border-b-[3px] border-[#e3f3fd] bg-white p-3 text-[#0d47a1]">
            <div className="mb-2 flex items-center justify-between">
              <button onClick={() => setView((v) => ({ y: v.m === 0 ? v.y - 1 : v.y, m: v.m === 0 ? 11 : v.m - 1 }))} className="rounded-lg p-1 hover:bg-[#f4f8fd]"><CaretLeft size={18} /></button>
              <span className="text-sm font-bold">{MONTHS[view.m]} {view.y}</span>
              <button onClick={() => setView((v) => ({ y: v.m === 11 ? v.y + 1 : v.y, m: v.m === 11 ? 0 : v.m + 1 }))} className="rounded-lg p-1 hover:bg-[#f4f8fd]"><CaretRight size={18} /></button>
            </div>
            <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-[#0d47a1]/45">
              {WD.map((d, i) => <span key={i}>{d}</span>)}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {Array.from({ length: first }).map((_, i) => <span key={`e${i}`} />)}
              {Array.from({ length: count }).map((_, i) => {
                const d = i + 1;
                const ds = fmt(view.y, view.m, d);
                const sel = days.includes(ds);
                const future = ds > todayStr;
                return (
                  <button key={ds} disabled={future} onClick={() => toggle(ds)}
                    className={`h-8 rounded-lg text-sm ${future ? "text-[#0d47a1]/20" : sel ? "bg-[#5a95f2] font-bold text-white" : "hover:bg-[#e3f3fd]"}`}>{d}</button>
                );
              })}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <button onClick={() => onChange("custom", [])} className="text-xs font-semibold text-[#0d47a1]/55 hover:text-[#0d47a1]">Clear</button>
              <button onClick={() => setOpen(false)} className="rounded-lg bg-[#5a95f2] px-3 py-1 text-xs font-bold text-white">Done</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
