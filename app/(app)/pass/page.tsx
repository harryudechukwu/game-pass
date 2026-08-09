"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Ticket, ScanLine, X, ExternalLink, CheckCircle2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { pts } from "@/lib/format";
import { useCustomer } from "@/components/customer/CustomerProvider";
import { PassCountdown } from "@/components/customer/PassCountdown";
import { Loading, ErrorNote, StatusPill } from "@/components/ui";

type Pass = {
  id: string;
  status: string;
  pointCost: number;
  expiresInSeconds: number;
  qrToken: string;
  qrDataUrl?: string;
  sessionStatus: string | null;
  game?: { name: string; location: string; durationLabel: string };
};

export default function PassPage() {
  const { refresh } = useCustomer();
  const [pass, setPass] = useState<Pass | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await api<{ playPass: Pass | null }>("/api/playpass/current");
      setPass(res.playPass);
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed to load your pass.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Poll so the screen reflects activation / start / completion at the station.
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  async function cancel() {
    if (!pass) return;
    setCancelling(true);
    try {
      await api(`/api/playpass/${pass.id}/cancel`, { method: "POST" });
      await refresh();
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not cancel.");
    } finally {
      setCancelling(false);
    }
  }

  if (loading) return <Loading label="Loading your Play Pass…" />;

  if (!pass) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/5 text-white/40">
          <Ticket size={30} />
        </div>
        <h1 className="text-xl font-bold">No active Play Pass</h1>
        <p className="mt-1 max-w-xs text-sm text-white/50">
          Choose a game and buy a pass to unlock a station. Completed sessions appear in your
          activity.
        </p>
        <div className="mt-5 flex gap-2">
          <Link href="/home" className="btn-primary">Choose a game</Link>
          <Link href="/activity" className="btn-ghost">View activity</Link>
        </div>
      </div>
    );
  }

  const inProgress = pass.status === "in_progress";
  const activated = pass.status === "activated";

  return (
    <div className="space-y-4 pt-2">
      <div className="text-center">
        <h1 className="text-2xl font-black tracking-tight">Your Play Pass</h1>
        <p className="text-sm text-white/50">Single-use · non-transferable</p>
      </div>

      <div className="card overflow-hidden">
        {/* QR */}
        <div className="flex flex-col items-center gap-3 border-b border-white/10 bg-white/[0.02] p-6">
          {pass.qrDataUrl && !inProgress ? (
            <div className="rounded-2xl bg-white p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={pass.qrDataUrl} alt="Play Pass QR code" width={220} height={220} />
            </div>
          ) : (
            <div className="flex h-[248px] w-[248px] items-center justify-center rounded-2xl bg-violet-500/10 text-violet-300">
              <div className="text-center">
                <CheckCircle2 size={48} className="mx-auto" />
                <p className="mt-2 font-semibold">Session in progress</p>
              </div>
            </div>
          )}
          <StatusPill status={pass.status} />
        </div>

        {/* Details */}
        <div className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-bold">{pass.game?.name}</p>
              <p className="text-xs text-white/45">{pass.game?.location}</p>
            </div>
            <span className="pill bg-[#ffc800]/15 font-bold text-[#ffc800]">{pass.pointCost} pts</span>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-center text-sm">
            <PassCountdown
              initialSeconds={pass.expiresInSeconds}
              status={pass.status}
              onExpire={load}
            />
          </div>

          {!inProgress && (
            <p className="flex items-center justify-center gap-1.5 text-center text-sm text-white/60">
              <ScanLine size={16} /> Scan this code at the {pass.game?.name} station.
            </p>
          )}
          {activated && (
            <p className="text-center text-xs text-cyan-300">
              Authorized — the station is ready. Start the game to begin.
            </p>
          )}
        </div>
      </div>

      {error && <ErrorNote message={error} />}

      {/* Demo helper + cancel */}
      <div className="space-y-2">
        <a
          href={`/station?token=${encodeURIComponent(pass.qrToken)}`}
          target="_blank"
          rel="noreferrer"
          className="btn-ghost w-full"
        >
          <ExternalLink size={16} /> Open station simulator (demo)
        </a>
        {(pass.status === "created" || pass.status === "activated") && (
          <button className="btn-danger w-full" onClick={cancel} disabled={cancelling}>
            <X size={16} /> {cancelling ? "Cancelling…" : "Cancel & refund points"}
          </button>
        )}
      </div>
    </div>
  );
}
