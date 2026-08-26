"use client";

import {
  Gamepad2, Goal, Dribbble, Car, Target, Baby, Flag, Dices, FerrisWheel,
  GlassWater, Popcorn, Coins, Shirt, Cookie, Rocket, Bike, Puzzle, Waves,
  Ticket, Joystick, Music, Trophy, Dumbbell, Tent,
} from "lucide-react";

// Catalogue entries carry an icon key (not an image). This maps keys to lucide
// icons; unknown keys fall back to a gamepad.
const ICONS: Record<string, React.ComponentType<{ size?: number; className?: string }>> = {
  gamepad: Gamepad2, goal: Goal, basketball: Dribbble, car: Car, target: Target,
  baby: Baby, flag: Flag, dice: Dices, ferris: FerrisWheel, water: GlassWater,
  popcorn: Popcorn, coins: Coins, shirt: Shirt, cookie: Cookie, rocket: Rocket,
  bike: Bike, puzzle: Puzzle, waves: Waves, ticket: Ticket, joystick: Joystick,
  music: Music, trophy: Trophy, dumbbell: Dumbbell, tent: Tent,
};

export const ICON_KEYS = Object.keys(ICONS);

export function CatalogIcon({ name, size = 22, className }: { name: string; size?: number; className?: string }) {
  const Icon = ICONS[name] ?? Gamepad2;
  return <Icon size={size} className={className} />;
}

// A rounded, coloured tile with the icon centred — the standard catalogue mark.
export function CatalogTile({
  name,
  className = "",
  accent = "brand",
  size = 26,
}: {
  name: string;
  className?: string;
  accent?: "brand" | "kids" | "teen" | "item" | "muted";
  size?: number;
}) {
  const accents: Record<string, string> = {
    brand: "from-[#58cc02] to-[#1cb0f6] text-black",
    teen: "from-[#7c5cff] to-[#1cb0f6] text-black",
    kids: "from-[#ffc800] to-[#ff8a3d] text-black",
    item: "from-[#34d399] to-[#1cb0f6] text-black",
    muted: "from-white/10 to-white/5 text-white/70",
  };
  return (
    <span className={`inline-flex items-center justify-center rounded-2xl bg-gradient-to-br ${accents[accent]} ${className}`}>
      <CatalogIcon name={name} size={size} />
    </span>
  );
}

// Grid of selectable icons for the admin catalogue forms.
export function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-2">
      {ICON_KEYS.map((k) => (
        <button
          key={k}
          type="button"
          onClick={() => onChange(k)}
          className={`flex aspect-square items-center justify-center rounded-xl border-2 ${value === k ? "border-[#58cc02] bg-[#58cc02]/10 text-white" : "border-white/10 bg-white/5 text-white/50 hover:text-white"}`}
        >
          <CatalogIcon name={k} size={18} />
        </button>
      ))}
    </div>
  );
}
