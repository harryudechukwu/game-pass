import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Password hashing with scrypt (built into Node — no dependency). Hashes are
// stored as "scrypt$<salt>$<key>" (base64url). verifyPassword also accepts a
// legacy plaintext value, so pre-existing rows and the intentionally-shareable
// attendant/manager credentials (which the admin can reveal) keep working.

export function hashPassword(plain: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(plain, salt, 32);
  return `scrypt$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export function verifyPassword(stored: string | null | undefined, plain: string): boolean {
  if (!stored) return false;
  if (!stored.startsWith("scrypt$")) return safeEqual(stored, plain); // legacy / plaintext
  const [, saltB64, keyB64] = stored.split("$");
  if (!saltB64 || !keyB64) return false;
  const key = Buffer.from(keyB64, "base64url");
  let test: Buffer;
  try {
    test = scryptSync(plain, Buffer.from(saltB64, "base64url"), key.length);
  } catch {
    return false;
  }
  return key.length === test.length && timingSafeEqual(key, test);
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
