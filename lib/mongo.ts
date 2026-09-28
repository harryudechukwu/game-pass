import { MongoClient, type Db } from "mongodb";
import { nanoid } from "nanoid";
import type { Admin, Attendant, Settings } from "@/lib/server/types";
import { hashPassword } from "@/lib/server/password";

const dbName = process.env.MONGODB_DB ?? "gamepass";

// Cache the client promise + seed flag across hot reloads / warm serverless
// invocations so we don't open a new connection per request. Crucially we must
// NOT keep a *rejected* promise cached — otherwise a single failed connect (e.g.
// a paused Atlas cluster) would keep failing until the process restarts, even
// after the database recovers.
const g = globalThis as unknown as { _mongoClient?: Promise<MongoClient>; _seeded?: boolean };

function client(): Promise<MongoClient> {
  // No localhost fallback on purpose: a missing/unreachable database must fail
  // loudly rather than silently connect somewhere unexpected.
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Point it at your MongoDB (Atlas SRV string, " +
        "mongodb+srv://…) — set it in .env for local dev and in your host's " +
        "environment variables in production.",
    );
  }
  if (!g._mongoClient) {
    g._mongoClient = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 })
      .connect()
      .catch((err) => {
        g._mongoClient = undefined; // allow the next request to retry instead of caching the failure
        throw err;
      });
  }
  return g._mongoClient;
}

export async function getDb(): Promise<Db> {
  const db = (await client()).db(dbName);
  await ensureSeed(db);
  return db;
}

const id = (p: string) => `${p}_${nanoid(12)}`;

async function ensureSeed(db: Db): Promise<void> {
  if (g._seeded) return;
  const admins = db.collection<Admin>("admins");

  // The owner admin login is configured via env (ADMIN_EMAIL / ADMIN_PASSWORD)
  // and always stored hashed. Setting or changing those is how you rotate the
  // admin password — it never lives in source or in the DB in the clear.
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    await admins.updateOne(
      { email },
      { $set: { name: process.env.ADMIN_NAME?.trim() || "Administrator", password: hashPassword(password), role: "admin", active: true }, $setOnInsert: { _id: id("adm") } },
      { upsert: true },
    );
    // The env admin is the sole owner login — drop any other admin/staff
    // accounts (e.g. the old demo seeds) so their credentials stop working.
    await admins.deleteMany({ role: { $in: ["admin", "staff"] }, email: { $ne: email } });
  }

  if ((await admins.estimatedDocumentCount()) === 0) await seed(db);
  // Ensure at least one attendant login exists (also back-fills older databases).
  if ((await db.collection("attendants").estimatedDocumentCount()) === 0) {
    await db.collection<Attendant>("attendants").insertOne({
      _id: id("att"),
      name: "Front Desk",
      username: "frontdesk",
      password: "attend1234",
      active: true,
      createdAt: Date.now(),
    });
  }
  await db.collection("attendants").createIndex({ username: 1 }, { unique: true }).catch(() => {});
  g._seeded = true;
}

async function seed(db: Db): Promise<void> {
  // Dev fallback only (used when no ADMIN_* env is set). Passwords are hashed;
  // these demo logins should be overridden via env or removed in production.
  await db.collection<Admin>("admins").insertMany([
    { _id: id("adm"), email: "admin@arcade.test", name: "Arcade Admin", password: hashPassword("admin1234"), role: "admin", active: true },
    { _id: id("adm"), email: "staff@arcade.test", name: "Front Desk", password: hashPassword("staff1234"), role: "staff", active: true },
  ]);

  await db.collection<Settings>("settings").updateOne({ _id: "app" }, { $set: { headsUpSeconds: 60, attendantOpenMin: 360, attendantCloseMin: 1140, attendantGraceMin: 30, timezone: "Africa/Lagos" } }, { upsert: true });
}
