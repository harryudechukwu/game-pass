import { createHash, randomInt } from "node:crypto";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/http";

const OTP_TTL_MS = 5 * 60 * 1000;
const MAX_ATTEMPTS = 5;

function hashCode(phone: string, code: string): string {
  return createHash("sha256")
    .update(`${phone}:${code}:${env.authSecret}`)
    .digest("hex");
}

// Issue a fresh 6-digit code, invalidating any previous outstanding codes.
// In dev mode the code is returned so the flow can be tested without SMS; in
// production it would be dispatched via an SMS provider and never returned.
export async function issueOtp(phone: string): Promise<{ devCode: string | null }> {
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.otpCode.updateMany({
    where: { phone, consumedAt: null },
    data: { consumedAt: new Date() },
  });
  await prisma.otpCode.create({
    data: {
      phone,
      codeHash: hashCode(phone, code),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
    },
  });
  console.log(`[otp] code for ${phone}: ${code}`);
  return { devCode: env.otpDevMode ? code : null };
}

export async function verifyOtp(phone: string, code: string): Promise<void> {
  const row = await prisma.otpCode.findFirst({
    where: { phone, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!row) {
    throw new ApiError(400, "otp_invalid", "Code expired or not found. Request a new one.");
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    throw new ApiError(429, "otp_locked", "Too many attempts. Request a new code.");
  }
  if (row.codeHash !== hashCode(phone, code)) {
    await prisma.otpCode.update({
      where: { id: row.id },
      data: { attempts: { increment: 1 } },
    });
    throw new ApiError(400, "otp_invalid", "Incorrect code.");
  }
  await prisma.otpCode.update({
    where: { id: row.id },
    data: { consumedAt: new Date() },
  });
}
