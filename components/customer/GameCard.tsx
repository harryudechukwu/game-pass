"use client";

import Link from "next/link";
import { Coins, Clock, MapPin } from "lucide-react";
import { StatusPill } from "@/components/ui";

export type GameLite = {
  id: string;
  slug: string;
  name: string;
  description: string;
  imageUrl: string;
  pointCost: number;
  durationLabel: string;
  location: string;
  playersLabel: string;
  status: string;
  available: boolean;
};

export function GameCard({ game, compact }: { game: GameLite; compact?: boolean }) {
  return (
    <Link
      href={`/games/${game.slug}`}
      className={`card group block overflow-hidden transition hover:border-white/20 ${compact ? "w-56 shrink-0" : ""}`}
    >
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-gradient-to-br from-[#1c2340] to-[#0a0e1a]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={game.imageUrl}
          alt={game.name}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <div className="absolute right-2 top-2">
          <span className="pill bg-black/65 font-bold text-[#ffc800] backdrop-blur">
            <Coins size={12} /> {game.pointCost}
          </span>
        </div>
        {!game.available && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/65">
            <StatusPill status={game.status} />
          </div>
        )}
      </div>
      <div className="p-3">
        <h3 className="font-bold leading-tight">{game.name}</h3>
        <p className="mt-1 line-clamp-2 text-xs text-white/50">{game.description}</p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white/40">
          <span className="inline-flex items-center gap-1">
            <Clock size={12} /> {game.durationLabel}
          </span>
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} /> {game.location}
          </span>
        </div>
      </div>
    </Link>
  );
}
