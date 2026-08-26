"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, X, Power } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { Loading, ErrorNote } from "@/components/ui";
import { CatalogTile, IconPicker } from "@/components/CatalogIcon";

type Item = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  priceKobo: number;
  priceLabel: string;
  active: boolean;
};

export default function AdminItemsPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Item> | null>(null);
  const [error, setError] = useState("");

  async function load() { setItems((await api<{ items: Item[] }>("/api/admin/items")).items); }
  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  async function toggle(i: Item) { await api(`/api/admin/items/${i.id}`, { method: "PATCH", body: { active: !i.active } }); await load(); }
  async function remove(i: Item) {
    setError("");
    try { await api(`/api/admin/items/${i.id}`, { method: "DELETE" }); await load(); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Delete failed."); }
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Items</h1>
          <p className="text-sm text-white/50">Things sold in the playground — attendants add these to a guest&apos;s spend.</p>
        </div>
        <button className="btn-primary" onClick={() => setEditing({ icon: "coins", priceKobo: 50000, active: true })}><Plus size={18} /> New item</button>
      </div>

      {error && <ErrorNote message={error} />}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((i) => (
          <div key={i.id} className={`card p-4 ${!i.active ? "opacity-60" : ""}`}>
            <div className="flex items-start gap-3">
              <CatalogTile name={i.icon} accent="item" className="h-12 w-12" size={24} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="truncate font-bold">{i.name}</h3>
                  <span className="pill shrink-0 bg-[#34d399]/15 text-[#34d399]">{i.priceLabel}</span>
                </div>
                <p className="text-xs text-white/45">{i.description}</p>
                <div className="mt-3 flex gap-1">
                  <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => toggle(i)}><Power size={13} /> {i.active ? "Disable" : "Enable"}</button>
                  <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setEditing(i)}><Pencil size={13} /> Edit</button>
                  <button className="btn-danger !px-2 !py-1 text-xs" onClick={() => remove(i)}><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && <ItemForm initial={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}
    </div>
  );
}

function ItemForm({ initial, onClose, onSaved }: { initial: Partial<Item>; onClose: () => void; onSaved: () => void }) {
  const isEdit = Boolean(initial.id);
  const [form, setForm] = useState({
    name: initial.name ?? "",
    description: initial.description ?? "",
    icon: initial.icon ?? "coins",
    priceNaira: initial.priceKobo != null ? Math.round(initial.priceKobo / 100) : 500,
    active: initial.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true); setError("");
    const payload = { name: form.name, description: form.description || null, icon: form.icon, priceKobo: Number(form.priceNaira) * 100, active: form.active };
    try {
      if (isEdit) await api(`/api/admin/items/${initial.id}`, { method: "PATCH", body: payload });
      else await api("/api/admin/items", { method: "POST", body: payload });
      onSaved();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Save failed."); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#141a2e] p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">{isEdit ? "Edit item" : "New item"}</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X size={20} /></button>
        </div>
        {error && <div className="mb-4"><ErrorNote message={error} /></div>}
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Bottled Water" /></div>
          <div><label className="label">Description</label><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><label className="label">Price (₦)</label><input type="number" className="input" value={form.priceNaira} onChange={(e) => setForm({ ...form, priceNaira: e.target.value as never })} /></div>
          <div><label className="label">Icon</label><IconPicker value={form.icon} onChange={(v) => setForm({ ...form, icon: v })} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#58cc02]" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Active</label>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy || !form.name}>{busy ? "Saving…" : "Save"}</button>
        </div>
      </div>
    </div>
  );
}
