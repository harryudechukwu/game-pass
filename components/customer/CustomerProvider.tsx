"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Gamepad2 } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { Loading } from "@/components/ui";
import { BottomNav } from "@/components/customer/BottomNav";
import { ThemeToggle } from "@/components/ThemeToggle";

export type Player = { id: string; phone: string; name: string | null; firstName: string | null };

type Ctx = {
  player: Player;
  gamesPlayed: number;
  claimable: number;
  refresh: () => Promise<void>;
};

const CustomerCtx = createContext<Ctx | null>(null);

export function useCustomer(): Ctx {
  const ctx = useContext(CustomerCtx);
  if (!ctx) throw new Error("useCustomer must be used within CustomerProvider");
  return ctx;
}

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [player, setPlayer] = useState<Player | null>(null);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [claimable, setClaimable] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ player: Player; gamesPlayed: number; claimable: number }>("/api/me");
      setPlayer(res.player);
      setGamesPlayed(res.gamesPlayed);
      setClaimable(res.claimable);
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 401) {
        router.replace("/login");
        return;
      }
      throw e;
    }
  }, [router]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    // Reflect games the attendant logs (possibly in another tab).
    const t = setInterval(() => refresh().catch(() => {}), 4000);
    return () => clearInterval(t);
  }, [refresh]);

  if (loading || !player) {
    return (
      <div className="mx-auto max-w-md">
        <Loading label="Loading…" />
      </div>
    );
  }

  return (
    <CustomerCtx.Provider value={{ player, gamesPlayed, claimable, refresh }}>
      <div className="mx-auto flex min-h-screen max-w-md flex-col">
        <Header name={player.firstName ?? player.phone} gamesPlayed={gamesPlayed} />
        <div className="flex-1 px-4 pb-28 pt-3">{children}</div>
        <BottomNav claimable={claimable} />
      </div>
    </CustomerCtx.Provider>
  );
}

function Header({ name, gamesPlayed }: { name: string; gamesPlayed: number }) {
  const router = useRouter();
  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/10 bg-[#0a0e1a]/80 px-4 py-3 backdrop-blur">
      <div className="min-w-0">
        <p className="text-xs text-white/45">Signed in</p>
        <p className="truncate text-sm font-semibold">Hi, {name} 👋</p>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[#58cc02]/30 bg-[#58cc02]/10 px-3 py-1.5 text-sm font-bold text-[#58cc02]">
          <Gamepad2 size={15} /> {gamesPlayed}
        </span>
        <ThemeToggle />
        <button onClick={logout} aria-label="Sign out" className="rounded-full border border-white/10 bg-white/5 p-2 text-white/50 hover:text-white">
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
