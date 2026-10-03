import { MongoClient, type Db } from "mongodb";
import { nanoid } from "nanoid";
import type { Admin, Settings } from "@/lib/server/types";
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
  // admin password — it never lives in source or in the DB in the clear. This
  // is the ONLY account seeded automatically; every other admin/manager,
  // attendant, game, item, reward and member is created by operators in the
  // console, so a fresh database starts empty and ready for real store data.
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) {
    await admins.updateOne(
      { email },
      { $set: { name: process.env.ADMIN_NAME?.trim() || "Administrator", password: hashPassword(password), role: "admin", active: true }, $setOnInsert: { _id: id("adm") } },
      { upsert: true },
    );
    // The env admin is the sole owner login — drop any other admin/staff
    // accounts (e.g. older seeds) so their credentials stop working.
    await admins.deleteMany({ role: { $in: ["admin", "staff"] }, email: { $ne: email } });
  }

  // Settings defaults — only fill fields that are missing; never clobber a value
  // an operator has changed in the console.
  await db.collection<Settings>("settings").updateOne(
    { _id: "app" },
    { $setOnInsert: { headsUpSeconds: 60, attendantOpenMin: 360, attendantCloseMin: 1140, attendantGraceMin: 30, timezone: "Africa/Lagos" } },
    { upsert: true },
  );

  // Keep attendant usernames unique. No default attendant is seeded — operators
  // create their own attendant logins from the admin console.
  await db.collection("attendants").createIndex({ username: 1 }, { unique: true }).catch(() => {});
  g._seeded = true;
}
