"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";
import { LogOut, RefreshCw } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { Icon } from "@/components/Icon";

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
  { href: "/home", label: "Home", icon: "home" as const },
  { href: "/rewards", label: "Rewards", icon: "gift" as const },
];

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<Omit<Ctx, "refresh"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ player: Player; spentKobo: number; spentLabel: string; activeSessions: number; claimable: number }>("/api/me");
      setState({ player: res.player, spentKobo: res.spentKobo, spentLabel: res.spentLabel, activeSessions: res.activeSessions, claimable: res.claimable });
      setError(null);
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 401) { router.replace("/login"); return; }
      throw e;
    }
  }, [router]);

  const attempt = useCallback(() => {
    setLoading(true);
    refresh()
      .catch((e) => setError(e instanceof ApiClientError ? e.message : "We couldn't reach the server. Check your connection and try again."))
      .finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    attempt();
    const t = setInterval(() => refresh().catch(() => {}), 4000);
    return () => clearInterval(t);
  }, [attempt, refresh]);

  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }

  if (loading && !state) {
    return (
      <div className="gp-app gp-app--brand" style={{ display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "rgba(255,255,255,.85)", fontWeight: 600 }}>
          <RefreshCw size={18} className="animate-spin" /> Loading…
        </div>
      </div>
    );
  }
  if (!state) {
    return (
      <div className="gp-app gp-app--brand gp-signin">
        <div className="gp-logohex"><Icon name="joystick" size={44} /></div>
        <div>
          <p style={{ fontWeight: 700, fontSize: 17 }}>Can’t load your games right now</p>
          <p className="gp-hint" style={{ marginTop: 4 }}>{error ?? "The server didn’t respond. Please try again."}</p>
        </div>
        <button onClick={attempt} className="gp-cta" style={{ width: "auto", padding: "12px 18px", display: "inline-flex", alignItems: "center", gap: 8 }}>
          <RefreshCw size={15} /> Try again
        </button>
      </div>
    );
  }

  return (
    <CustomerCtx.Provider value={{ ...state, refresh }}>
      <div className="gp-app gp-app--shell">
        <aside className="gp-sidebar">
          <div className="gp-side-logo"><Icon name="joystick" size={26} /> Game Pass</div>
          <nav className="gp-side-nav">
            {NAV.map((n) => {
              const active = pathname === n.href;
              return (
                <Link key={n.href} href={n.href} className={clsx("gp-side-link", active && "gp-side-link--on")}>
                  <Icon name={n.icon} size={22} /> {n.label}
                  {n.href === "/rewards" && state.claimable > 0 && <span className="gp-badge">{state.claimable}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="gp-side-foot">
            <button className="gp-side-signout" onClick={logout}><LogOut size={17} /> Sign out</button>
          </div>
        </aside>

        <div className="gp-main">
          <button className="gp-signout" onClick={logout} aria-label="Sign out"><LogOut size={17} /></button>
          {children}
        </div>

        <nav className="gp-dock">
          <div className="gp-dock-inner">
            <div className="gp-navpill">
              {NAV.map((n) => {
                const active = pathname === n.href;
                return (
                  <Link key={n.href} href={n.href} className={clsx("gp-navb", active && "gp-navb--on")}>
                    {n.href === "/rewards" && state.claimable > 0 && <span className="gp-badge">{state.claimable}</span>}
                    <Icon name={n.icon} size={24} />
                    {n.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>
      </div>
    </CustomerCtx.Provider>
  );
}
