import { getDb } from "@/lib/mongo";
import type { Admin, Attendant, Game, Item, Player, Purchase, Reward, Redemption, Settings } from "@/lib/server/types";

// Typed collection handles. `await cols()` ensures the DB is connected + seeded.
export async function cols() {
  const db = await getDb();
  return {
    players: db.collection<Player>("players"),
    games: db.collection<Game>("games"),
    items: db.collection<Item>("items"),
    purchases: db.collection<Purchase>("purchases"),
    rewards: db.collection<Reward>("rewards"),
    redemptions: db.collection<Redemption>("redemptions"),
    admins: db.collection<Admin>("admins"),
    attendants: db.collection<Attendant>("attendants"),
    settings: db.collection<Settings>("settings"),
  };
}
