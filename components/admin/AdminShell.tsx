"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";
import { SquaresFour, GameController, ShoppingBag, Trophy, Users, ClockCounterClockwise, SignOut, ShieldCheck, Scan, UserGear, Receipt, ChartBar, ChartLineUp, IconContext, type Icon } from "@phosphor-icons/react";
import { api, ApiClientError } from "@/lib/client";
import { Loading } from "@/components/ui";

type Admin = { id: string; name: string; email: string; role: string };
const AdminCtx = createContext<Admin | null>(null);
export const useAdmin = () => useContext(AdminCtx);

const nav = [
  { href: "/admin/overview", label: "Overview", icon: ChartBar, roles: ["manager"] },
  { href: "/admin", label: "Dashboard", icon: SquaresFour, roles: ["admin", "staff"] },
  { href: "/admin/analytics", label: "Analytics", icon: ChartLineUp, roles: ["admin", "staff", "manager"] },
  { href: "/admin/games", label: "Games", icon: GameController, roles: ["admin", "staff", "manager"] },
  { href: "/admin/items", label: "Items", icon: ShoppingBag, roles: ["admin", "staff", "manager"] },
  { href: "/admin/sales", label: "Sales", icon: Receipt, roles: ["admin", "staff", "manager"] },
  { href: "/admin/rewards", label: "Rewards", icon: Trophy, roles: ["admin", "staff"] },
  { href: "/admin/attendants", label: "Attendants", icon: Scan, roles: ["admin", "staff", "manager"] },
  { href: "/admin/managers", label: "Managers", icon: UserGear, roles: ["admin"] },
  { href: "/admin/players", label: "Members", icon: Users, roles: ["admin", "staff", "manager"] },
  { href: "/admin/logs", label: "Logs", icon: ClockCounterClockwise, roles: ["admin", "staff"] },
];
// managers get a limited console: only the catalogue pages
const managerAllowed = (path: string) => ["/admin/overview", "/admin/analytics", "/admin/games", "/admin/items", "/admin/sales", "/admin/attendants", "/admin/players"].some((p) => path.startsWith(p));

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<{ admin: Admin }>("/api/admin/me")
      .then((r) => setAdmin(r.admin))
      .catch((e) => {
        if (e instanceof ApiClientError && e.status === 401) router.replace("/admin/login");
      })
      .finally(() => setLoading(false));
  }, [router]);

  // managers can't reach admin-only pages — bounce them to the catalogue
  useEffect(() => {
    if (admin?.role === "manager" && !managerAllowed(pathname)) router.replace("/admin/overview");
  }, [admin, pathname, router]);

  function logout() {
    // fire-and-forget: navigate immediately so sign-out feels instant
    void api("/api/admin/logout", { method: "POST" }).catch(() => {});
    router.replace("/admin/login");
  }

  if (loading) return <Loading label="Loading console…" />;
  if (!admin) return null;

  const visibleNav = nav.filter((n) => n.roles.includes(admin.role));

  return (
    <IconContext.Provider value={{ weight: "duotone" }}>
      <AdminCtx.Provider value={admin}>
      <div className="flex min-h-screen">
        {/* Sidebar (desktop) */}
        <aside className="no-print sticky top-0 hidden h-screen w-60 shrink-0 flex-col overflow-y-auto border-r border-[#e3f3fd] bg-white p-4 md:flex">
          <div className="mb-8 flex items-center gap-2 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#e3f3fd] text-[#0d47a1]">
              <ShieldCheck size={20} weight="duotone" />
            </div>
            <span className="font-black">Operator</span>
          </div>
          <nav className="flex-1 space-y-1">
            {visibleNav.map((n) => (
              <NavLink key={n.href} {...n} active={isActive(pathname, n.href)} />
            ))}
          </nav>
          <div className="border-t border-white/10 pt-3">
            <div className="flex items-center justify-between px-2">
              <div>
                <p className="text-sm font-semibold">{admin.name}</p>
                <p className="text-xs text-white/40">{admin.role}</p>
              </div>
            </div>
            <button onClick={logout} className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white">
              <SignOut size={18} weight="duotone" /> Sign out
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top nav */}
          <div className="no-print flex items-center justify-between gap-3 border-b border-white/10 bg-black/20 px-4 py-3 md:hidden">
            <span className="font-black">Operator</span>
            <div className="flex items-center gap-2">
              <button onClick={logout} className="text-sm text-white/50">Sign out</button>
            </div>
          </div>
          <div className="no-print flex gap-1 overflow-x-auto border-b border-white/10 px-2 py-2 md:hidden">
            {visibleNav.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={clsx(
                  "shrink-0 rounded-lg px-3 py-1.5 text-sm",
                  isActive(pathname, n.href) ? "bg-white/10 text-white" : "text-white/50",
                )}
              >
                {n.label}
              </Link>
            ))}
          </div>

          <main className="flex-1 p-5 md:p-8">{children}</main>
        </div>
      </div>
      </AdminCtx.Provider>
    </IconContext.Provider>
  );
}

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function NavLink({
  href,
  label,
  icon: NavIcon,
  active,
}: {
  href: string;
  label: string;
  icon: Icon;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
        active ? "bg-[#e3f3fd] text-[#0d47a1]" : "text-white/55 hover:bg-white/5 hover:text-white",
      )}
    >
      <NavIcon size={20} weight="duotone" /> {label}
    </Link>
  );
}
