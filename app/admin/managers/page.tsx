"use client";

import { useEffect, useState } from "react";
import { UserGear, Plus, X } from "@phosphor-icons/react";
import { api, ApiClientError } from "@/lib/client";
import { Loading, ErrorNote, Reveal } from "@/components/ui";

type Manager = { id: string; name: string; email: string; password: string; active: boolean };

export default function AdminManagersPage() {
  const [rows, setRows] = useState<Manager[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function load() { setRows((await api<{ managers: Manager[] }>("/api/admin/managers")).managers); }
  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  async function setActive(m: Manager, active: boolean) {
    setError("");
    try { await api(`/api/admin/managers/${m.id}`, { method: "PATCH", body: { active } }); await load(); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Update failed."); }
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-5">
      <div className="admin-head flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Managers</h1>
          <p className="text-sm text-white/50">Limited operators — they manage the catalogue &amp; correct sales, but can&apos;t see full admin data. Only you (admin) can add them.</p>
        </div>
        <button className="btn-primary w-full md:w-auto" onClick={() => setCreating(true)}><Plus size={18} /> New manager</button>
      </div>

      {error && <ErrorNote message={error} />}

      <div className="card divide-y divide-white/5">
        {rows.length === 0 && <p className="p-6 text-center text-sm text-white/40">No managers yet.</p>}
        {rows.map((m) => (
          <div key={m.id} className={`flex items-center gap-4 px-4 py-3 ${m.active ? "" : "opacity-60"}`}>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e3f3fd] text-[#0d47a1]"><UserGear size={22} weight="duotone" /></div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 truncate font-medium">{m.name}{!m.active && <span className="pill">Inactive</span>}</p>
              <p className="text-xs text-white/45">{m.email}</p>
              <div className="mt-1"><Reveal label="Password" value={m.password} /></div>
            </div>
            <button className="btn-ghost !px-2.5 !py-1.5 !text-xs" onClick={() => setActive(m, !m.active)}>{m.active ? "Deactivate" : "Reactivate"}</button>
          </div>
        ))}
      </div>

      {creating && <ManagerForm onClose={() => setCreating(false)} onSaved={async () => { setCreating(false); await load(); }} />}
    </div>
  );
}

function ManagerForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/managers", { method: "POST", body: form });
      onSaved();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Save failed."); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#141a2e] p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">New manager</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X size={20} /></button>
        </div>
        {error && <div className="mb-4"><ErrorNote message={error} /></div>}
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ada" /></div>
          <div><label className="label">Email</label><input className="input" type="email" autoCapitalize="none" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="e.g. ada@creamycastle.test" /></div>
          <div><label className="label">Password</label><input className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Set a password" /></div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy || !form.name || !form.email || !form.password}>{busy ? "Saving…" : "Create"}</button>
        </div>
      </div>
    </div>
  );
}
