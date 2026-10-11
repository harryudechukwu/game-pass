"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Timer, SpeakerHigh, ClockCounterClockwise } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { hms } from "@/lib/format";

type Session = {
  id: string;
  game: string;
  quantity: number;
  name: string | null;
  phone: string;
  headsUpEndsAt: number | null;
  mainEndsAt: number | null;
};

// The time-keeping view: a live countdown per active game session with a chime
// when one runs out. Kept mounted even when hidden so tracking + the chime keep
// working while the attendant is on another tab.
export function TimeKeeper({ visible, onActiveCount }: { visible: boolean; onActiveCount?: (n: number) => void }) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const audioRef = useRef<AudioContext | null>(null);
  const alertedRef = useRef<Set<string>>(new Set());

  // A short four-pulse chime via the Web Audio API — no asset file needed.
  const beep = useCallback(() => {
    try {
      if (!audioRef.current) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        audioRef.current = new AC();
      }
      const ctx = audioRef.current;
      if (ctx.state === "suspended") void ctx.resume();
      let t = ctx.currentTime + 0.03;
      for (let i = 0; i < 4; i++) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, t);
        gain.gain.exponentialRampToValueAtTime(0.45, t + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        osc.connect(gain).connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.32);
        t += 0.34;
      }
    } catch {
      /* audio unavailable — the on-screen state still updates */
    }
  }, []);

  // Browsers only allow audio after a user gesture, so prime the context on the
  // attendant's first tap/keypress.
  useEffect(() => {
    const prime = () => {
      if (!audioRef.current) {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (AC) audioRef.current = new AC();
      }
      if (audioRef.current?.state === "suspended") void audioRef.current.resume();
    };
    window.addEventListener("pointerdown", prime, { once: true });
    window.addEventListener("keydown", prime, { once: true });
    return () => { window.removeEventListener("pointerdown", prime); window.removeEventListener("keydown", prime); };
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await api<{ sessions: Session[] }>("/api/attendant/sessions");
      // A session that already elapsed before we started watching shouldn't chime.
      const t = Date.now();
      for (const s of data.sessions) {
        if (s.mainEndsAt != null && t >= s.mainEndsAt && !alertedRef.current.has(s.id)) alertedRef.current.add(s.id);
      }
      setSessions(data.sessions);
      setLoaded(true);
    } catch {
      /* ignore transient errors; next poll retries */
    }
  }, []);

  // Poll for new/removed sessions.
  useEffect(() => {
    void load();
    const iv = setInterval(() => void load(), 20000);
    return () => clearInterval(iv);
  }, [load]);

  // Tick every second: refresh countdowns and chime once as each session elapses.
  useEffect(() => {
    if (sessions.length === 0) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      for (const s of sessions) {
        if (s.mainEndsAt != null && t >= s.mainEndsAt && !alertedRef.current.has(s.id)) {
          alertedRef.current.add(s.id);
          beep();
        }
      }
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [sessions, beep]);

  const activeCount = sessions.filter((s) => s.mainEndsAt != null && s.mainEndsAt > now).length;
  useEffect(() => { onActiveCount?.(activeCount); }, [activeCount, onActiveCount]);

  if (!visible) return null;

  return (
    <div className="card p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-bold"><Timer size={20} weight="duotone" /> Time keeping</h2>
        <button onClick={beep} className="inline-flex items-center gap-1.5 rounded-lg border border-b-[3px] border-[#dfe3e9] bg-white px-3 py-1.5 text-sm font-semibold text-[#0d47a1]"><SpeakerHigh size={16} /> Test sound</button>
      </div>
      {!loaded ? (
        <p className="py-10 text-center text-sm text-white/40">Loading timers…</p>
      ) : sessions.length === 0 ? (
        <div className="py-12 text-center">
          <ClockCounterClockwise size={36} weight="duotone" className="mx-auto mb-2 text-[#0d47a1]/40" />
          <p className="text-sm text-white/50">No game timers running.</p>
          <p className="mt-1 text-xs text-white/40">Log a game and its timer shows up here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => {
            const untilClose = s.headsUpEndsAt == null; // unlimited game — runs to store close
            const remaining = s.mainEndsAt != null ? Math.max(0, Math.round((s.mainEndsAt - now) / 1000)) : 0;
            const elapsed = s.mainEndsAt != null && now >= s.mainEndsAt;
            const headsUp = s.headsUpEndsAt != null && now < s.headsUpEndsAt;
            const soon = !elapsed && !headsUp && remaining <= 120;
            return (
              <div key={s.id} className={`flex items-center justify-between gap-3 rounded-2xl border border-b-[3px] p-4 ${elapsed ? "border-red-300 bg-red-50" : soon ? "border-amber-300 bg-amber-50" : "border-[#dfe3e9] bg-white"}`}>
                <div className="min-w-0">
                  <p className="truncate font-bold">{s.game}{s.quantity > 1 ? ` ×${s.quantity}` : ""}</p>
                  <p className="truncate text-sm text-white/50">{s.name ?? s.phone}{untilClose ? " · until close" : ""}</p>
                </div>
                <div className="shrink-0 text-right">
                  {elapsed ? (
                    <span className="inline-flex items-center rounded-lg bg-red-500 px-3 py-1.5 text-sm font-bold text-white">Time&apos;s up</span>
                  ) : headsUp ? (
                    <span className="text-sm font-semibold text-amber-700">Starting…</span>
                  ) : (
                    <span className={`font-mono text-2xl font-black tabular-nums ${soon ? "text-amber-700" : "text-[#0d47a1]"}`}>{hms(remaining)}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
