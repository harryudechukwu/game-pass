"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { money } from "@/lib/format";

type Reward = {
  id: string;
  name: string;
  description: string | null;
  spendRequiredKobo: number;
  spendRequiredLabel: string;
  terms: string[] | null;
  unlocked: boolean;
  redeemed: boolean;
  code: string | null;
  claimable: boolean;
  progressPct: number;
};
type Resp = { spentKobo: number; rewards: Reward[] };

const DEFAULT_TERMS = [
  "Redeemable at Creamy Castle, Ogidi.",
  "Valid for 30 days once unlocked.",
  "Item sizing is subject to outlet availability.",
];

export default function RewardDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Resp | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const autoTried = useRef<string | null>(null);

  const load = useCallback(async () => {
    setData(await api<Resp>("/api/rewards"));
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const reward = data?.rewards.find((r) => r.id === id) ?? null;
  const spent = data?.spentKobo ?? 0;

  // Once the spend target is met, the unique code is revealed automatically.
  useEffect(() => {
    if (!reward || !reward.claimable) return;
    if (autoTried.current === reward.id) return;
    autoTried.current = reward.id;
    (async () => {
      setBusy(true);
      setError("");
      try {
        await api(`/api/rewards/${reward.id}/redeem`, { method: "POST" });
        await load();
      } catch (e) {
        setError(e instanceof ApiClientError ? e.message : "Could not reveal your code.");
      } finally {
        setBusy(false);
      }
    })();
  }, [reward, load]);

  const terms = reward?.terms?.length ? reward.terms : DEFAULT_TERMS;
  const chars = reward?.code ? reward.code.replace(/^GP-/, "").split("") : ["", "", "", "", ""];

  return (
    <div className="gp-sheet" style={{ paddingTop: 16 }}>
      <button className="gp-back" onClick={() => router.back()} aria-label="Back"><ArrowLeft size={20} /></button>
      <div className="gp-hi">Reward details</div>
      <div className="gp-welcome-sub">Spend and win lots of exciting rewards</div>

      {reward && (
        <>
          <p className="gp-detail-intro">
            {reward.code
              ? "Here’s your unique 5 digit code for redeeming this reward. Terms and conditions apply."
              : "Reach the spend target to reveal your unique 5 digit code. Terms and conditions apply."}
          </p>
          <div className="gp-codes">
            {chars.map((ch, i) => <div key={i} className="gp-code-box">{ch}</div>)}
          </div>

          <div className="gp-detail-card">
            <div className="gp-detail-name">{reward.name}</div>
            {reward.description && <div className="gp-detail-desc">{reward.description}</div>}
            <div className="gp-detail-spent">{money(spent, "NGN")} spent of {reward.spendRequiredLabel}</div>
            <div className="gp-bar"><i style={{ width: `${reward.progressPct}%` }} /></div>
            {reward.code ? (
              <div className="gp-detail-more">Show this code at the desk to claim your reward.</div>
            ) : reward.unlocked ? (
              <div className="gp-detail-more">{busy ? "Revealing your code…" : "Unlocked — your code will appear above."}</div>
            ) : (
              <div className="gp-detail-more">Spend <b>{money(reward.spendRequiredKobo - spent, "NGN")} more</b> to unlock this reward.</div>
            )}
            {error && <div className="gp-detail-more" style={{ color: "#c0392b" }}>{error}</div>}
          </div>

          <div className="gp-detail-card gp-detail-card--tc">
            <div className="gp-tc-title">Terms &amp; Conditions</div>
            <ul className="gp-tc-list">{terms.map((t, i) => <li key={i}>{t}</li>)}</ul>
          </div>
        </>
      )}

      {data && !reward && (
        <div className="gp-detail-more" style={{ marginTop: 20 }}>This reward isn’t available.</div>
      )}
    </div>
  );
}
