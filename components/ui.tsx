"use client";

import { clsx } from "clsx";

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={clsx("animate-spin", className)}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="4" />
      <path d="M22 12a10 10 0 0 1-10 10" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-white/50">
      <Spinner /> <span className="text-sm">{label}</span>
    </div>
  );
}

const statusStyles: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-300",
  available: "bg-emerald-500/15 text-emerald-300",
  maintenance: "bg-amber-500/15 text-amber-300",
  inactive: "bg-white/10 text-white/50",
  created: "bg-indigo-500/15 text-indigo-300",
  activated: "bg-cyan-500/15 text-cyan-300",
  authorized: "bg-cyan-500/15 text-cyan-300",
  in_progress: "bg-violet-500/15 text-violet-300",
  completed: "bg-emerald-500/15 text-emerald-300",
  cancelled: "bg-red-500/15 text-red-300",
  expired: "bg-white/10 text-white/40",
  pending: "bg-amber-500/15 text-amber-300",
  success: "bg-emerald-500/15 text-emerald-300",
  failed: "bg-red-500/15 text-red-300",
};

export function StatusPill({ status }: { status: string }) {
  const cls = statusStyles[status] ?? "bg-white/10 text-white/60";
  return <span className={clsx("pill", cls)}>{status.replace(/_/g, " ")}</span>;
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      {message}
    </div>
  );
}
