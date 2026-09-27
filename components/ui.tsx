"use client";

import { useState } from "react";
import { clsx } from "clsx";
import { Eye, EyeSlash } from "@phosphor-icons/react";

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

// Skeleton loader — a shimmering placeholder used while a screen's data loads
// (replaces the old spinner). Generic header + card grid works for every
// operator page. `label` is kept for the a11y announcement only.
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="space-y-5" aria-busy="true" aria-label={label}>
      <div className="space-y-2">
        <div className="skel h-7 w-48" />
        <div className="skel h-4 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="card p-4">
            <div className="skel mb-3 h-10 w-10 rounded-xl" />
            <div className="skel h-6 w-20" />
            <div className="skel mt-2 h-3 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  return <span className="pill capitalize">{status.replace(/_/g, " ")}</span>;
}

// A sensitive value shown blurred until the admin clicks the eye to reveal it.
export function Reveal({ label, value }: { label: string; value: string }) {
  const [show, setShow] = useState(false);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-white/50">
      {label}:
      <span className={clsx("font-mono text-white/70 transition", !show && "select-none blur-[5px]")}>{value}</span>
      <button type="button" onClick={() => setShow((s) => !s)} className="text-white/40 hover:text-[#0d47a1]" aria-label={show ? "Hide" : "Reveal"}>
        {show ? <EyeSlash size={15} weight="duotone" /> : <Eye size={15} weight="duotone" />}
      </button>
    </span>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
      {message}
    </div>
  );
}
