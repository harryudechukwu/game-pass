import { z } from "zod";
import { ApiError, handle, ok, readJson } from "@/lib/http";
import { verifyOtp } from "@/lib/otp";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { creditWithin } from "@/lib/wallet";
import { setCustomerSession } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { publicCustomer } from "@/lib/serializers";

const schema = z.object({
  phone: z.string().min(6).max(20),
  code: z.string().length(6),
  name: z.string().min(1).max(80).optional(),
  dateOfBirth: z.string().optional(),
  acceptTerms: z.boolean().optional(),
});

// Verify an OTP. Returning customers are logged in. Unknown phones are treated
// as registrations and must supply name + DOB + accept terms; the configured
// signup bonus is issued atomically with account creation.
export async function POST(req: Request) {
  return handle(async () => {
    const body = schema.parse(await readJson(req));
    const phone = body.phone.replace(/\s+/g, "");
    await verifyOtp(phone, body.code);

    let customer = await prisma.customer.findUnique({ where: { phone } });
    let isNew = false;

    if (!customer) {
      if (!body.name || !body.dateOfBirth || !body.acceptTerms) {
        throw new ApiError(
          400,
          "registration_incomplete",
          "Enter your name, date of birth, and accept the terms to create your account.",
        );
      }
      const dob = new Date(body.dateOfBirth);
      if (Number.isNaN(dob.getTime())) {
        throw new ApiError(400, "bad_dob", "That date of birth is not valid.");
      }
      customer = await prisma.$transaction(async (tx) => {
        const created = await tx.customer.create({
          data: {
            phone,
            name: body.name!.trim(),
            dateOfBirth: dob,
            termsAcceptedAt: new Date(),
          },
        });
        await creditWithin(tx, {
          customerId: created.id,
          amount: env.signupBonusPoints,
          type: "signup_bonus",
          reason: "Welcome bonus",
        });
        return tx.customer.findUnique({ where: { id: created.id } });
      });
      isNew = true;
      await audit({
        actorType: "customer",
        actorId: customer!.id,
        action: "customer.registered",
        targetType: "customer",
        targetId: customer!.id,
      });
    }

    if (customer!.suspended) {
      throw new ApiError(403, "account_suspended", "This account is suspended. Contact staff.");
    }

    await setCustomerSession(customer!.id);
    return ok({
      isNew,
      signupBonus: isNew ? env.signupBonusPoints : 0,
      customer: publicCustomer(customer!),
    });
  });
}
