"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { api } from "@/lib/client";
import { timeAgo } from "@/lib/format";
import { useCustomer } from "@/components/customer/CustomerProvider";
import { SessionTimer } from "@/components/customer/SessionTimer";
import { Icon, iconFor } from "@/components/Icon";

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
type HomeData = {
  spentLabel: string;
  gamesPlayed: number;
  activeSessions: Purchase[];
  purchases: Purchase[];
  nextReward: NextReward;
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
        <div className="gp-hi">Welcome to Gacia{player.firstName ? `, ${player.firstName}` : ""}</div>
        <div style={{ marginTop: 16 }}>
          <div className="gp-eyebrow">Total spent in store</div>
          <div className="gp-big">{spentLabel}</div>
          <div className="gp-head-sub">
            {data ? `${data.gamesPlayed} games completed — keep going to unlock rewards` : "Loading your games…"}
          </div>
        </div>
      </header>

      <div className="gp-sheet">
        {data && data.claimable.length > 0 && (
          <div className="gp-sec">
            <div className="gp-sec-head"><span className="gp-sec-title">Rewards ready</span><span className="gp-chip">{data.claimable.length}</span></div>
            <Link href="/rewards" className="gp-row" style={{ textDecoration: "none" }}>
              <div className="gp-hex gp-hex--g"><Icon name="gift" /></div>
              <div className="gp-rmain">
                <div className="gp-name">{data.claimable.length === 1 ? "You’ve unlocked a reward" : `${data.claimable.length} rewards unlocked`}</div>
                <div className="gp-meta">{data.claimable.map((c) => c.name).join(", ")} · tap to redeem</div>
              </div>
              <ChevronRight size={18} color="var(--gp-sub)" />
            </Link>
          </div>
        )}

        {data?.nextReward && (
          <div className="gp-sec">
            <div className="gp-sec-head"><span className="gp-sec-title">Rewards</span><span className="gp-chip gp-chip--go">{data.nextReward.remainingLabel} to go</span></div>
            <div className="gp-row">
              <div className="gp-hex gp-hex--g gp-hex--lg"><Icon name="trophy" size={26} /></div>
              <div className="gp-rmain">
                <div className="gp-name">{data.nextReward.name}</div>
                <div className="gp-meta">{spentLabel} / {data.nextReward.spendRequiredLabel}</div>
                <div className="gp-pbar gp-pbar--slim"><i style={{ width: `${data.nextReward.progressPct}%` }} /></div>
              </div>
            </div>
          </div>
        )}

        <div className="gp-sec">
          <div className="gp-sec-head"><span className="gp-sec-title">Games</span>{data && data.activeSessions.length > 0 && <span className="gp-chip">{data.activeSessions.length}</span>}</div>
          {data && data.activeSessions.length > 0 ? (
            data.activeSessions.map((p) => (
              <div key={p.id} className="gp-row">
                <div className="gp-hex gp-hex--b"><Icon name="timer" /></div>
                <div className="gp-rmain">
                  <div className="gp-name">{p.name}</div>
                  <div className="gp-meta">{p.location ?? "At the venue"}</div>
                </div>
                <SessionTimer headsUpEndsAt={p.headsUpEndsAt} mainEndsAt={p.mainEndsAt} />
              </div>
            ))
          ) : (
            <div className="gp-card"><span className="gp-empty-ic"><Icon name="timer" size={26} /></span><span>No active game. When you buy a game at the desk, the countdown shows up here.</span></div>
          )}
        </div>

        <div className="gp-sec">
          <div className="gp-sec-head"><span className="gp-sec-title">Recent</span></div>
          {feed.length > 0 ? (
            feed.slice(0, 12).map((p) => (
              <div key={p.id} className="gp-row">
                <div className="gp-hex"><Icon name={iconFor(p.icon, p.kind)} /></div>
                <div className="gp-rmain">
                  <div className="gp-name">{p.name}{p.kind === "item" && p.quantity > 1 ? ` ×${p.quantity}` : ""}</div>
                  <div className="gp-meta">{p.kind === "game" ? "Game" : "Item"} · {timeAgo(p.createdAt)}</div>
                </div>
                <span className="gp-amt">{p.amountLabel}</span>
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
