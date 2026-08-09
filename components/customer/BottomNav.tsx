"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Home, Ticket, Receipt, Wallet } from "lucide-react";

const items = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/pass", label: "Pass", icon: Ticket },
  { href: "/activity", label: "Activity", icon: Receipt },
  { href: "/wallet", label: "Wallet", icon: Wallet },
];

export function BottomNav({ hasPass }: { hasPass: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-white/10 bg-[#0a0e1a]/90 backdrop-blur">
      <div className="grid grid-cols-4">
        {items.map((it) => {
          const active = pathname === it.href;
          return (
            <Link
              key={it.href}
              href={it.href}
              className={clsx(
                "relative flex flex-col items-center gap-1 py-3 text-xs transition",
                active ? "text-white" : "text-white/40 hover:text-white/70",
              )}
            >
              <span className="relative">
                <it.icon size={22} />
                {it.href === "/pass" && hasPass && (
                  <span className="absolute -right-1.5 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0a0e1a]" />
                )}
              </span>
              {it.label}
              {active && (
                <span className="absolute -top-px h-0.5 w-8 rounded-full bg-gradient-to-r from-[#58cc02] to-[#1cb0f6]" />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
