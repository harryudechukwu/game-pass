"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/client";
import { timeAgo } from "@/lib/format";
import { useCustomer } from "@/components/customer/CustomerProvider";
import { SessionTimer } from "@/components/customer/SessionTimer";
import { Icon } from "@/components/Icon";

type Purchase = {
  id: string;
  kind: "game" | "item";
  name: string;
  icon: string;
  amountLabel: string;
  quantity: number;
  createdAt: string;
  location: string | null;
  headsUpEndsAt: string | null;
  mainEndsAt: string | null;
  sessionStatus: "heads_up" | "active" | "completed" | null;
};
type NextReward = { name: string; spendRequiredLabel: string; remainingLabel: string; progressPct: number } | null;
type Upcoming = { id: string; name: string; remainingLabel: string; spendRequiredLabel: string; progressPct: number };
type HomeData = {
  spentLabel: string;
  gamesPlayed: number;
  activeSessions: Purchase[];
  purchases: Purchase[];
  nextReward: NextReward;
  upcomingRewards: Upcoming[];
  claimable: { id: string; name: string }[];
};

export default function HomePage() {
  const { player, refresh } = useCustomer();
  const [data, setData] = useState<HomeData | null>(null);

  const load = useCallback(async () => {
    setData(await api<HomeData>("/api/home"));
  }, []);

  useEffect(() => {
    load().catch(() => {});
    const t = setInterval(() => { load().catch(() => {}); refresh().catch(() => {}); }, 4000);
    return () => clearInterval(t);
  }, [load, refresh]);

  const spentLabel = data?.spentLabel ?? "₦0";
  const feed = (data?.purchases ?? []).filter((p) => !(p.kind === "game" && p.sessionStatus !== "completed"));

  return (
    <>
      <header className="gp-head">
        <div className="gp-hi">Hi {player.firstName ?? "there"},</div>
        <div className="gp-welcome-sub">Are you ready to have fun at Creamy Castle?</div>
      </header>

      <div className="gp-sheet">
        {/* Hero: total spent + closest reward progress */}
        <div className="gp-hero">
          <div className="gp-hero-inner">
            <div className="gp-hero-label">Total amount spent</div>
            <div className="gp-hero-amt">{spentLabel}</div>
            {data?.nextReward && (
              <div className="gp-hero-reward">
                <div className="gp-tile"><img src="/img/reward.svg" alt="" /></div>
                <div className="gp-hero-rwd">
                  <div className="gp-hero-rwd-top">
                    <span className="gp-hero-rwd-name">{data.nextReward.name}</span>
                    <span className="gp-hero-pct">{data.nextReward.progressPct}%</span>
                  </div>
                  <div className="gp-bar"><i style={{ width: `${data.nextReward.progressPct}%` }} /></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Playing now (only when a game is live) */}
        {data && data.activeSessions.length > 0 && (
          <div className="gp-sec">
            <div className="gp-sec-head"><span className="gp-sec-title">Playing now</span></div>
            {data.activeSessions.map((p) => (
              <div key={p.id} className="gp-item">
                <div className="gp-tile"><img src="/img/game.svg" alt="" /></div>
                <div className="gp-item-main">
                  <div className="gp-item-name">{p.name}</div>
                  <div className="gp-item-sub">{p.location ?? "At the venue"}</div>
                </div>
                <SessionTimer headsUpEndsAt={p.headsUpEndsAt} mainEndsAt={p.mainEndsAt} />
              </div>
            ))}
          </div>
        )}

        {/* Upcoming rewards */}
        <div className="gp-sec">
          <div className="gp-sec-head"><span className="gp-sec-title">Upcoming rewards for you</span><Link href="/rewards" className="gp-seeall">See all</Link></div>
          {data && data.upcomingRewards.length > 0 ? (
            data.upcomingRewards.map((r) => (
              <div key={r.id} className="gp-item">
                <div className="gp-tile"><img src="/img/reward.svg" alt="" /></div>
                <div className="gp-item-main">
                  <div className="gp-item-name">{r.name}</div>
                  <div className="gp-item-sub">{r.remainingLabel} left to redeem</div>
                </div>
                <div className="gp-redeem"><span>Redeem</span><span className="gp-redeem-lock"><Icon name="lock" size={16} /></span></div>
              </div>
            ))
          ) : (
            <div className="gp-card"><span className="gp-empty-ic"><Icon name="trophy" size={26} /></span><span>No upcoming rewards — you’re all caught up!</span></div>
          )}
        </div>

        {/* Recent activities */}
        <div className="gp-sec">
          <div className="gp-sec-head"><span className="gp-sec-title">Recent activities</span><Link href="/rewards" className="gp-seeall">See all</Link></div>
          {feed.length > 0 ? (
            feed.slice(0, 8).map((p) => (
              <div key={p.id} className="gp-item">
                <div className="gp-tile"><img src={p.kind === "game" ? "/img/game.svg" : "/img/activity.svg"} alt="" /></div>
                <div className="gp-item-main">
                  <div className="gp-item-name">{p.name}{p.kind === "item" && p.quantity > 1 ? ` ×${p.quantity}` : ""}</div>
                  <div className="gp-item-sub">{timeAgo(p.createdAt)}</div>
                </div>
                <span className="gp-item-amt">{p.amountLabel}</span>
              </div>
            ))
          ) : (
            <div className="gp-card"><span className="gp-empty-ic"><Icon name="bag" size={26} /></span><span>Nothing yet. Games you finish and items you buy show up here.</span></div>
          )}
        </div>
      </div>
    </>
  );
}
