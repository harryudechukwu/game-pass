import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/http";
import type { AdminUser, Customer } from "@prisma/client";

const secret = new TextEncoder().encode(env.authSecret);
const CUSTOMER_COOKIE = "gp_customer";
const ADMIN_COOKIE = "gp_admin";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function cookieOpts() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: env.isProd,
    maxAge: MAX_AGE,
  };
}

async function sign(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

// ── Customer sessions ─────────────────────────────────────────────────────

export async function setCustomerSession(customerId: string): Promise<void> {
  const token = await sign({ sub: customerId, kind: "customer" });
  (await cookies()).set(CUSTOMER_COOKIE, token, cookieOpts());
}

export async function clearCustomerSession(): Promise<void> {
  (await cookies()).delete(CUSTOMER_COOKIE);
}

export async function getCustomerId(): Promise<string | null> {
  const token = (await cookies()).get(CUSTOMER_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload.kind === "customer" ? String(payload.sub) : null;
  } catch {
    return null;
  }
}

export async function requireCustomer(): Promise<Customer> {
  const id = await getCustomerId();
  if (!id) throw new ApiError(401, "unauthorized", "Please sign in.");
  const customer = await prisma.customer.findUnique({ where: { id } });
  if (!customer) throw new ApiError(401, "unauthorized", "Session no longer valid.");
  if (customer.suspended) {
    throw new ApiError(403, "account_suspended", "This account is suspended.");
  }
  return customer;
}

// ── Admin sessions ────────────────────────────────────────────────────────

export async function setAdminSession(adminId: string, role: string): Promise<void> {
  const token = await sign({ sub: adminId, kind: "admin", role });
  (await cookies()).set(ADMIN_COOKIE, token, cookieOpts());
}

export async function clearAdminSession(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function getAdmin(): Promise<AdminUser | null> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload.kind !== "admin") return null;
    return prisma.adminUser.findUnique({ where: { id: String(payload.sub) } });
  } catch {
    return null;
  }
}

export async function requireAdmin(role?: "admin"): Promise<AdminUser> {
  const admin = await getAdmin();
  if (!admin) throw new ApiError(401, "unauthorized", "Admin sign-in required.");
  if (role === "admin" && admin.role !== "admin") {
    throw new ApiError(403, "forbidden", "This action requires an admin account.");
  }
  return admin;
}
