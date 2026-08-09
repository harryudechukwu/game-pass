import { z } from "zod";
import { handle, ok, readJson } from "@/lib/http";
import { issueOtp } from "@/lib/otp";
import { prisma } from "@/lib/db";

const schema = z.object({ phone: z.string().min(6).max(20) });

// Request an OTP. Works for both new sign-ups and returning logins; the client
// learns whether the phone is already registered so it can show the right form.
export async function POST(req: Request) {
  return handle(async () => {
    const { phone } = schema.parse(await readJson(req));
    const normalized = phone.replace(/\s+/g, "");
    const existing = await prisma.customer.findUnique({ where: { phone: normalized } });
    const { devCode } = await issueOtp(normalized);
    return ok({ phone: normalized, isRegistered: !!existing, devCode });
  });
}
