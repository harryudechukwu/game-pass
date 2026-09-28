"use client";

import { useEffect, useState } from "react";
import { Pencil, Minus, Plus, Check, X, ClockCounterClockwise as History } from "@phosphor-icons/react";
import { api, ApiClientError } from "@/lib/client";
import { timeAgo } from "@/lib/format";
import { Loading, ErrorNote } from "@/components/ui";

type Sale = {
  id: string;
  kind: string;
  name: string;
  quantity: number;
  amountLabel: string;
  createdAt: string;
  player: { firstName: string | null; phone: string } | null;
  edited: boolean;
  editedByName: string | null;
  originalQuantity: number | null;
  originalAmountLabel: string | null;
  voided: boolean;
  voidedByName: string | null;
};

export default function AdminSalesPage() {
  const [rows, setRows] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);

  async function load() { setRows((await api<{ sales: Sale[] }>("/api/admin/sales")).sales); }
  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  function startEdit(s: Sale) { setEditing(s.id); setQty(s.quantity); setError(""); }

  async function save(id: string) {
    setBusy(true); setError("");
    try {
      await api(`/api/admin/sales/${id}`, { method: "PATCH", body: { quantity: qty } });
      setEditing(null);
      await load();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not update the sale."); }
    finally { setBusy(false); }
  }

  async function voidSale(s: Sale) {
    if (!confirm(`Void "${s.name}"? It stays on record but is removed from revenue and the member's spend.`)) return;
    setError("");
    try {
      const res = await api<{ warning: string | null }>(`/api/admin/sales/${s.id}/void`, { method: "POST" });
      if (res.warning) alert(res.warning);
      await load();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Could not void the sale."); }
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-5">
      <div className="admin-head">
        <h1 className="text-2xl font-black tracking-tight">Sales</h1>
        <p className="text-sm text-white/50">Recent games &amp; items logged by attendants. Fix a quantity if one was recorded wrong — every correction is logged.</p>
      </div>

      {error && <ErrorNote message={error} />}

      <div className="card divide-y divide-white/5">
        {rows.length === 0 && <p className="p-6 text-center text-sm text-white/40">No sales yet.</p>}
        {rows.map((s) => (
          <div key={s.id} className={`px-4 py-3 ${s.voided ? "opacity-55" : ""}`}>
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className={`truncate font-medium ${s.voided ? "line-through" : ""}`}>{s.name}{s.quantity > 1 ? ` ×${s.quantity}` : ""}</p>
                <p className="text-xs text-white/45">{s.player ? (s.player.firstName ?? s.player.phone) : "—"} · {timeAgo(s.createdAt)}</p>
              </div>
              <span className={`shrink-0 font-bold ${s.voided ? "text-white/40 line-through" : "text-[#0d47a1]"}`}>{s.amountLabel}</span>
              {!s.voided && editing !== s.id && (
                <>
                  <button className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => startEdit(s)}><Pencil size={13} /> Fix qty</button>
                  <button className="btn-ghost !px-2.5 !py-1.5 text-xs" onClick={() => voidSale(s)}><X size={13} /> Void</button>
                </>
              )}
            </div>

            {editing === s.id && (
              <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
                <span className="text-sm text-white/60">{s.kind === "game" ? "Hours" : "Quantity"}</span>
                <div className="flex items-center gap-2">
                  <button className="rounded-lg border border-white/10 bg-white/5 p-1.5" onClick={() => setQty((n) => Math.max(1, n - 1))}><Minus size={14} /></button>
                  <span className="w-6 text-center font-bold">{qty}</span>
                  <button className="rounded-lg border border-white/10 bg-white/5 p-1.5" onClick={() => setQty((n) => n + 1)}><Plus size={14} /></button>
                </div>
                <div className="ml-auto flex items-center gap-2">
                  <button className="btn-ghost !px-2.5 !py-1.5" onClick={() => setEditing(null)} disabled={busy}><X size={14} /> Cancel</button>
                  <button className="btn-primary !px-3 !py-1.5" onClick={() => save(s.id)} disabled={busy || qty === s.quantity}><Check size={14} /> Save</button>
                </div>
              </div>
            )}

            {s.edited && editing !== s.id && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-2.5 py-1 text-xs text-amber-300">
                <History size={12} /> Corrected from ×{s.originalQuantity} ({s.originalAmountLabel}){s.editedByName ? ` by ${s.editedByName}` : ""}
              </p>
            )}
            {s.voided && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-red-400/10 px-2.5 py-1 text-xs text-red-300">
                <X size={12} /> Voided{s.voidedByName ? ` by ${s.voidedByName}` : ""} — removed from revenue &amp; spend
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
