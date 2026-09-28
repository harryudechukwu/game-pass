"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Wallet, Gift, IconContext } from "@phosphor-icons/react";
import { api, ApiClientError } from "@/lib/client";
import { Loading, ErrorNote } from "@/components/ui";

type Purchase = { id: string; name: string; amountLabel: string; quantity: number; createdAt: string; kind: string };
type RewardRow = { id: string; name: string; spendRequiredLabel: string; unlocked: boolean; redeemed: boolean; status: string };
type Data = {
  member: { firstName: string | null; name: string | null; phone: string; spentLabel: string; gamesPlayed: number };
  purchases: Purchase[];
  rewards: RewardRow[];
};

export default function MemberHistoryPage() {
  const { phone } = useParams<{ phone: string }>();
  const router = useRouter();
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await api<Data>(`/api/attendant/member?phone=${encodeURIComponent(phone)}`));
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 401) { router.replace("/attendant/login"); return; }
      setError(e instanceof ApiClientError ? e.message : "Could not load member history.");
    }
  }, [phone, router]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  if (loading) return <Loading />;

  return (
    <IconContext.Provider value={{ weight: "duotone" }}>
      <main className="mx-auto min-h-screen max-w-2xl px-6 py-6">
        <button onClick={() => router.back()} className="mb-4 inline-flex items-center gap-2 text-sm text-white/50 hover:text-white"><ArrowLeft size={16} /> Back to desk</button>
        {error && <ErrorNote message={error} />}
        {data && (
          <div className="space-y-4">
            <div className="card p-5">
              <p className="text-lg font-black">{data.member.name ?? "Member"}</p>
              <p className="text-sm text-white/50">{data.member.phone} · {data.member.gamesPlayed} games played</p>
              <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#e3f3fd] px-4 py-2 text-[#0d47a1]"><Wallet size={20} /> <span className="text-sm">Total spent</span> <b className="text-lg">{data.member.spentLabel}</b></div>
            </div>

            <div className="card p-5">
              <h2 className="mb-3 flex items-center gap-2 font-bold"><Gift size={18} /> Rewards</h2>
              <div className="space-y-2">
                {data.rewards.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate">{r.name} <span className="text-white/40">· {r.spendRequiredLabel}</span></span>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${r.redeemed ? "bg-[#e3f3fd] text-[#0d47a1]" : r.unlocked ? "bg-emerald-400/15 text-emerald-500" : "text-white/45"}`}>{r.status}</span>
                  </div>
                ))}
                {data.rewards.length === 0 && <p className="text-sm text-white/40">No rewards set up.</p>}
              </div>
            </div>

            <div className="card p-5">
              <h2 className="mb-3 font-bold">Purchase history</h2>
              <div className="divide-y divide-white/5">
                {data.purchases.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <span className="truncate">{p.name}{p.quantity > 1 ? ` ×${p.quantity}` : ""}</span>
                    <span className="shrink-0 text-white/60">{p.amountLabel}</span>
                  </div>
                ))}
                {data.purchases.length === 0 && <p className="py-2 text-sm text-white/40">No purchases yet.</p>}
              </div>
            </div>
          </div>
        )}
      </main>
    </IconContext.Provider>
  );
}
