"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LogOut, Coins } from "lucide-react";
import { api, ApiClientError } from "@/lib/client";
import { pts } from "@/lib/format";
import { Loading } from "@/components/ui";
import { BottomNav } from "@/components/customer/BottomNav";
import { ThemeToggle } from "@/components/ThemeToggle";

export type Customer = {
  id: string;
  name: string | null;
  firstName: string | null;
  balance: number;
  phone: string;
};

export type ActivePass = {
  id: string;
  status: string;
  expiresInSeconds: number;
  game?: { name: string };
} | null;

type Ctx = {
  customer: Customer;
  activePass: ActivePass;
  refresh: () => Promise<void>;
  setBalance: (n: number) => void;
};

const CustomerCtx = createContext<Ctx | null>(null);

export function useCustomer(): Ctx {
  const ctx = useContext(CustomerCtx);
  if (!ctx) throw new Error("useCustomer must be used within CustomerProvider");
  return ctx;
}

export function CustomerProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [activePass, setActivePass] = useState<ActivePass>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await api<{ customer: Customer; activePass: ActivePass }>("/api/me");
      setCustomer(res.customer);
      setActivePass(res.activePass);
    } catch (e) {
      if (e instanceof ApiClientError && (e.status === 401 || e.status === 403)) {
        router.replace("/login");
        return;
      }
      throw e;
    }
  }, [router]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  if (loading || !customer) {
    return (
      <div className="mx-auto max-w-md">
        <Loading label="Loading your wallet…" />
      </div>
    );
  }

  return (
    <CustomerCtx.Provider
      value={{ customer, activePass, refresh, setBalance: (n) => setCustomer((c) => (c ? { ...c, balance: n } : c)) }}
    >
      <div className="mx-auto flex min-h-screen max-w-md flex-col">
        <Header name={customer.firstName} balance={customer.balance} />
        <div className="flex-1 px-4 pb-28 pt-3">{children}</div>
        <BottomNav hasPass={!!activePass} />
      </div>
    </CustomerCtx.Provider>
  );
}

function Header({ name, balance }: { name: string | null; balance: number }) {
  const router = useRouter();
  async function logout() {
    await api("/api/auth/logout", { method: "POST" }).catch(() => {});
    router.replace("/login");
  }
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-white/10 bg-[#0a0e1a]/80 px-4 py-3 backdrop-blur">
      <div className="min-w-0">
        <p className="text-xs text-white/45">Signed in</p>
        <p className="truncate text-sm font-semibold">Hi, {name ?? "player"} 👋</p>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/wallet"
          className="inline-flex items-center gap-1.5 rounded-full border border-[#ffc800]/30 bg-[#ffc800]/10 px-3 py-1.5 text-sm font-bold text-[#ffc800]"
        >
          <Coins size={15} /> {pts(balance)}
        </Link>
        <ThemeToggle />
        <button
          onClick={logout}
          aria-label="Sign out"
          className="rounded-full border border-white/10 bg-white/5 p-2 text-white/50 hover:text-white"
        >
          <LogOut size={16} />
        </button>
      </div>
    </header>
  );
}
