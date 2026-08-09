"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ScanLine,
   CheckCircle2,
  Play,
  Flag,
  AlertTriangle,
  RotateCcw,
  Trophy,
  Home,
} from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { mmss } from "@/lib/format";
import { Spinner } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";

const STATION_ID = "STATION-01";
type Phase = "scan" | "review" | "authorized" | "running" | "done" | "fault";

type Lookup = {
  playPassId: string;
  status: string;
  customerFirstName: string | null;
  game: { id: string; name: string; status: string };
  pointCost: number;
  expiresInSeconds: number;
  sessionId: string | null;
  sessionStatus: string | null;
};
type SessionInfo = { id: string; expectedEndTime: string | null; durationSeconds?: number };
type Reward = { name: string; points: number };

export function StationConsole({ stationKey }: { stationKey: string }) {
  const params = useSearchParams();
  const [token, setToken] = useState("");
  const [phase, setPhase] = useState<Phase>("scan");
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [score, setScore] = useState<string>("");
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [rewardTotal, setRewardTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const idemRef = useRef<string>("");

  const headers = { "x-station-key": stationKey };

  const doLookup = useCallback(
    async (t: string) => {
      setError("");
      setBusy(true);
      try {
        const res = await api<Lookup>(`/api/station/lookup?token=${encodeURIComponent(t)}`, { headers });
        setLookup(res);
        setPhase("review");
      } catch (e) {
        setError(e instanceof ApiClientError ? e.message : "Lookup failed.");
      } finally {
        setBusy(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stationKey],
  );

  // Deep-link from the Play Pass screen: ?token=...
  useEffect(() => {
    const t = params.get("token");
    if (t) {
      setToken(t);
      doLookup(t);
    }
  }, [params, doLookup]);

  // Running-game countdown.
  useEffect(() => {
    if (phase !== "running" || !endsAt) return;
    const tick = () => setRemaining(Math.max(0, Math.round((endsAt - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [phase, endsAt]);

  async function activate() {
    if (!token) return;
    setBusy(true);
    setError("");
    idemRef.current = idemRef.current || (crypto?.randomUUID?.() ?? `${Date.now()}`);
    try {
      const res = await api<{ session: { id: string } }>("/api/station/activate", {
        method: "POST",
        headers: { ...headers, "Idempotency-Key": idemRef.current },
        body: { qrToken: token, stationId: STATION_ID, expectedGameId: lookup?.game.id },
      });
      setSessionId(res.session.id);
      setPhase("authorized");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Activation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function startGame() {
    if (!sessionId) return;
    setBusy(true);
    setError("");
    try {
      const res = await api<{ session: SessionInfo }>("/api/station/start", {
        method: "POST",
        headers,
        body: { sessionId, stationId: STATION_ID },
      });
      const end = res.session.expectedEndTime ? new Date(res.session.expectedEndTime).getTime() : Date.now();
      setEndsAt(end);
      setPhase("running");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not start.");
    } finally {
      setBusy(false);
    }
  }

  async function completeGame() {
    if (!sessionId) return;
    setBusy(true);
    setError("");
    try {
      const res = await api<{ rewards: Reward[]; rewardPointsEarned: number }>("/api/station/complete", {
        method: "POST",
        headers,
        body: { sessionId, score: score === "" ? null : Number(score) },
      });
      setRewards(res.rewards);
      setRewardTotal(res.rewardPointsEarned);
      setPhase("done");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not complete.");
    } finally {
      setBusy(false);
    }
  }

  async function fault() {
    if (!sessionId) return;
    setBusy(true);
    try {
      await api("/api/station/fault", {
        method: "POST",
        headers,
        body: { sessionId, reason: "Reported at kiosk" },
      });
      setPhase("fault");
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not report fault.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setToken("");
    setLookup(null);
    setSessionId(null);
    setEndsAt(null);
    setScore("");
    setRewards([]);
    setRewardTotal(0);
    setError("");
    idemRef.current = "";
    setPhase("scan");
  }

  return (
    <main className="min-h-screen">
      {/* Kiosk header */}
      <div className="border-b border-white/10 bg-black/30">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#1cb0f6] to-[#34d399] text-black">
              <ScanLine size={22} />
            </div>
            <div>
              <p className="font-black tracking-tight">Game Station</p>
              <p className="text-xs text-white/40">{STATION_ID} · self-service kiosk</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white">
              <Home size={16} /> Exit
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-6 py-8">
        <Steps phase={phase} />

        {error && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">
            <AlertTriangle size={18} /> {error}
          </div>
        )}

        {/* SCAN */}
        {phase === "scan" && (
          <Panel title="Present your Play Pass" subtitle="Scan the QR at the reader, or enter the pass code.">
            <div className="mb-6 flex justify-center">
              <div className="grid h-40 w-40 place-items-center rounded-3xl border-2 border-dashed border-white/15 text-white/30">
                <ScanLine size={54} />
              </div>
            </div>
            <div className="flex gap-2">
              <input
                className="input font-mono"
                placeholder="pp_…"
                value={token}
                onChange={(e) => setToken(e.target.value.trim())}
                onKeyDown={(e) => e.key === "Enter" && token && doLookup(token)}
              />
              <button className="btn-primary shrink-0" disabled={!token || busy} onClick={() => doLookup(token)}>
                {busy ? <Spinner /> : "Scan"}
              </button>
            </div>
          </Panel>
        )}

        {/* REVIEW */}
        {phase === "review" && lookup && (
          <Panel title={lookup.game.name} subtitle={`Pass for ${lookup.customerFirstName ?? "guest"}`}>
            <div className="mb-5 grid grid-cols-3 gap-3 text-center">
              <Info label="Cost" value={`${lookup.pointCost} pts`} />
              <Info label="Pass status" value={lookup.status} />
              <Info label="Expires in" value={mmss(lookup.expiresInSeconds)} />
            </div>
            <button className="btn-primary w-full py-4 text-lg" disabled={busy} onClick={activate}>
              {busy ? <Spinner /> : "Authorize Play"}
            </button>
          </Panel>
        )}

        {/* AUTHORIZED */}
        {phase === "authorized" && (
          <Panel accent="emerald" title="PLAY AUTHORIZED" subtitle="The station is unlocked. Start when the player is ready.">
            <div className="mb-6 flex justify-center">
              <CheckCircle2 size={90} className="text-emerald-400" />
            </div>
            <button className="btn-primary w-full py-4 text-lg" disabled={busy} onClick={startGame}>
              <Play size={20} /> {busy ? "Starting…" : "Start Game"}
            </button>
          </Panel>
        )}

        {/* RUNNING */}
        {phase === "running" && (
          <Panel accent="violet" title="Game in progress" subtitle="Physical game is running.">
            <div className="mb-6 text-center">
              <div className="text-7xl font-black tabular-nums tracking-tight">{mmss(remaining)}</div>
              <p className="mt-1 text-sm text-white/45">time remaining</p>
            </div>
            <div className="mb-4">
              <label className="label">Final score (optional)</label>
              <input
                className="input text-center text-xl"
                inputMode="numeric"
                placeholder="e.g. 85"
                value={score}
                onChange={(e) => setScore(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="flex gap-2">
              <button className="btn-primary flex-1 py-4" disabled={busy} onClick={completeGame}>
                <Flag size={18} /> {busy ? "Finishing…" : "Complete Session"}
              </button>
              <button className="btn-danger shrink-0" disabled={busy} onClick={fault}>
                <AlertTriangle size={18} /> Fault
              </button>
            </div>
          </Panel>
        )}

        {/* DONE */}
        {phase === "done" && (
          <Panel accent="emerald" title="Session complete" subtitle="Thanks for playing!">
            <div className="mb-5 flex justify-center">
              <Trophy size={80} className="text-[#ffc800]" />
            </div>
            {rewardTotal > 0 ? (
              <div className="mb-5 space-y-2">
                <p className="text-center text-2xl font-black text-emerald-300">+{rewardTotal} reward points</p>
                <div className="space-y-1.5">
                  {rewards.map((r, i) => (
                    <div key={i} className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-2 text-sm">
                      <span className="inline-flex items-center gap-2"><Trophy size={14} className="text-[#ffc800]" /> {r.name}</span>
                      <span className="font-bold text-emerald-300">+{r.points}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="mb-5 text-center text-white/60">No rewards earned this time.</p>
            )}
            <button className="btn-ghost w-full" onClick={reset}>
              <RotateCcw size={16} /> Ready for next player
            </button>
          </Panel>
        )}

        {/* FAULT */}
        {phase === "fault" && (
          <Panel accent="red" title="Session cancelled" subtitle="Fault reported — the player was refunded.">
            <div className="mb-5 flex justify-center">
              <AlertTriangle size={72} className="text-red-400" />
            </div>
            <button className="btn-ghost w-full" onClick={reset}>
              <RotateCcw size={16} /> Reset station
            </button>
          </Panel>
        )}
      </div>
    </main>
  );
}

function Steps({ phase }: { phase: Phase }) {
  const order = ["scan", "review", "authorized", "running", "done"];
  const idx = order.indexOf(phase === "fault" ? "running" : phase);
  const labels = ["Scan", "Review", "Authorize", "Play", "Complete"];
  return (
    <div className="mb-6 flex items-center justify-between gap-2">
      {labels.map((l, i) => (
        <div key={l} className="flex flex-1 items-center gap-2">
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              i <= idx ? "bg-gradient-to-br from-[#58cc02] to-[#1cb0f6] text-black" : "bg-white/10 text-white/40"
            }`}
          >
            {i + 1}
          </div>
          <span className={`hidden text-xs sm:block ${i <= idx ? "text-white" : "text-white/40"}`}>{l}</span>
          {i < labels.length - 1 && <div className={`h-px flex-1 ${i < idx ? "bg-white/40" : "bg-white/10"}`} />}
        </div>
      ))}
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  accent,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  accent?: "emerald" | "violet" | "red";
}) {
  const ring =
    accent === "emerald"
      ? "border-emerald-400/30"
      : accent === "violet"
        ? "border-violet-400/30"
        : accent === "red"
          ? "border-red-400/30"
          : "border-white/10";
  return (
    <div className={`card border ${ring} p-8`}>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-black tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-white/50">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3">
      <p className="text-xs text-white/40">{label}</p>
      <p className="mt-1 font-bold capitalize">{value}</p>
    </div>
  );
}
