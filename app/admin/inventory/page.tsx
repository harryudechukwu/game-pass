"use client";

import { useEffect, useState } from "react";
import { Package, Warning, Check } from "@phosphor-icons/react";
import { api, ApiClientError } from "@/lib/client";
import { Loading, ErrorNote } from "@/components/ui";

type Item = {
  id: string;
  name: string;
  priceLabel: string;
  active: boolean;
  stock: number | null;
  lowStockAt: number;
  low: boolean;
};

export default function AdminInventoryPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() { setItems((await api<{ items: Item[] }>("/api/admin/items")).items); }
  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  if (loading) return <Loading />;

  // Items that need attention float to the top.
  const sorted = [...items].sort((a, b) => Number(b.low) - Number(a.low) || a.name.localeCompare(b.name));
  const lowCount = items.filter((i) => i.low).length;

  return (
    <div className="space-y-5">
      <div className="admin-head flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Inventory</h1>
          <p className="text-sm text-white/50">Got new stock? Enter how many you added — it&apos;s summed onto what&apos;s left. Sales draw it down automatically.</p>
        </div>
      </div>

      {error && <ErrorNote message={error} />}
      {lowCount > 0 && (
        <div className="flex items-center gap-2 rounded-xl border border-b-[3px] border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">
          <Warning size={18} weight="duotone" /> {lowCount} item{lowCount > 1 ? "s" : ""} need restocking.
        </div>
      )}

      <div className="card divide-y divide-white/5">
        {items.length === 0 && <p className="p-6 text-center text-sm text-white/40">No items yet — add them on the Items page.</p>}
        {sorted.map((i) => <StockRow key={i.id} item={i} onError={setError} onSaved={load} />)}
      </div>
    </div>
  );
}

function StockRow({ item, onError, onSaved }: { item: Item; onError: (m: string) => void; onSaved: () => Promise<void> }) {
  const [add, setAdd] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const addNum = Math.round(Number(add));
  const valid = add.trim() !== "" && Number.isFinite(addNum) && addNum !== 0;
  const nextStock = Math.max(0, (item.stock ?? 0) + (valid ? addNum : 0));

  async function apply() {
    if (!valid) return;
    setBusy(true); onError("");
    try {
      await api(`/api/admin/items/${item.id}`, { method: "PATCH", body: { stock: nextStock } });
      setAdd("");
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      await onSaved();
    } catch (e) {
      onError(e instanceof ApiClientError ? e.message : "Could not update stock.");
    } finally {
      setBusy(false);
    }
  }

  const base = item.stock == null ? "not tracked"
    : item.stock <= 0 ? "out of stock"
    : item.low ? `low · ${item.stock} left`
    : `${item.stock} in stock`;

  return (
    <div className={`flex items-center gap-3 px-4 py-3 ${item.active ? "" : "opacity-60"}`}>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e3f3fd] text-[#0d47a1]"><Package size={20} weight="duotone" /></div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{item.name}{!item.active && <span className="pill ml-2">Disabled</span>}</p>
        {valid ? (
          <p className="text-xs font-bold text-[#0d47a1]">{item.stock ?? 0} + {addNum} → {nextStock}</p>
        ) : (
          <p className={`text-xs font-semibold ${item.stock != null && item.stock <= 0 ? "text-red-600" : item.low ? "text-amber-600" : "text-white/45"}`}>{item.priceLabel} · {base}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <input
          type="number"
          className="input w-24 text-center"
          value={add}
          onChange={(e) => setAdd(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") apply(); }}
          placeholder="Add qty"
        />
        <button className="btn-primary !px-3 !py-2 text-sm" onClick={apply} disabled={busy || !valid}>{saved ? <Check size={16} weight="bold" /> : "Add"}</button>
      </div>
    </div>
  );
}
