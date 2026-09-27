"use client";

import { useEffect, useState } from "react";
import { Money, GameController, ShoppingBag, Pulse, Gift } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Loading } from "@/components/ui";

type Overview = {
  revenueTodayLabel: string;
  gamesToday: number;
  itemsToday: number;
  activeSessions: number;
  rewardsToday: number;
};

export default function OverviewPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api<Overview>("/api/admin/overview").then(setData).finally(() => setLoading(false)); }, []);

  if (loading || !data) return <Loading />;

  const cards = [
    { label: "Revenue today", value: data.revenueTodayLabel, icon: Money },
    { label: "Games today", value: String(data.gamesToday), icon: GameController },
    { label: "Items today", value: String(data.itemsToday), icon: ShoppingBag },
    { label: "Active sessions", value: String(data.activeSessions), icon: Pulse },
    { label: "Rewards today", value: String(data.rewardsToday), icon: Gift },
  ];

  return (
    <div className="space-y-6">
      <div className="admin-head">
        <h1 className="text-2xl font-black tracking-tight">Today at a glance</h1>
        <p className="text-sm text-white/50">Live figures for today — resets at midnight.</p>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card p-4">
            <c.icon size={30} weight="duotone" className="mb-3 text-[#0d47a1]" />
            <p className="text-2xl font-black">{c.value}</p>
            <p className="text-xs text-white/45">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
