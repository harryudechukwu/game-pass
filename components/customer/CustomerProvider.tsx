"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";
import { RefreshCw, Menu, X } from "lucide-react";
import { SignOut as LogOut } from "@phosphor-icons/react";
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
  { href: "/home", label: "Home", img: "/img/home.svg" },
  { href: "/rewards", label: "Rewards", img: "/img/reward.svg" },
];

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<Omit<Ctx, "refresh"> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => { setMenuOpen(false); }, [pathname]);

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

  function logout() {
    void api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }

  if (loading && !state) {
    return (
      <div className="gp-app" aria-busy="true">
        <div className="gp-main">
          <header className="gp-head">
            <div className="skel" style={{ height: 28, width: 160, borderRadius: 9, background: "#cfe0fb" }} />
            <div className="skel" style={{ height: 16, width: 230, maxWidth: "80%", borderRadius: 6, marginTop: 10, background: "#cfe0fb" }} />
          </header>
          <div className="gp-sheet">
            <div className="skel" style={{ height: 150, borderRadius: 20, marginBottom: 22, border: "1px solid #bbdefb" }} />
            <div className="skel" style={{ height: 18, width: 180, borderRadius: 6, marginBottom: 14, background: "#cfe0fb" }} />
            {[0, 1, 2].map((i) => (
              <div key={i} className="skel" style={{ height: 66, borderRadius: 15, marginBottom: 10, border: "1px solid #bbdefb" }} />
            ))}
          </div>
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
          <nav className="gp-side-nav">
            {NAV.map((n) => {
              const active = pathname === n.href || pathname.startsWith(n.href + "/");
              return (
                <Link key={n.href} href={n.href} className={clsx("gp-side-link", active && "gp-side-link--on")}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={n.img} alt="" width={22} height={22} /> {n.label}
                  {n.href === "/rewards" && state.claimable > 0 && <span className="gp-badge">{state.claimable}</span>}
                </Link>
              );
            })}
          </nav>
          <div className="gp-side-foot">
            <button className="gp-side-signout" onClick={logout}><LogOut size={17} weight="duotone" /> Sign out</button>
          </div>
        </aside>

        <header className="gp-topbar" />

        <button className="gp-hamburger" onClick={() => setMenuOpen((o) => !o)} aria-label="Menu" aria-expanded={menuOpen}>
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <nav className={clsx("gp-menu", menuOpen && "gp-menu--open")} aria-hidden={!menuOpen} onClick={() => setMenuOpen(false)}>
          <div className="gp-menu-inner">
            {NAV.map((n) => {
              const active = pathname === n.href || pathname.startsWith(n.href + "/");
              return (
                <Link key={n.href} href={n.href} className={clsx("gp-menu-item", active && "gp-menu-item--on")} onClick={() => setMenuOpen(false)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={n.img} alt="" width={24} height={24} /> {n.label}
                  {n.href === "/rewards" && state.claimable > 0 && <span className="gp-badge" style={{ marginLeft: "auto" }}>{state.claimable}</span>}
                </Link>
              );
            })}
            <button className="gp-menu-item gp-menu-logout" onClick={() => { setMenuOpen(false); logout(); }}>
              <LogOut size={22} weight="duotone" /> Log out
            </button>
          </div>
        </nav>

        <div className="gp-main">
          {children}
        </div>
      </div>
    </CustomerCtx.Provider>
  );
}
