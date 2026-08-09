"use client";

import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Gamepad2, Trophy, Wallet as WalletIcon } from "lucide-react";
import { api } from "@/lib/client";
import { pts, dayLabel, clockTime } from "@/lib/format";
import { Loading } from "@/components/ui";

type Txn = {
  id: string;
  amount: number;
  type: string;
  reason: string;
  balanceAfter: number;
  createdAt: string;
};
type Session = { id: string; status: string };

export default function ActivityPage() {
  const [txns, setTxns] = useState<Txn[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ balance: number; transactions: Txn[]; sessions: Session[] }>("/api/activity")
      .then((r) => {
        setTxns(r.transactions);
        setSessions(r.sessions);
        setBalance(r.balance);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loading label="Loading activity…" />;

  const spent = txns.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const earned = txns.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const played = sessions.filter((s) => s.status === "completed").length;

  const groups = new Map<string, Txn[]>();
  for (const t of txns) {
    const key = dayLabel(t.createdAt);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }

  return (
    <div className="space-y-5 pt-1">
      <h1 className="text-2xl font-black tracking-tight">Activity</h1>

      <div className="grid grid-cols-3 gap-2">
        <Stat icon={Gamepad2} label="Games played" value={String(played)} />
        <Stat icon={ArrowDownRight} label="Points spent" value={pts(spent)} tone="down" />
        <Stat icon={ArrowUpRight} label="Points earned" value={pts(earned)} tone="up" />
      </div>

      {txns.length === 0 ? (
        <div className="card p-8 text-center text-white/50">No activity yet. Go play something!</div>
      ) : (
        [...groups.entries()].map(([day, items]) => (
          <section key={day}>
            <h2 className="mb-2 text-sm font-semibold text-white/50">{day}</h2>
            <div className="card divide-y divide-white/5">
              {items.map((t) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                  <TxnIcon type={t.type} positive={t.amount >= 0} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{t.reason}</p>
                    <p className="text-xs text-white/40">
                      {clockTime(t.createdAt)} · balance {pts(t.balanceAfter)}
                    </p>
                  </div>
                  <span className={`text-sm font-bold ${t.amount >= 0 ? "text-emerald-300" : "text-white/80"}`}>
                    {t.amount >= 0 ? "+" : ""}
                    {t.amount}
                  </span>
                </div>
              ))}
            </div>
          </section>
        ))
      )}

      <div className="card flex items-center justify-between p-4">
        <span className="text-sm text-white/60">Current balance</span>
        <span className="text-xl font-black">{pts(balance)} pts</span>
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  value: string;
  tone?: "up" | "down";
}) {
  const color = tone === "up" ? "text-emerald-300" : tone === "down" ? "text-white/80" : "text-white";
  return (
    <div className="card p-3 text-center">
      <Icon size={16} className={`mx-auto ${color}`} />
      <p className={`mt-1 text-lg font-black ${color}`}>{value}</p>
      <p className="text-[10px] uppercase tracking-wide text-white/40">{label}</p>
    </div>
  );
}

function TxnIcon({ type, positive }: { type: string; positive: boolean }) {
  const map: Record<string, React.ComponentType<{ size?: number }>> = {
    reward: Trophy,
    purchase: WalletIcon,
    play_spend: Gamepad2,
    signup_bonus: Trophy,
  };
  const Icon = map[type] ?? (positive ? ArrowUpRight : ArrowDownRight);
  return (
    <div
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
        positive ? "bg-emerald-400/15 text-emerald-300" : "bg-white/8 text-white/60"
      }`}
    >
      <Icon size={16} />
    </div>
  );
}
