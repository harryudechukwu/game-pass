"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash as Trash2, X, Star } from "@phosphor-icons/react";
import { api, ApiClientError } from "@/lib/client";
import { Loading, ErrorNote, StatusPill } from "@/components/ui";
import { durationLabel } from "@/lib/format";

type Game = {
  id: string; name: string; description: string; category: "kids" | "teen"; icon: string;
  location: string; priceKobo: number; priceLabel: string; durationMinutes: number;
  minAge: number | null; minHeightCm: number | null; instructions: string | null;
  rules: string | null; safety: string | null; status: string; featured: boolean;
};

const STATUSES = ["active", "maintenance", "inactive"];

export default function AdminGamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Game> | null>(null);
  const [error, setError] = useState("");

  async function load() { setGames((await api<{ games: Game[] }>("/api/admin/games")).games); }
  useEffect(() => { load().finally(() => setLoading(false)); }, []);

  async function setStatus(g: Game, status: string) { await api(`/api/admin/games/${g.id}`, { method: "PATCH", body: { status } }); await load(); }
  async function remove(g: Game) {
    setError("");
    try { await api(`/api/admin/games/${g.id}`, { method: "DELETE" }); await load(); }
    catch (e) { setError(e instanceof ApiClientError ? e.message : "Delete failed."); }
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-5">
      <div className="admin-head flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Games</h1>
          <p className="text-sm text-white/50">{games.length} games · Kids &amp; Teenager categories</p>
        </div>
        <button className="btn-primary w-full md:w-auto" onClick={() => setEditing({ priceKobo: 100000, durationMinutes: 60 })}>
          <Plus size={18} /> New game
        </button>
      </div>

      {error && <ErrorNote message={error} />}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {games.map((g) => (
          <div key={g.id} className="card p-4">
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-bold">{g.name}</h3>
                  {g.featured && <Star size={14} className="shrink-0 text-[#0d47a1]" />}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <StatusPill status={g.status} />
                  <span className="pill">{g.priceLabel}</span>
                  <span className="pill">{durationLabel(g.durationMinutes)}</span>
                </div>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <select value={g.status} onChange={(e) => setStatus(g, e.target.value)} className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs">
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button className="btn-ghost flex-1 !py-1.5 text-xs" onClick={() => setEditing(g)}><Pencil size={14} /> Edit</button>
              <button className="btn-danger !px-2.5 !py-1.5" onClick={() => remove(g)} aria-label="Delete"><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>

      {editing && <GameForm initial={editing} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} />}
    </div>
  );
}

function GameForm({ initial, onClose, onSaved }: { initial: Partial<Game>; onClose: () => void; onSaved: () => void }) {
  const isEdit = Boolean(initial.id);
  const initDur = initial.durationMinutes ?? 60;
  const [form, setForm] = useState({
    name: initial.name ?? "",
    priceNaira: initial.priceKobo != null ? Math.round(initial.priceKobo / 100) : 1000,
    durationMode: (initDur <= 0 ? "unlimited" : initDur === 60 ? "hourly" : "minutes") as "minutes" | "hourly" | "unlimited",
    minutes: initDur > 0 && initDur !== 60 ? initDur : 30,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    setBusy(true); setError("");
    const durationMinutes = form.durationMode === "unlimited" ? 0 : form.durationMode === "hourly" ? 60 : Math.max(1, Math.round(Number(form.minutes)) || 1);
    const payload = {
      name: form.name,
      priceKobo: Number(form.priceNaira) * 100,
      durationMinutes,
    };
    try {
      if (isEdit) await api(`/api/admin/games/${initial.id}`, { method: "PATCH", body: payload });
      else await api("/api/admin/games", { method: "POST", body: payload });
      onSaved();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Save failed."); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-4 w-full max-w-md rounded-3xl border border-white/10 bg-[#141a2e] p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">{isEdit ? "Edit game" : "New game"}</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X size={20} /></button>
        </div>
        {error && <div className="mb-4"><ErrorNote message={error} /></div>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field className="sm:col-span-2" label="Name"><input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus /></Field>
          <Field label="Price (₦)"><input type="number" className="input" value={form.priceNaira} onChange={(e) => set("priceNaira", e.target.value as never)} /></Field>
          <Field label="Duration">
            <select className="input" value={form.durationMode} onChange={(e) => set("durationMode", e.target.value as never)}>
              <option value="minutes">Minutes</option>
              <option value="hourly">Hourly</option>
              <option value="unlimited">Unlimited</option>
            </select>
          </Field>
          {form.durationMode === "minutes" && (
            <Field label="Minutes"><input type="number" className="input" min={1} value={form.minutes} onChange={(e) => set("minutes", e.target.value as never)} /></Field>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy || !form.name}>{busy ? "Saving…" : isEdit ? "Save changes" : "Create game"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><label className="label">{label}</label>{children}</div>;
}
