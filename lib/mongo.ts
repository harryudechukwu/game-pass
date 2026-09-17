import { MongoClient, type Db } from "mongodb";
import { nanoid } from "nanoid";
import type { Admin, Attendant, Settings } from "@/lib/server/types";

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
  if ((await db.collection("admins").estimatedDocumentCount()) === 0) await seed(db);
  // Ensure at least one attendant login exists (also back-fills older databases).
  if ((await db.collection("attendants").estimatedDocumentCount()) === 0) {
    await db.collection<Attendant>("attendants").insertOne({
      _id: id("att"),
      name: "Front Desk",
      username: "frontdesk",
      password: "attend1234",
      createdAt: Date.now(),
    });
  }
  await db.collection("attendants").createIndex({ username: 1 }, { unique: true }).catch(() => {});
  g._seeded = true;
}

async function seed(db: Db): Promise<void> {
  await db.collection<Admin>("admins").insertMany([
    { _id: id("adm"), email: "admin@arcade.test", name: "Arcade Admin", password: "admin1234", role: "admin" },
    { _id: id("adm"), email: "staff@arcade.test", name: "Front Desk", password: "staff1234", role: "staff" },
  ]);

  await db.collection<Settings>("settings").updateOne({ _id: "app" }, { $set: { headsUpSeconds: 60 } }, { upsert: true });
}
