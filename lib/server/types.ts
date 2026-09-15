// MongoDB document shapes. IDs are nanoid strings (not ObjectId). Dates are
// epoch-millisecond numbers.

export type Player = { _id: string; phone: string; name: string | null; createdAt: number };

export type GameCategory = "kids" | "teen";
export type Game = {
  _id: string;
  name: string;
  slug: string;
  description: string;
  category: GameCategory;
  icon: string;
  location: string;
  priceKobo: number;
  durationMinutes: number;
  minAge: number | null;
  minHeightCm: number | null;
  instructions: string | null;
  rules: string | null;
  safety: string | null;
  status: string;
  featured: boolean;
  createdAt: number;
};

export type Item = {
  _id: string;
  name: string;
  description: string | null;
  icon: string;
  priceKobo: number;
  active: boolean;
  createdAt: number;
};

export type Purchase = {
  _id: string;
  playerId: string;
  kind: "game" | "item";
  refId: string;
  name: string;
  icon: string;
  amountKobo: number;
  quantity: number;
  attendantId: string | null;
  createdAt: number;
  headsUpEndsAt: number | null;
  mainEndsAt: number | null;
  location: string | null;
};

export type Reward = {
  _id: string;
  name: string;
  description: string | null;
  spendRequiredKobo: number;
  active: boolean;
  createdAt: number;
};

export type Redemption = { _id: string; playerId: string; rewardId: string; code: string; redeemedAt: number };

export type Admin = { _id: string; email: string; name: string; password: string; role: string };

export type Attendant = { _id: string; name: string; username: string; password: string; createdAt: number };

export type Settings = { _id: string; headsUpSeconds: number };
