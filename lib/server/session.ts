import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

// Tamper-proof session cookies: the value is the player/admin id, signed with an
// HMAC. No DB session table needed. (node:crypto — no extra dependency.)

const secret = process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me-please-0123456789";
const PLAYER = "gp_player";
const ADMIN = "gp_admin";
const ATTENDANT = "gp_attendant";
const MAX_AGE = 60 * 60 * 24 * 30;

function sign(value: string): string {
  const mac = createHmac("sha256", secret).update(value).digest("base64url");
  return `${value}.${mac}`;
}
function verify(token: string | undefined): string | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const value = token.slice(0, i);
  const mac = token.slice(i + 1);
  const expected = createHmac("sha256", secret).update(value).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return value;
}

function opts() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE,
  };
}

export type SessionCtx = { playerId: string | null; adminId: string | null; attendantId: string | null };

export async function getSession(): Promise<SessionCtx> {
  const jar = await cookies();
  return {
    playerId: verify(jar.get(PLAYER)?.value),
    adminId: verify(jar.get(ADMIN)?.value),
    attendantId: verify(jar.get(ATTENDANT)?.value),
  };
}

export async function setPlayerSession(id: string) {
  (await cookies()).set(PLAYER, sign(id), opts());
}
export async function clearPlayerSession() {
  (await cookies()).delete(PLAYER);
}
export async function setAdminSession(id: string) {
  (await cookies()).set(ADMIN, sign(id), opts());
}
export async function clearAdminSession() {
  (await cookies()).delete(ADMIN);
}
export async function setAttendantSession(id: string) {
  (await cookies()).set(ATTENDANT, sign(id), opts());
}
export async function clearAttendantSession() {
  (await cookies()).delete(ATTENDANT);
}
