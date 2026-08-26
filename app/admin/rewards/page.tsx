"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, X, Power, Gift, Trash2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { Loading, ErrorNote } from "@/components/ui";

type Reward = {
  id: string;
  name: string;
  description: string | null;
  spendRequiredKobo: number;
  spendRequiredLabel: string;
  active: boolean;
};

export default function AdminRewardsPage() {
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Reward> | null>(null);
  const [error, setError] = useState("");

  async function load() { setRewards((await api<{ rewards: Reward[] }>("/api/admin/rewards")).rewards); }
  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  async function toggle(r: Reward) { await api(`/api/admin/rewards/${r.id}`, { method: "PATCH", body: { active: !r.active } }); await load(); }
  async function remove(r: Reward) {
    setError("");
    try { await api(`/api/admin/rewards/${r.id}`, { method: "DELETE" }); await load(); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Delete failed."); }
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Rewards</h1>
          <p className="text-sm text-white/50">Milestones unlocked once a player&apos;s total spend reaches the threshold.</p>
        </div>
        <button className="btn-primary" onClick={() => setEditing({ spendRequiredKobo: 500000, active: true })}><Plus size={18} /> New reward</button>
      </div>

      {error && <ErrorNote message={error} />}

      <div className="grid gap-3 md:grid-cols-2">
        {rewards.map((r) => (
          <div key={r.id} className={`card p-4 ${!r.active ? "opacity-60" : ""}`}>
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#ffc800]/15 text-[#ffc800]"><Gift size={18} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-bold">{r.name}</h3>
                  <span className="pill shrink-0 bg-white/5 text-white/60">spend {r.spendRequiredLabel}</span>
                </div>
                <p className="text-xs text-white/45">{r.description}</p>
                <div className="mt-3 flex gap-1">
                  <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => toggle(r)}><Power size={13} /> {r.active ? "Disable" : "Enable"}</button>
                  <button className="btn-ghost !px-2 !py-1 text-xs" onClick={() => setEditing(r)}><Pencil size={13} /> Edit</button>
                  <button className="btn-danger !px-2 !py-1 text-xs" onClick={() => remove(r)}><Trash2 size={13} /></button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && <RewardForm initial={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}
    </div>
  );
}

function RewardForm({ initial, onClose, onSaved }: { initial: Partial<Reward>; onClose: () => void; onSaved: () => void }) {
  const isEdit = Boolean(initial.id);
  const [form, setForm] = useState({
    name: initial.name ?? "",
    description: initial.description ?? "",
    spendNaira: initial.spendRequiredKobo != null ? Math.round(initial.spendRequiredKobo / 100) : 5000,
    active: initial.active ?? true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true); setError("");
    const payload = { name: form.name, description: form.description || null, spendRequiredKobo: Number(form.spendNaira) * 100, active: form.active };
    try {
      if (isEdit) await api(`/api/admin/rewards/${initial.id}`, { method: "PATCH", body: payload });
      else await api("/api/admin/rewards", { method: "POST", body: payload });
      onSaved();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Save failed."); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#141a2e] p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">{isEdit ? "Edit reward" : "New reward"}</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X size={20} /></button>
        </div>
        {error && <div className="mb-4"><ErrorNote message={error} /></div>}
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Free Game Token" /></div>
          <div><label className="label">Description</label><input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div><label className="label">Spend required to unlock (₦)</label><input type="number" min={1} className="input" value={form.spendNaira} onChange={(e) => setForm({ ...form, spendNaira: e.target.value as never })} /></div>
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
