"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Home, Gift } from "lucide-react";

const items = [
  { href: "/home", label: "My Games", icon: Home },
  { href: "/rewards", label: "Rewards", icon: Gift },
];

export function BottomNav({ claimable }: { claimable: number }) {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 mx-auto max-w-md border-t border-white/10 bg-[#0a0e1a]/90 backdrop-blur">
      <div className="grid grid-cols-2">
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
                {it.href === "/rewards" && claimable > 0 && (
                  <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff4b4b] px-1 text-[10px] font-black text-white ring-2 ring-[#0a0e1a]">
                    {claimable}
                  </span>
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
