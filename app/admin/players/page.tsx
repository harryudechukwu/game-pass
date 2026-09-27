"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MagnifyingGlass as Search, CaretRight as ChevronRight, Gift } from "@phosphor-icons/react";
import { api } from "@/lib/client";
import { Loading } from "@/components/ui";

type Row = {
  id: string;
  phone: string;
  name: string | null;
  spentLabel: string;
  gamesPlayed: number;
  redemptions: number;
  createdAt: string;
};

export default function AdminPlayersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(query = "") {
    const r = await api<{ players: Row[] }>(`/api/admin/players${query ? `?q=${encodeURIComponent(query)}` : ""}`);
    setRows(r.players);
  }
  useEffect(() => { load().finally(() => setLoading(false)); }, []);
  useEffect(() => { const t = setTimeout(() => load(q), 250); return () => clearTimeout(t); }, [q]);

  return (
    <div className="space-y-5">
      <div className="admin-head">
        <h1 className="text-2xl font-black tracking-tight">Players</h1>
        <p className="text-sm text-white/50">Ranked by amount spent.</p>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input className="input pl-9" placeholder="Search by name or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {loading ? (
        <Loading />
      ) : (
        <div className="card divide-y divide-white/5">
          {rows.length === 0 && <p className="p-6 text-center text-sm text-white/40">No players found.</p>}
          {rows.map((c) => (
            <Link key={c.id} href={`/admin/players/${c.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-white/5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#e3f3fd] text-sm font-bold text-[#0d47a1]">
                {(c.name ?? c.phone).slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{c.name ?? "Unnamed player"}</p>
                <p className="text-xs text-white/45">{c.phone} · {c.gamesPlayed} games</p>
              </div>
              {c.redemptions > 0 && <span className="pill bg-[#ffc800]/15 text-[#ffc800]"><Gift size={11} /> {c.redemptions}</span>}
              <div className="text-right">
                <p className="font-bold text-[#0d47a1]">{c.spentLabel}</p>
                <p className="text-[11px] text-white/40">spent</p>
              </div>
              <ChevronRight size={16} className="text-white/30" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
