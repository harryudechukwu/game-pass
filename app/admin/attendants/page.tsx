"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, X, ScanLine } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { timeAgo } from "@/lib/format";
import { Loading, ErrorNote } from "@/components/ui";

type Attendant = { id: string; name: string; username: string; createdAt: string };

export default function AdminAttendantsPage() {
  const [rows, setRows] = useState<Attendant[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function load() { setRows((await api<{ attendants: Attendant[] }>("/api/admin/attendants")).attendants); }
  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  async function remove(a: Attendant) {
    setError("");
    try { await api(`/api/admin/attendants/${a.id}`, { method: "DELETE" }); await load(); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Delete failed."); }
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Attendants</h1>
          <p className="text-sm text-white/50">Staff who log games &amp; items. Each has their own sign-in.</p>
        </div>
        <button className="btn-primary" onClick={() => setCreating(true)}><Plus size={18} /> New attendant</button>
      </div>

      {error && <ErrorNote message={error} />}

      <div className="card divide-y divide-white/5">
        {rows.length === 0 && <p className="p-6 text-center text-sm text-white/40">No attendants yet.</p>}
        {rows.map((a) => (
          <div key={a.id} className="flex items-center gap-4 px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#2f6bff] to-[#1cb0f6] text-white"><ScanLine size={18} /></div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{a.name}</p>
              <p className="text-xs text-white/45">@{a.username} · added {timeAgo(a.createdAt)}</p>
            </div>
            <button className="btn-danger !px-2.5 !py-1.5" onClick={() => remove(a)} aria-label="Delete"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>

      {creating && <AttendantForm onClose={() => setCreating(false)} onSaved={async () => { setCreating(false); await load(); }} />}
    </div>
  );
}

function AttendantForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({ name: "", username: "", password: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/attendants", { method: "POST", body: form });
      onSaved();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Save failed."); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#141a2e] p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">New attendant</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X size={20} /></button>
        </div>
        {error && <div className="mb-4"><ErrorNote message={error} /></div>}
        <div className="space-y-4">
          <div><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ada" /></div>
          <div><label className="label">Username</label><input className="input" autoCapitalize="none" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="e.g. ada" /></div>
          <div><label className="label">Password</label><input className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Set a password" /></div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy || !form.name || !form.username || !form.password}>{busy ? "Saving…" : "Create"}</button>
        </div>
      </div>
    </div>
  );
}
