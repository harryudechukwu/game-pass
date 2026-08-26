"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";
import { LogOut, Home, Gift, Gamepad2, Wallet } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { Loading } from "@/components/ui";
import { BottomNav } from "@/components/customer/BottomNav";
import { ThemeToggle } from "@/components/ThemeToggle";

export type Player = { id: string; phone: string; name: string | null; firstName: string | null };

type Ctx = {
  player: Player;
  spentKobo: number;
  spentLabel: string;
  activeSessions: number;
  claimable: number;
  refresh: () => Promise<void>;
};

const CustomerCtx = createContext<Ctx | null>(null);
export function useCustomer(): Ctx {
  const ctx = useContext(CustomerCtx);
  if (!ctx) throw new Error("useCustomer must be used within CustomerProvider");
  return ctx;
}

const NAV = [
  { href: "/home", label: "My Games", icon: Home },
  { href: "/rewards", label: "Rewards", icon: Gift },
];

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<Omit<Ctx, "refresh"> | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ player: Player; spentKobo: number; spentLabel: string; activeSessions: number; claimable: number }>("/api/me");
      setState({ player: res.player, spentKobo: res.spentKobo, spentLabel: res.spentLabel, activeSessions: res.activeSessions, claimable: res.claimable });
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 401) { router.replace("/login"); return; }
      throw e;
    }
  }, [router]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    const t = setInterval(() => refresh().catch(() => {}), 4000);
    return () => clearInterval(t);
  }, [refresh]);

  if (loading || !state) return <div className="mx-auto max-w-md"><Loading label="Loading…" /></div>;

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }

  return (
    <CustomerCtx.Provider value={{ ...state, refresh }}>
      <div className="min-h-screen md:flex">
        {/* Desktop sidebar (theme-aware chrome: white in light, dark in dark) */}
        <aside className="chrome sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-white/10 p-4 md:flex">
          <Link href="/home" className="mb-8 flex items-center gap-2 px-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#58cc02] to-[#1cb0f6] text-black"><Gamepad2 size={18} /></span>
            <span className="font-black">Game Pass</span>
          </Link>
          <nav className="flex-1 space-y-1">
            {NAV.map((n) => <DesktopNavLink key={n.href} {...n} badge={n.href === "/rewards" ? state.claimable : 0} />)}
          </nav>
          <div className="border-t border-white/10 pt-3">
            <div className="flex items-center justify-between px-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{state.player.firstName ?? state.player.phone}</p>
                <p className="truncate text-xs text-white/40">{state.player.phone}</p>
              </div>
              <ThemeToggle />
            </div>
            <button onClick={logout} className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white">
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </aside>

        {/* Mobile header */}
        <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/10 bg-[#0a0e1a]/80 px-4 py-3 backdrop-blur md:hidden">
          <div className="min-w-0">
            <p className="text-xs text-white/45">Signed in</p>
            <p className="truncate text-sm font-semibold">Hi, {state.player.firstName ?? state.player.phone} 👋</p>
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={logout} aria-label="Sign out" className="rounded-full border border-white/10 bg-white/5 p-2 text-white/50 hover:text-white">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-4xl px-4 pb-28 pt-4 md:px-8 md:pb-10 md:pt-8">{children}</div>
        </main>

        <BottomNav claimable={state.claimable} />
      </div>
    </CustomerCtx.Provider>
  );
}

function DesktopNavLink({ href, label, icon: Icon, badge }: { href: string; label: string; icon: React.ComponentType<{ size?: number }>; badge: number }) {
  const pathname = usePathname();
  const active = pathname === href;
  return (
    <Link href={href} className={clsx("flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition", active ? "bg-[#58cc02]/15 text-white" : "text-white/55 hover:bg-white/5 hover:text-white")}>
      <Icon size={18} /> {label}
      {badge > 0 && <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff4b4b] px-1.5 text-[11px] font-black text-white">{badge}</span>}
    </Link>
  );
}
