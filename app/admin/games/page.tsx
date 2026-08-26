"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2, X, Star } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { Loading, ErrorNote, StatusPill } from "@/components/ui";
import { CatalogTile, IconPicker } from "@/components/CatalogIcon";

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Games</h1>
          <p className="text-sm text-white/50">{games.length} games · Kids &amp; Teenager categories</p>
        </div>
        <button className="btn-primary" onClick={() => setEditing({ status: "active", category: "kids", icon: "gamepad", priceKobo: 100000, durationMinutes: 60 })}>
          <Plus size={18} /> New game
        </button>
      </div>

      {error && <ErrorNote message={error} />}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {games.map((g) => (
          <div key={g.id} className="card p-4">
            <div className="flex items-start gap-3">
              <CatalogTile name={g.icon} accent={g.category === "kids" ? "kids" : "teen"} className="h-14 w-14" size={26} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate font-bold">{g.name}</h3>
                  {g.featured && <Star size={13} className="shrink-0 text-[#ffc800]" />}
                </div>
                <p className="text-xs text-white/45">{g.location}</p>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <StatusPill status={g.status} />
                  <span className="pill bg-white/5 text-white/60 capitalize">{g.category}</span>
                  <span className="pill bg-[#58cc02]/15 text-[#58cc02]">{g.priceLabel}/hr</span>
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
  const [form, setForm] = useState({
    name: initial.name ?? "",
    description: initial.description ?? "",
    category: initial.category ?? "kids",
    icon: initial.icon ?? "gamepad",
    location: initial.location ?? "",
    priceNaira: initial.priceKobo != null ? Math.round(initial.priceKobo / 100) : 1000,
    durationMinutes: initial.durationMinutes ?? 60,
    minAge: initial.minAge ?? "",
    minHeightCm: initial.minHeightCm ?? "",
    instructions: initial.instructions ?? "",
    rules: initial.rules ?? "",
    safety: initial.safety ?? "",
    status: initial.status ?? "active",
    featured: initial.featured ?? false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) { setForm((f) => ({ ...f, [k]: v })); }

  async function save() {
    setBusy(true); setError("");
    const payload = {
      name: form.name, description: form.description, category: form.category, icon: form.icon, location: form.location,
      priceKobo: Number(form.priceNaira) * 100, durationMinutes: Number(form.durationMinutes),
      minAge: form.minAge === "" ? null : Number(form.minAge), minHeightCm: form.minHeightCm === "" ? null : Number(form.minHeightCm),
      instructions: form.instructions || null, rules: form.rules || null, safety: form.safety || null,
      status: form.status, featured: form.featured,
    };
    try {
      if (isEdit) await api(`/api/admin/games/${initial.id}`, { method: "PATCH", body: payload });
      else await api("/api/admin/games", { method: "POST", body: payload });
      onSaved();
    } catch (e) { setError(e instanceof ApiClientError ? e.message : "Save failed."); setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/60 p-4" onClick={onClose}>
      <div className="my-4 w-full max-w-2xl rounded-3xl border border-white/10 bg-[#141a2e] p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold">{isEdit ? "Edit game" : "New game"}</h2>
          <button onClick={onClose} className="text-white/50 hover:text-white"><X size={20} /></button>
        </div>
        {error && <div className="mb-4"><ErrorNote message={error} /></div>}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field className="sm:col-span-2" label="Name"><input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} /></Field>
          <Field className="sm:col-span-2" label="Description"><textarea className="input min-h-16" value={form.description} onChange={(e) => set("description", e.target.value)} /></Field>
          <Field label="Category">
            <select className="input" value={form.category} onChange={(e) => set("category", e.target.value as "kids" | "teen")}>
              <option value="kids">Kids Games</option>
              <option value="teen">Teenager Games</option>
            </select>
          </Field>
          <Field label="Location"><input className="input" value={form.location} onChange={(e) => set("location", e.target.value)} /></Field>
          <Field label="Price (₦ per hour)"><input type="number" className="input" value={form.priceNaira} onChange={(e) => set("priceNaira", e.target.value as never)} /></Field>
          <Field label="Duration per hour (minutes)"><input type="number" className="input" value={form.durationMinutes} onChange={(e) => set("durationMinutes", e.target.value as never)} /></Field>
          <Field label="Min age (blank = none)"><input type="number" className="input" value={form.minAge} onChange={(e) => set("minAge", e.target.value as never)} /></Field>
          <Field label="Min height cm (blank = none)"><input type="number" className="input" value={form.minHeightCm} onChange={(e) => set("minHeightCm", e.target.value as never)} /></Field>
          <Field className="sm:col-span-2" label="Icon"><IconPicker value={form.icon} onChange={(v) => set("icon", v)} /></Field>
          <Field className="sm:col-span-2" label="Instructions"><textarea className="input" value={form.instructions} onChange={(e) => set("instructions", e.target.value)} /></Field>
          <Field label="Rules"><textarea className="input" value={form.rules} onChange={(e) => set("rules", e.target.value)} /></Field>
          <Field label="Safety"><textarea className="input" value={form.safety} onChange={(e) => set("safety", e.target.value)} /></Field>
          <Field label="Status">
            <select className="input" value={form.status} onChange={(e) => set("status", e.target.value)}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select>
          </Field>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="h-4 w-4 accent-[#ffc800]" checked={form.featured} onChange={(e) => set("featured", e.target.checked)} /> Featured</label>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy || !form.name || !form.location}>{busy ? "Saving…" : isEdit ? "Save changes" : "Create game"}</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <div className={className}><label className="label">{label}</label>{children}</div>;
}
