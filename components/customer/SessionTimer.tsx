"use client";

import { useEffect, useState } from "react";
import { Timer, Footprints, CheckCircle2 } from "lucide-react";
import { hms } from "@/lib/format";

// Two-phase countdown for a game session: a short heads-up (walk to the game),
// then the main play timer. Ticks every second; the parent re-polls to move a
// finished session into the history feed.
export function SessionTimer({
  headsUpEndsAt,
  mainEndsAt,
}: {
  headsUpEndsAt: string | null;
  mainEndsAt: string | null;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const now = Date.now();
  const hu = headsUpEndsAt ? new Date(headsUpEndsAt).getTime() : 0;
  const me = mainEndsAt ? new Date(mainEndsAt).getTime() : 0;

  if (now < hu) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-amber-300">
        <Footprints size={18} />
        <span className="text-sm font-semibold">Heads up — head over! Starts in</span>
        <span className="ml-auto font-mono text-lg font-black tabular-nums">{hms((hu - now) / 1000)}</span>
      </div>
    );
  }
  if (now < me) {
    const total = Math.max(1, me - hu);
    const pct = Math.max(0, Math.min(100, ((me - now) / total) * 100));
    return (
      <div className="rounded-xl border border-[#58cc02]/30 bg-[#58cc02]/10 px-3 py-2">
        <div className="flex items-center gap-2 text-[#58cc02]">
          <Timer size={18} />
          <span className="text-sm font-semibold">Playing now — time left</span>
          <span className="ml-auto font-mono text-lg font-black tabular-nums">{hms((me - now) / 1000)}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[#58cc02] transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-emerald-300">
      <CheckCircle2 size={18} />
      <span className="text-sm font-semibold">Session complete</span>
    </div>
  );
}
