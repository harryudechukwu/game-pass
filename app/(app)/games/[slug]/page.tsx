"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Coins,
  Clock,
  MapPin,
  Users,
  ShieldAlert,
  ListChecks,
  Ruler,
  Cake,
  Info,
} from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { pts } from "@/lib/format";
import { useCustomer } from "@/components/customer/CustomerProvider";
import { Loading, ErrorNote, StatusPill } from "@/components/ui";

type Game = {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  pointCost: number;
  durationLabel: string;
  playersLabel: string;
  location: string;
  minAge: number | null;
  minHeightCm: number | null;
  instructions: string | null;
  rules: string | null;
  safety: string | null;
  status: string;
  available: boolean;
};

export default function GameDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();
  const { customer, refresh } = useCustomer();
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const idempotencyKey = useMemo(() => (typeof crypto !== "undefined" ? crypto.randomUUID() : `${Date.now()}`), []);

  useEffect(() => {
    api<{ game: Game }>(`/api/games/${slug}`)
      .then((r) => setGame(r.game))
      .catch((e) => setError(e instanceof ApiClientError ? e.message : "Failed to load game."))
      .finally(() => setLoading(false));
  }, [slug]);

  async function confirmPurchase() {
    if (!game) return;
    setBusy(true);
    setError("");
    try {
      await api("/api/playpass", {
        method: "POST",
        body: { gameId: game.id },
        headers: { "Idempotency-Key": idempotencyKey },
      });
      await refresh();
      router.push("/pass");
    } catch (e) {
      const err = e instanceof ApiClientError ? e : null;
      setError(err?.message ?? "Could not create your Play Pass.");
      setConfirming(false);
      setBusy(false);
    }
  }

  if (loading) return <Loading />;
  if (!game) return <ErrorNote message={error || "Game not found."} />;

  const remaining = customer.balance - game.pointCost;
  const canAfford = remaining >= 0;

  return (
    <div className="-mx-4 -mt-3">
      {/* Hero image */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-gradient-to-br from-[#1c2340] to-[#0a0e1a]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={game.imageUrl} alt={game.name} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0e1a] via-transparent to-transparent" />
        <Link
          href="/home"
          className="absolute left-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
          <div>
            <span className="pill mb-2 bg-emerald-400/20 text-emerald-200 backdrop-blur">
              Physical activity
            </span>
            <h1 className="text-2xl font-black drop-shadow">{game.name}</h1>
          </div>
          {!game.available && <StatusPill status={game.status} />}
        </div>
      </div>

      <div className="space-y-5 px-4 py-5">
        <p className="text-sm text-white/70">{game.description}</p>

        {/* Facts */}
        <div className="grid grid-cols-2 gap-2">
          <Fact icon={Coins} label="Cost" value={`${game.pointCost} points`} accent />
          <Fact icon={Clock} label="Duration" value={game.durationLabel} />
          <Fact icon={Users} label="Players" value={game.playersLabel} />
          <Fact icon={MapPin} label="Location" value={game.location} />
          {game.minAge != null && <Fact icon={Cake} label="Min age" value={`${game.minAge}+`} />}
          {game.minHeightCm != null && (
            <Fact icon={Ruler} label="Min height" value={`${game.minHeightCm} cm`} />
          )}
        </div>

        {game.instructions && <InfoBlock icon={Info} title="How to play" body={game.instructions} />}
        {game.rules && <InfoBlock icon={ListChecks} title="Rules" body={game.rules} />}
        {game.safety && (
          <InfoBlock icon={ShieldAlert} title="Safety requirements" body={game.safety} tone="warn" />
        )}

        {error && <ErrorNote message={error} />}
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-24 z-10 mx-4 mb-2">
        {game.available ? (
          <button
            className="btn-primary w-full py-4 text-base shadow-2xl"
            onClick={() => setConfirming(true)}
          >
            Play for {game.pointCost} points
          </button>
        ) : (
          <button className="btn-ghost w-full py-4" disabled>
            Currently unavailable
          </button>
        )}
      </div>

      {/* Confirmation sheet */}
      {confirming && (
        <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 p-4" onClick={() => !busy && setConfirming(false)}>
          <div
            className="w-full max-w-md rounded-3xl border border-white/10 bg-[#141a2e] p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-white/20" />
            <h2 className="text-xl font-bold">Confirm your play</h2>
            <p className="mt-2 text-white/70">
              You&apos;re about to spend <b className="text-white">{game.pointCost} points</b> on{" "}
              <b className="text-white">{game.name}</b>.
            </p>

            <div className="mt-4 space-y-2 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm">
              <Row label="Current balance" value={`${pts(customer.balance)} pts`} />
              <Row label="This play" value={`− ${game.pointCost} pts`} />
              <div className="my-1 border-t border-white/10" />
              <Row
                label="Remaining balance"
                value={`${pts(Math.max(remaining, 0))} pts`}
                strong
                danger={!canAfford}
              />
            </div>

            {!canAfford ? (
              <div className="mt-4 space-y-3">
                <ErrorNote message="You don't have enough points for this game." />
                <Link href="/wallet" className="btn-primary w-full">
                  Buy more points
                </Link>
                <button className="btn-ghost w-full" onClick={() => setConfirming(false)} disabled={busy}>
                  Not now
                </button>
              </div>
            ) : (
              <div className="mt-5 space-y-2">
                <button className="btn-primary w-full py-4" onClick={confirmPurchase} disabled={busy}>
                  {busy ? "Creating Play Pass…" : "Confirm & Get Play Pass"}
                </button>
                <button className="btn-ghost w-full" onClick={() => setConfirming(false)} disabled={busy}>
                  Cancel
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Fact({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`card p-3 ${accent ? "border-[#ffc800]/25" : ""}`}>
      <div className="flex items-center gap-1.5 text-xs text-white/45">
        <Icon size={13} /> {label}
      </div>
      <p className={`mt-1 text-sm font-semibold ${accent ? "text-[#ffc800]" : ""}`}>{value}</p>
    </div>
  );
}

function InfoBlock({
  icon: Icon,
  title,
  body,
  tone,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  body: string;
  tone?: "warn";
}) {
  return (
    <div className={`card p-4 ${tone === "warn" ? "border-amber-500/25 bg-amber-500/5" : ""}`}>
      <div className="flex items-center gap-2 font-semibold">
        <Icon size={16} className={tone === "warn" ? "text-amber-300" : "text-white/70"} /> {title}
      </div>
      <p className="mt-1.5 whitespace-pre-line text-sm text-white/60">{body}</p>
    </div>
  );
}

function Row({ label, value, strong, danger }: { label: string; value: string; strong?: boolean; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-white/55">{label}</span>
      <span className={`${strong ? "text-base font-bold" : ""} ${danger ? "text-red-300" : ""}`}>{value}</span>
    </div>
  );
}
