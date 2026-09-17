"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiClientError } from "@/lib/client";
import { useCustomer } from "@/components/customer/CustomerProvider";
import { Icon } from "@/components/Icon";

type Reward = {
  id: string;
  name: string;
  description: string | null;
  spendRequiredLabel: string;
  unlocked: boolean;
  redeemed: boolean;
  code: string | null;
  claimable: boolean;
  progressPct: number;
};

export default function RewardsPage() {
  const { refresh } = useCustomer();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [spentLabel, setSpentLabel] = useState("₦0");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api<{ spentLabel: string; rewards: Reward[] }>("/api/rewards");
    setRewards(r.rewards);
    setSpentLabel(r.spentLabel);
  }, []);

  useEffect(() => { load().catch(() => {}); }, [load]);

  async function redeem(id: string) {
    setBusy(id);
    setError("");
    try {
      await api(`/api/rewards/${id}/redeem`, { method: "POST" });
      await load();
      await refresh();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Could not redeem.");
    } finally {
      setBusy(null);
    }
  }

  function copy(code: string) {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(code);
      setTimeout(() => setCopied(null), 1500);
    });
  }

  const claim = rewards.filter((r) => r.claimable);
  const redeemed = rewards.filter((r) => r.redeemed);
  const locked = rewards.filter((r) => !r.unlocked && !r.redeemed);

  return (
    <>
      <header className="gp-head">
        <div className="gp-hi">Rewards</div>
        <div style={{ marginTop: 16 }}>
          <div className="gp-eyebrow">You’ve spent</div>
          <div className="gp-big">{spentLabel}</div>
          <div className="gp-head-sub">Every purchase counts. Show the code to an attendant to claim.</div>
        </div>
      </header>

      <div className="gp-sheet">
        {error && <div className="gp-tag gp-tag--warn" style={{ marginBottom: 10 }}>{error}</div>}

        {claim.length > 0 && (
          <div className="gp-sec">
            <div className="gp-sec-head"><span className="gp-sec-title">Ready to claim</span><span className="gp-chip">{claim.length}</span></div>
            {claim.map((r) => (
              <div key={r.id} style={{ paddingTop: 6 }}>
                <div className="gp-row" style={{ borderTop: "none", paddingBottom: 8 }}>
                  <div className="gp-hex gp-hex--g"><Icon name="trophy" /></div>
                  <div className="gp-rmain">
                    <div className="gp-name">{r.name}</div>
                    <div className="gp-meta">{r.description ?? `Unlocked at ${r.spendRequiredLabel}`}</div>
                  </div>
                </div>
                <button className="gp-btn gp-btn--gold" disabled={busy === r.id} onClick={() => redeem(r.id)}>
                  {busy === r.id ? "Redeeming…" : "Redeem now"}
                </button>
              </div>
            ))}
          </div>
        )}

        {redeemed.length > 0 && (
          <div className="gp-sec">
            <div className="gp-sec-head"><span className="gp-sec-title">Redeemed</span></div>
            {redeemed.map((r) => (
              <div key={r.id} className="gp-row">
                <div className="gp-hex gp-hex--m"><Icon name="gift" /></div>
                <div className="gp-rmain">
                  <div className="gp-name">{r.name}</div>
                  <div className="gp-meta">Show code at the desk</div>
                </div>
                <div className="gp-rright">
                  <button className="gp-code" onClick={() => r.code && copy(r.code)} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}>{r.code}</button>
                  <span className="gp-tag gp-tag--done">{copied === r.code ? "Copied" : "Done"}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {locked.length > 0 && (
          <div className="gp-sec">
            <div className="gp-sec-head"><span className="gp-sec-title">Keep going</span></div>
            {locked.map((r) => (
              <div key={r.id} className="gp-row">
                <div className="gp-hex"><Icon name="trophy" /></div>
                <div className="gp-rmain">
                  <div className="gp-name">{r.name}</div>
                  <div className="gp-pbar"><i style={{ width: `${r.progressPct}%` }} /><span>{spentLabel} / {r.spendRequiredLabel}</span></div>
                </div>
              </div>
            ))}
          </div>
        )}

        {rewards.length === 0 && <div className="gp-card"><span className="gp-empty-ic"><Icon name="trophy" size={26} /></span><span>No rewards available yet. Keep spending and they’ll appear here.</span></div>}
      </div>
    </>
  );
}
