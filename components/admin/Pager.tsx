"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";

// Prev / Next pager for operator lists — keeps pages short (no long scrolling).
export function Pager({ page, pages, onPage }: { page: number; pages: number; onPage: (p: number) => void }) {
  if (pages <= 1) return null;
  const btn = "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-b-[3px] border-[#e3f3fd] bg-white text-[#0d47a1] disabled:opacity-40";
  return (
    <div className="flex items-center justify-center gap-3 pt-3">
      <button className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous"><CaretLeft size={16} /></button>
      <span className="text-sm font-semibold text-[#0d47a1]">Page {page} of {pages}</span>
      <button className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next"><CaretRight size={16} /></button>
    </div>
  );
}
