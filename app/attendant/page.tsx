"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ScanLine, Home, Check, UserPlus, Gamepad2, Gift, RotateCcw, Search } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { timeAgo } from "@/lib/format";
import { Spinner, ErrorNote } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";

type GameLite = { id: string; name: string; imageUrl: string; location: string; durationLabel: string };
type Lookup = { phone: string; found: boolean; player: { firstName: string | null; name: string | null; gamesPlayed: number } | null };
type Recent = { id: string; loggedAt: string; game: { name: string } | null; player: { firstName: string | null; phone: string } };
type LogResult = {
  player: { firstName: string | null; phone: string; gamesPlayed: number };
  log: { game: { name: string } };
  isNewPlayer: boolean;
  unlockedRewards: { id: string; name: string }[];
};

export default function AttendantPage() {
  const [games, setGames] = useState<GameLite[]>([]);
  const [recent, setRecent] = useState<Recent[]>([]);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<LogResult | null>(null);

  const loadStatic = useCallback(async () => {
    const [g, rec] = await Promise.all([
      api<{ games: GameLite[] }>("/api/attendant/games"),
      api<{ logs: Recent[] }>("/api/attendant/recent"),
    ]);
    setGames(g.games);
    setRecent(rec.logs);
  }, []);

  useEffect(() => {
    loadStatic();
  }, [loadStatic]);

  // Live player lookup as the phone is typed.
  useEffect(() => {
    if (phone.replace(/\s+/g, "").length < 6) {
      setLookup(null);
      return;
    }
    const t = setTimeout(() => {
      api<Lookup>(`/api/attendant/lookup?phone=${encodeURIComponent(phone)}`).then(setLookup).catch(() => setLookup(null));
    }, 300);
    return () => clearTimeout(t);
  }, [phone]);

  async function logGame() {
    if (!gameId) return;
    setBusy(true);
    setError("");
    try {
      const res = await api<LogResult>("/api/attendant/log", {
        method: "POST",
        body: { phone, gameId, name: name || undefined },
      });
      setResult(res);
      await loadStatic();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not log the game.");
    } finally {
      setBusy(false);
    }
  }

  function reset() {
    setPhone("");
    setName("");
    setGameId(null);
    setLookup(null);
    setResult(null);
    setError("");
  }

  return (
    <main className="min-h-screen">
      <div className="border-b border-white/10 bg-black/30">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#58cc02] to-[#1cb0f6] text-black">
              <ScanLine size={22} />
            </div>
            <div>
              <p className="font-black tracking-tight">Attendant Console</p>
              <p className="text-xs text-white/40">Log a game a player just finished</p>
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
        {result ? (
          <div className="card border-2 border-emerald-400/30 p-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
              <Check size={34} />
            </div>
            <h1 className="text-2xl font-black">Game logged</h1>
            <p className="mt-1 text-white/60">
              <b className="text-white">{result.log.game.name}</b> for{" "}
              <b className="text-white">{result.player.firstName ?? result.player.phone}</b>
              {result.isNewPlayer && " (new player)"}.
            </p>
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/5 px-4 py-2 text-sm">
              <Gamepad2 size={15} className="text-[#58cc02]" /> Now {result.player.gamesPlayed} games played
            </p>
            {result.unlockedRewards.length > 0 && (
              <div className="mx-auto mt-4 max-w-sm rounded-xl border border-[#ffc800]/30 bg-[#ffc800]/10 p-3 text-sm text-[#ffc800]">
                <Gift size={14} className="mr-1 inline" /> Unlocked: {result.unlockedRewards.map((r) => r.name).join(", ")} — the player can redeem it in their app.
              </div>
            )}
            <button className="btn-primary mt-6" onClick={reset}>
              <RotateCcw size={16} /> Log another game
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {error && <ErrorNote message={error} />}

            {/* Player */}
            <div className="card p-5">
              <h2 className="mb-3 font-bold">1 · Player phone number</h2>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  className="input pl-9 text-lg"
                  inputMode="tel"
                  placeholder="e.g. 08012345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoFocus
                />
              </div>
              {lookup && (
                <div className="mt-3 text-sm">
                  {lookup.found && lookup.player ? (
                    <p className="inline-flex items-center gap-2 text-emerald-300">
                      <Check size={15} /> {lookup.player.name ?? "Returning player"} · {lookup.player.gamesPlayed} games played
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="inline-flex items-center gap-2 text-white/60"><UserPlus size={15} /> New player — will be created.</p>
                      <input className="input" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Game */}
            <div className="card p-5">
              <h2 className="mb-3 font-bold">2 · Which game did they play?</h2>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {games.map((g) => (
                  <button
                    key={g.id}
                    onClick={() => setGameId(g.id)}
                    className={`overflow-hidden rounded-xl border-2 text-left transition ${gameId === g.id ? "border-[#58cc02]" : "border-white/10 hover:border-white/25"}`}
                  >
                    <div className="aspect-[16/10] w-full bg-gradient-to-br from-[#1c2340] to-[#0a0e1a]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={g.imageUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                    <div className="p-2">
                      <p className="truncate text-sm font-semibold">{g.name}</p>
                      <p className="truncate text-[11px] text-white/40">{g.location}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <button
              className="btn-primary w-full py-4 text-base"
              disabled={busy || phone.replace(/\s+/g, "").length < 6 || !gameId}
              onClick={logGame}
            >
              {busy ? <Spinner /> : "Log this game"}
            </button>

            {/* Recent */}
            {recent.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-semibold text-white/50">Recently logged</h2>
                <div className="card divide-y divide-white/5">
                  {recent.map((l) => (
                    <div key={l.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                      <span className="truncate">
                        <b>{l.game?.name ?? "Game"}</b> · {l.player.firstName ?? l.player.phone}
                      </span>
                      <span className="shrink-0 text-xs text-white/40">{timeAgo(l.loggedAt)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
