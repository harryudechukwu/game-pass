"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Minus, Ban, ShieldCheck, CheckCircle2, AlertTriangle } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { pts, timeAgo, clockTime } from "@/lib/format";
import { Loading, ErrorNote, StatusPill } from "@/components/ui";

type Detail = {
  customer: { id: string; name: string | null; phone: string; balance: number; suspended: boolean; createdAt: string };
  suspendedReason: string | null;
  transactions: { id: string; amount: number; reason: string; type: string; balanceAfter: number; createdAt: string }[];
  sessions: { id: string; status: string; score: number | null; rewardPointsEarned: number; createdAt: string; game?: { name: string } }[];
  purchases: { id: string; status: string; pointsCredited: number; amountKobo: number; createdAt: string }[];
  integrity: { balance: number; ledgerSum: number; consistent: boolean };
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [suspendReason, setSuspendReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    const r = await api<Detail>(`/api/admin/customers/${id}`);
    setData(r);
  }, [id]);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function adjust(sign: 1 | -1) {
    setError(""); setMsg(""); setBusy(true);
    try {
      const value = sign * Math.abs(Number(amount));
      const res = await api<{ balance: number }>(`/api/admin/customers/${id}/adjust`, {
        method: "POST",
        body: { amount: value, reason },
      });
      setMsg(`Balance updated to ${pts(res.balance)} points.`);
      setAmount(""); setReason("");
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Adjustment failed.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleSuspend() {
    if (!data) return;
    setError(""); setMsg(""); setBusy(true);
    try {
      await api(`/api/admin/customers/${id}/suspend`, {
        method: "POST",
        body: { suspend: !data.customer.suspended, reason: suspendReason || undefined },
      });
      setSuspendReason("");
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Failed.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !data) return <Loading />;
  const c = data.customer;

  return (
    <div className="space-y-6">
      <Link href="/admin/customers" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-white">
        <ArrowLeft size={16} /> Customers
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#58cc02] to-[#1cb0f6] text-xl font-black text-black">
            {(c.name ?? c.phone).slice(0, 1).toUpperCase()}
          </div>
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black">
              {c.name ?? "Unnamed"}
              {c.suspended && <span className="pill bg-red-500/15 text-red-300"><Ban size={12} /> Suspended</span>}
            </h1>
            <p className="text-sm text-white/50">{c.phone} · joined {timeAgo(c.createdAt)}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-3xl font-black text-[#ffc800]">{pts(c.balance)}</p>
          <p className="text-xs text-white/45">points</p>
        </div>
      </div>

      {/* Integrity */}
      <div className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm ${data.integrity.consistent ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-300"}`}>
        {data.integrity.consistent ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />}
        Ledger integrity: balance {pts(data.integrity.balance)} {data.integrity.consistent ? "matches" : "≠"} ledger sum {pts(data.integrity.ledgerSum)}
      </div>

      {error && <ErrorNote message={error} />}
      {msg && <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-300">{msg}</div>}

      {/* Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 font-bold">Adjust points</h2>
          <p className="mb-3 text-xs text-white/45">A reason is required. Creates an audited ledger entry.</p>
          <div className="space-y-3">
            <input type="number" className="input" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <input className="input" placeholder="Reason (required)" value={reason} onChange={(e) => setReason(e.target.value)} />
            <div className="flex gap-2">
              <button className="btn-primary flex-1" disabled={busy || !amount || reason.length < 3} onClick={() => adjust(1)}>
                <Plus size={16} /> Add
              </button>
              <button className="btn-danger flex-1" disabled={busy || !amount || reason.length < 3} onClick={() => adjust(-1)}>
                <Minus size={16} /> Remove
              </button>
            </div>
          </div>
        </div>

        <div className="card p-4">
          <h2 className="mb-3 font-bold">Account status</h2>
          <p className="mb-3 text-xs text-white/45">
            {c.suspended ? `Suspended: ${data.suspendedReason ?? "—"}` : "Active — can play and spend."}
          </p>
          {!c.suspended && (
            <input className="input mb-3" placeholder="Suspension reason (optional)" value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} />
          )}
          <button className={c.suspended ? "btn-primary w-full" : "btn-danger w-full"} disabled={busy} onClick={toggleSuspend}>
            {c.suspended ? <><ShieldCheck size={16} /> Reinstate account</> : <><Ban size={16} /> Suspend account</>}
          </button>
        </div>
      </div>

      {/* History */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card p-4">
          <h2 className="mb-3 font-bold">Wallet ledger</h2>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {data.transactions.map((t) => (
              <div key={t.id} className="flex items-center justify-between border-b border-white/5 py-2 text-sm last:border-0">
                <div className="min-w-0">
                  <p className="truncate">{t.reason}</p>
                  <p className="text-xs text-white/40">{clockTime(t.createdAt)} · bal {pts(t.balanceAfter)}</p>
                </div>
                <span className={`font-bold ${t.amount >= 0 ? "text-emerald-300" : "text-white/80"}`}>{t.amount >= 0 ? "+" : ""}{t.amount}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <h2 className="mb-3 font-bold">Sessions</h2>
          <div className="max-h-80 space-y-1 overflow-y-auto">
            {data.sessions.length === 0 && <p className="text-sm text-white/40">No sessions.</p>}
            {data.sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between border-b border-white/5 py-2 text-sm last:border-0">
                <div>
                  <p className="font-medium">{s.game?.name ?? "—"}</p>
                  <p className="text-xs text-white/40">{clockTime(s.createdAt)}{s.score != null ? ` · score ${s.score}` : ""}{s.rewardPointsEarned ? ` · +${s.rewardPointsEarned} reward` : ""}</p>
                </div>
                <StatusPill status={s.status} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
