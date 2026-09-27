"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Wallet, Gift, Ticket } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { timeAgo, clockTime } from "@/lib/format";
import { Loading } from "@/components/ui";

type Purchase = { id: string; kind: "game" | "item"; name: string; icon: string; amountLabel: string; quantity: number; createdAt: string; sessionStatus: string | null };
type Detail = {
  player: { id: string; name: string | null; phone: string; spentLabel: string; gamesPlayed: number; createdAt: string };
  purchases: Purchase[];
  redemptions: { id: string; rewardName: string; code: string; redeemedAt: string }[];
};

export default function PlayerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api<Detail>(`/api/admin/players/${id}`).then(setData).finally(() => setLoading(false)); }, [id]);

  if (loading || !data) return <Loading />;
  const p = data.player;

  return (
    <div className="space-y-6">
      <Link href="/admin/players" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white"><ArrowLeft size={16} /> Players</Link>

      <div className="admin-head flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e3f3fd] text-xl font-black text-[#0d47a1]">{(p.name ?? p.phone).slice(0, 1).toUpperCase()}</div>
          <div>
            <h1 className="text-2xl font-black">{p.name ?? "Unnamed player"}</h1>
            <p className="text-sm text-white/50">{p.phone} · {p.gamesPlayed} games · joined {timeAgo(p.createdAt)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="inline-flex items-center gap-2 text-3xl font-black text-[#0d47a1]"><Wallet size={24} /> {p.spentLabel}</p>
          <p className="text-xs text-white/45">total spent</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 font-bold">Purchases</h2>
          <div className="max-h-96 space-y-1.5 overflow-y-auto">
            {data.purchases.length === 0 && <p className="text-sm text-white/40">No purchases yet.</p>}
            {data.purchases.map((x) => (
              <div key={x.id} className="flex items-center gap-3 border-b border-white/5 py-2 text-sm last:border-0">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{x.name}{x.kind === "item" && x.quantity > 1 ? ` ×${x.quantity}` : ""}</p>
                  <p className="text-xs text-white/40">{x.kind} · {timeAgo(x.createdAt)}</p>
                </div>
                <span className="font-bold text-white/80">{x.amountLabel}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h2 className="mb-3 font-bold">Rewards redeemed</h2>
          <div className="max-h-96 space-y-1 overflow-y-auto">
            {data.redemptions.length === 0 && <p className="text-sm text-white/40">No rewards redeemed yet.</p>}
            {data.redemptions.map((x) => (
              <div key={x.id} className="flex items-center justify-between border-b border-white/5 py-2 text-sm last:border-0">
                <span className="inline-flex items-center gap-2 font-medium"><Gift size={14} className="text-[#ffc800]" /> {x.rewardName}</span>
                <span className="inline-flex items-center gap-1 font-mono text-xs text-white/50"><Ticket size={12} /> {x.code} · {clockTime(x.redeemedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
