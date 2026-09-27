"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/client";
import { money } from "@/lib/format";
import { Icon } from "@/components/Icon";

type Reward = {
  id: string;
  name: string;
  description: string | null;
  spendRequiredKobo: number;
  spendRequiredLabel: string;
  unlocked: boolean;
  redeemed: boolean;
  code: string | null;
  claimable: boolean;
  progressPct: number;
};

export default function RewardsPage() {
  const router = useRouter();
  const [data, setData] = useState<{ spentKobo: number; rewards: Reward[] } | null>(null);

  const load = useCallback(async () => {
    setData(await api<{ spentKobo: number; rewards: Reward[] }>("/api/rewards"));
  }, []);

  useEffect(() => {
    load().catch(() => {});
    const t = setInterval(() => load().catch(() => {}), 5000);
    return () => clearInterval(t);
  }, [load]);

  const spent = data?.spentKobo ?? 0;
  const rewards = data?.rewards ?? [];

  return (
    <>
      <header className="gp-head">
        <button className="gp-back" onClick={() => router.back()} aria-label="Back"><ArrowLeft size={20} /></button>
        <div className="gp-hi">Rewards</div>
        <div className="gp-welcome-sub">Spend and win lots of exciting rewards</div>
      </header>

      <div className="gp-sheet">
        {rewards.map((r) => (
          <Link key={r.id} href={`/rewards/${r.id}`} className="gp-item" style={{ textDecoration: "none" }}>
            <div className="gp-tile"><img src="/img/reward.svg" alt="" /></div>
            <div className="gp-item-main">
              <div className="gp-item-name">{r.name}</div>
              <div className="gp-item-sub">
                {r.redeemed
                  ? "Redeemed"
                  : r.claimable
                    ? "Ready to redeem"
                    : `${money(r.spendRequiredKobo - spent, "NGN")} left to redeem`}
              </div>
            </div>
            {r.redeemed ? (
              <div className="gp-redeem"><span>View</span></div>
            ) : r.claimable ? (
              <div className="gp-redeem"><span>Redeem</span></div>
            ) : (
              <div className="gp-redeem"><span>Redeem</span><span className="gp-redeem-lock"><Icon name="lock" size={16} /></span></div>
            )}
          </Link>
        ))}

        {data && rewards.length === 0 && (
          <div className="gp-card"><span className="gp-empty-ic"><Icon name="trophy" size={26} /></span><span>No rewards yet. Keep spending and they’ll show up here.</span></div>
        )}
      </div>
    </>
  );
}
