// Reset the database to a clean, production-ready state.
//
//   npm run reset-db            # dry run — just reports what's in the DB
//   npm run reset-db -- --yes   # actually wipe it
//
// Wipes every operational collection (members, games, items, sales, rewards,
// redemptions, attendants) back to 0 and resets settings to defaults. The only
// thing kept is the owner admin configured via ADMIN_EMAIL — every other admin
// / manager account is removed. The env owner is also re-created automatically
// on the next app boot (see lib/mongo.ts), so logging in as the owner keeps
// working either way.
//
// Safe to run against the live DB when preparing for first real use: it only
// touches the gamepass collections and never the demo (that runs in-browser).

import { MongoClient } from "mongodb";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// Load .env from the project root into process.env (without overriding anything
// already set), so the script works with the same MONGODB_URI the app uses. No
// dependency on dotenv — a tiny parser is enough.
function loadEnv() {
  try {
    const root = join(dirname(fileURLToPath(import.meta.url)), "..");
    const txt = readFileSync(join(root, ".env"), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/);
      if (!m || line.trim().startsWith("#")) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
  } catch {
    // no .env file — rely on the ambient environment
  }
}

loadEnv();

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI is not set (checked the environment and .env). Aborting.");
  process.exit(1);
}
const dbName = process.env.MONGODB_DB ?? "gamepass";
const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const apply = process.argv.includes("--yes") || process.env.CONFIRM === "1";

// Operational data — cleared completely.
const DATA = ["players", "games", "items", "purchases", "rewards", "redemptions", "attendants"];

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
await client.connect();
const db = client.db(dbName);

console.log(`Database: ${dbName}\n`);
console.log("Current document counts:");
for (const name of [...DATA, "admins", "settings"]) {
  const n = await db.collection(name).countDocuments();
  console.log(`  ${name.padEnd(12)} ${n}`);
}

if (!apply) {
  console.log("\nDry run — nothing was changed.");
  console.log("Re-run with  npm run reset-db -- --yes  to wipe everything above");
  console.log(adminEmail ? `(the owner admin ${adminEmail} will be kept).` : "(no ADMIN_EMAIL set — ALL admins would be removed).");
  await client.close();
  process.exit(0);
}

console.log("\nWiping…");
for (const name of DATA) {
  const { deletedCount } = await db.collection(name).deleteMany({});
  console.log(`  cleared ${name.padEnd(12)} (${deletedCount})`);
}

// Admins: keep only the env owner; drop managers and any other accounts.
if (adminEmail) {
  const { deletedCount } = await db.collection("admins").deleteMany({ email: { $ne: adminEmail } });
  console.log(`  cleared admins      (${deletedCount}) — kept owner ${adminEmail}`);
} else {
  const { deletedCount } = await db.collection("admins").deleteMany({});
  console.log(`  cleared admins      (${deletedCount}) — ALL removed; set ADMIN_EMAIL so the owner can log in`);
}

// Settings back to defaults.
await db.collection("settings").updateOne(
  { _id: "app" },
  { $set: { headsUpSeconds: 60, attendantOpenMin: 360, attendantCloseMin: 1140, attendantGraceMin: 30, timezone: "Africa/Lagos" } },
  { upsert: true },
);
console.log("  settings reset to defaults");

console.log("\nDone — clean state ready for main store usage.");
await client.close();
process.exit(0);
