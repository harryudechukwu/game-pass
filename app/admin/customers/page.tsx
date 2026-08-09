"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, ChevronRight, Ban } from "lucide-react";
import { api } from "@/lib/client";
import { pts } from "@/lib/format";
import { Loading } from "@/components/ui";

type Row = {
  id: string;
  name: string | null;
  phone: string;
  balance: number;
  suspended: boolean;
  sessions: number;
  createdAt: string;
};

export default function AdminCustomersPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(query = "") {
    const r = await api<{ customers: Row[] }>(`/api/admin/customers${query ? `?q=${encodeURIComponent(query)}` : ""}`);
    setRows(r.customers);
  }
  useEffect(() => {
    load().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-black tracking-tight">Customers</h1>
        <p className="text-sm text-white/50">Search, inspect wallets, adjust points.</p>
      </div>

      <div className="relative max-w-md">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          className="input pl-9"
          placeholder="Search by name or phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {loading ? (
        <Loading />
      ) : (
        <div className="card divide-y divide-white/5">
          {rows.length === 0 && <p className="p-6 text-center text-sm text-white/40">No customers found.</p>}
          {rows.map((c) => (
            <Link key={c.id} href={`/admin/customers/${c.id}`} className="flex items-center gap-4 px-4 py-3 hover:bg-white/5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#58cc02] to-[#1cb0f6] text-sm font-bold text-black">
                {(c.name ?? c.phone).slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate font-medium">
                  {c.name ?? "Unnamed"}
                  {c.suspended && <span className="pill bg-red-500/15 text-red-300"><Ban size={11} /> suspended</span>}
                </p>
                <p className="text-xs text-white/45">{c.phone} · {c.sessions} sessions</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-[#ffc800]">{pts(c.balance)}</p>
                <p className="text-[11px] text-white/40">points</p>
              </div>
              <ChevronRight size={16} className="text-white/30" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
