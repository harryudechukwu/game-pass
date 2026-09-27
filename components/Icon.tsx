"use client";

import {
  House, Gift, GameController, Timer, Trophy, Coffee, Popcorn, Ticket,
  ShoppingBag, MagnifyingGlass, Star, Coin, TShirt, MusicNotes, PuzzlePiece,
  Lock, type IconWeight,
} from "@phosphor-icons/react";

// One place that maps our semantic icon names → Phosphor icons, rendered in the
// friendly "duotone" weight (soft fill + crisp line, both in currentColor).
const MAP = {
  home: House,
  gift: Gift,
  joystick: GameController,
  controller: GameController,
  timer: Timer,
  trophy: Trophy,
  cup: Coffee,
  popcorn: Popcorn,
  ticket: Ticket,
  bag: ShoppingBag,
  search: MagnifyingGlass,
  star: Star,
  coin: Coin,
  shirt: TShirt,
  music: MusicNotes,
  puzzle: PuzzlePiece,
  lock: Lock,
};

export type IconName = keyof typeof MAP;

// Catalogue icon keys (stored on games/items in the DB) → our icon names.
const CAT: Record<string, IconName> = {
  gamepad: "joystick", joystick: "joystick", goal: "joystick", target: "joystick",
  car: "joystick", dice: "joystick", rocket: "joystick", bike: "joystick", waves: "joystick",
  basketball: "joystick", dumbbell: "joystick", baby: "joystick", flag: "joystick",
  ferris: "star", puzzle: "puzzle", music: "music",
  popcorn: "popcorn", cookie: "popcorn", water: "cup", coins: "coin",
  shirt: "shirt", ticket: "ticket", trophy: "trophy", tent: "gift",
};

export function iconFor(key: string, kind?: "game" | "item"): IconName {
  return CAT[key] ?? (kind === "item" ? "bag" : "joystick");
}

export function Icon({
  name,
  size = 24,
  weight = "duotone",
  className,
}: {
  name: IconName;
  size?: number;
  weight?: IconWeight;
  className?: string;
}) {
  const C = MAP[name] ?? Star;
  return <C size={size} weight={weight} className={className} />;
}
