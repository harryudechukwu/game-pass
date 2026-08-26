"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Home, Gift } from "lucide-react";

const items = [
  { href: "/home", label: "My Games", icon: Home },
  { href: "/rewards", label: "Rewards", icon: Gift },
];

// Mobile only — desktop uses the sidebar. Theme-aware chrome (white in light
// mode, dark in dark mode).
export function BottomNav({ claimable }: { claimable: number }) {
  const pathname = usePathname();
  return (
    <nav className="chrome fixed inset-x-0 bottom-0 z-20 border-t border-white/10 md:hidden">
      <div className="mx-auto grid max-w-md grid-cols-2">
        {items.map((it) => {
          const active = pathname === it.href;
          return (
            <Link key={it.href} href={it.href} className={clsx("relative flex flex-col items-center gap-1 py-3 text-xs font-semibold transition", active ? "text-white" : "text-white/40 hover:text-white/70")}>
              <span className="relative">
                <it.icon size={22} />
                {it.href === "/rewards" && claimable > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff4b4b] px-1 text-[10px] font-black text-white">{claimable}</span>
                )}
              </span>
              {it.label}
              {active && <span className="absolute -top-px h-0.5 w-10 rounded-full bg-gradient-to-r from-[#58cc02] to-[#1cb0f6]" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
