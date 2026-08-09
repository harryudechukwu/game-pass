"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Pencil, Trash2, Upload, X, Star } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { pts } from "@/lib/format";
import { Loading, ErrorNote, StatusPill } from "@/components/ui";

type Game = {
  id: string;
  name: string;
  slug: string;
  description: string;
  imageUrl: string;
  pointCost: number;
  durationSeconds: number;
  minPlayers: number;
  maxPlayers: number;
  location: string;
  minAge: number | null;
  minHeightCm: number | null;
  instructions: string | null;
  rules: string | null;
  safety: string | null;
  status: string;
  selfServiceMode: boolean;
  featured: boolean;
};

const STATUSES = ["active", "maintenance", "inactive"];

export default function AdminGamesPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<Game> | null>(null);
  const [error, setError] = useState("");

  async function load() {
    const r = await api<{ games: Game[] }>("/api/admin/games");
    setGames(r.games);
  }
  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  async function setStatus(g: Game, status: string) {
    await api(`/api/admin/games/${g.id}`, { method: "PATCH", body: { status } });
    await load();
  }

  async function remove(g: Game) {
    setError("");
    try {
      await api(`/api/admin/games/${g.id}`, { method: "DELETE" });
      await load();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Delete failed.");
    }
  }

  if (loading) return <Loading />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Games</h1>
          <p className="text-sm text-white/50">{games.length} games in the catalogue</p>
        </div>
        <button className="btn-primary" onClick={() => setEditing({ status: "active", selfServiceMode: true, minPlayers: 1, maxPlayers: 1 })}>
          <Plus size={18} /> New game
        </button>
      </div>

      {error && <ErrorNote message={error} />}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {games.map((g) => (
          <div key={g.id} className="card overflow-hidden">
            <div className="relative aspect-[16/9] bg-gradient-to-br from-[#1c2340] to-[#0a0e1a]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.imageUrl} alt={g.name} className="h-full w-full object-cover" />
              <div className="absolute left-2 top-2 flex gap-1">
                <StatusPill status={g.status} />
                {g.featured && (
                  <span className="pill bg-[#ffc800]/20 text-[#ffc800]"><Star size={11} /> Featured</span>
                )}
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold">{g.name}</h3>
                  <p className="text-xs text-white/45">{g.location}</p>
                </div>
                <span className="pill bg-[#ffc800]/15 font-bold text-[#ffc800]">{pts(g.pointCost)}</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <select
                  value={g.status}
                  onChange={(e) => setStatus(g, e.target.value)}
                  className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-xs"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button className="btn-ghost flex-1 !py-1.5 text-xs" onClick={() => setEditing(g)}>
                  <Pencil size={14} /> Edit
                </button>
                <button className="btn-danger !px-2.5 !py-1.5" onClick={() => remove(g)} aria-label="Delete">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <GameForm
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await load();
          }}
        />
      )}
    </div>
  );
}

function GameForm({
  initial,
  onClose,
  onSaved,
}: {
  initial: Partial<Game>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = Boolean(initial.id);
  const [form, setForm] = useState({
    name: initial.name ?? "",
    description: initial.description ?? "",
    imageUrl: initial.imageUrl ?? "",
    pointCost: initial.pointCost ?? 30,
    durationMinutes: initial.durationSeconds ? Math.round(initial.durationSeconds / 60) : 5,
    minPlayers: initial.minPlayers ?? 1,
    maxPlayers: initial.maxPlayers ?? 1,
    location: initial.location ?? "",
    minAge: initial.minAge ?? "",
    minHeightCm: initial.minHeightCm ?? "",
    instructions: initial.instructions ?? "",
    rules: initial.rules ?? "",
    safety: initial.safety ?? "",
    status: initial.status ?? "active",
    selfServiceMode: initial.selfServiceMode ?? true,
    featured: initial.featured ?? false,
  });
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function upload(file: File) {
    setUploading(true);
    setError("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const json = await res.json();
      if (!json.ok) throw new Error(json.error?.message ?? "Upload failed");
      set("imageUrl", json.data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    setBusy(true);
    setError("");
    const payload = {
      name: form.name,
      description: form.description,
      imageUrl: form.imageUrl,
      pointCost: Number(form.pointCost),
      durationSeconds: Number(form.durationMinutes) * 60,
      minPlayers: Number(form.minPlayers),
      maxPlayers: Number(form.maxPlayers),
      location: form.location,
      minAge: form.minAge === "" ? null : Number(form.minAge),
      minHeightCm: form.minHeightCm === "" ? null : Number(form.minHeightCm),
      instructions: form.instructions || null,
      rules: form.rules || null,
      safety: form.safety || null,
      status: form.status,
      selfServiceMode: form.selfServiceMode,
      featured: form.featured,
    };
    try {
      if (isEdit) {
        await api(`/api/admin/games/${initial.id}`, { method: "PATCH", body: payload });
      } else {
        await api("/api/admin/games", { method: "POST", body: payload });
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiClientError ? e.message : "Save failed.");
      setBusy(false);
    }
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
          <Field className="sm:col-span-2" label="Name">
            <input className="input" value={form.name} onChange={(e) => set("name", e.target.value)} />
          </Field>
          <Field className="sm:col-span-2" label="Description">
            <textarea className="input min-h-20" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </Field>

          <Field className="sm:col-span-2" label="Image">
            <div className="flex gap-2">
              <input className="input" placeholder="https://… or upload" value={form.imageUrl} onChange={(e) => set("imageUrl", e.target.value)} />
              <button type="button" className="btn-ghost shrink-0" onClick={() => fileRef.current?.click()} disabled={uploading}>
                <Upload size={16} /> {uploading ? "…" : "Upload"}
              </button>
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            </div>
            {form.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={form.imageUrl} alt="" className="mt-2 h-24 w-full rounded-lg object-cover" />
            )}
          </Field>

          <Field label="Point cost">
            <input type="number" className="input" value={form.pointCost} onChange={(e) => set("pointCost", e.target.value as never)} />
          </Field>
          <Field label="Duration (minutes)">
            <input type="number" className="input" value={form.durationMinutes} onChange={(e) => set("durationMinutes", e.target.value as never)} />
          </Field>
          <Field label="Min players">
            <input type="number" className="input" value={form.minPlayers} onChange={(e) => set("minPlayers", e.target.value as never)} />
          </Field>
          <Field label="Max players">
            <input type="number" className="input" value={form.maxPlayers} onChange={(e) => set("maxPlayers", e.target.value as never)} />
          </Field>
          <Field className="sm:col-span-2" label="Location">
            <input className="input" value={form.location} onChange={(e) => set("location", e.target.value)} />
          </Field>
          <Field label="Min age (blank = none)">
            <input type="number" className="input" value={form.minAge} onChange={(e) => set("minAge", e.target.value as never)} />
          </Field>
          <Field label="Min height cm (blank = none)">
            <input type="number" className="input" value={form.minHeightCm} onChange={(e) => set("minHeightCm", e.target.value as never)} />
          </Field>
          <Field className="sm:col-span-2" label="Instructions">
            <textarea className="input" value={form.instructions} onChange={(e) => set("instructions", e.target.value)} />
          </Field>
          <Field label="Rules">
            <textarea className="input" value={form.rules} onChange={(e) => set("rules", e.target.value)} />
          </Field>
          <Field label="Safety requirements">
            <textarea className="input" value={form.safety} onChange={(e) => set("safety", e.target.value)} />
          </Field>
          <Field label="Status">
            <select className="input" value={form.status} onChange={(e) => set("status", e.target.value)}>
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <div className="flex items-end gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[#58cc02]" checked={form.selfServiceMode} onChange={(e) => set("selfServiceMode", e.target.checked)} />
              Self-service
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[#ffc800]" checked={form.featured} onChange={(e) => set("featured", e.target.checked)} />
              Featured
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn-primary" onClick={save} disabled={busy || !form.name || !form.imageUrl || !form.location}>
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create game"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="label">{label}</label>
      {children}
    </div>
  );
}
