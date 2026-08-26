"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { clsx } from "clsx";
import { LayoutDashboard, Gamepad2, ShoppingBag, Trophy, Users, Activity, LogOut, ShieldCheck } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { Loading } from "@/components/ui";
import { ThemeToggle } from "@/components/ThemeToggle";

type Admin = { id: string; name: string; email: string; role: string };
const AdminCtx = createContext<Admin | null>(null);
export const useAdmin = () => useContext(AdminCtx);

const nav = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/games", label: "Games", icon: Gamepad2 },
  { href: "/admin/items", label: "Items", icon: ShoppingBag },
  { href: "/admin/rewards", label: "Rewards", icon: Trophy },
  { href: "/admin/players", label: "Players", icon: Users },
  { href: "/admin/logs", label: "Logs", icon: Activity },
];

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

  async function logout() {
    await api("/api/admin/logout", { method: "POST" }).catch(() => {});
    router.replace("/admin/login");
  }

  if (loading) return <Loading label="Loading console…" />;
  if (!admin) return null;

  return (
    <AdminCtx.Provider value={admin}>
      <div className="flex min-h-screen">
        {/* Sidebar (desktop) */}
        <aside className="hidden w-60 shrink-0 flex-col border-r border-white/10 bg-black/20 p-4 md:flex">
          <div className="mb-8 flex items-center gap-2 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-[#ffc800] to-[#f97316] text-black">
              <ShieldCheck size={18} />
            </div>
            <span className="font-black">Operator</span>
          </div>
          <nav className="flex-1 space-y-1">
            {nav.map((n) => (
              <NavLink key={n.href} {...n} active={isActive(pathname, n.href)} />
            ))}
          </nav>
          <div className="border-t border-white/10 pt-3">
            <div className="flex items-center justify-between px-2">
              <div>
                <p className="text-sm font-semibold">{admin.name}</p>
                <p className="text-xs text-white/40">{admin.role}</p>
              </div>
              <ThemeToggle />
            </div>
            <button onClick={logout} className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm text-white/60 hover:bg-white/5 hover:text-white">
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top nav */}
          <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-black/20 px-4 py-3 md:hidden">
            <span className="font-black">Operator</span>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button onClick={logout} className="text-sm text-white/50">Sign out</button>
            </div>
          </div>
          <div className="flex gap-1 overflow-x-auto border-b border-white/10 px-2 py-2 md:hidden">
            {nav.map((n) => (
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
  );
}

function isActive(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
}

function NavLink({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
        active ? "bg-gradient-to-r from-[#58cc02]/20 to-transparent text-white" : "text-white/55 hover:bg-white/5 hover:text-white",
      )}
    >
      <Icon size={18} /> {label}
    </Link>
  );
}
