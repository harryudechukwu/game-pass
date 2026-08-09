import { z } from "zod";
import { ApiError, handle, ok, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { credit, debit } from "@/lib/wallet";
import { audit } from "@/lib/audit";

// Every manual adjustment REQUIRES a reason and creates an audited ledger entry.
const schema = z.object({
  amount: z.number().int().refine((n) => n !== 0, "Amount cannot be zero."),
  reason: z.string().min(3).max(300),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const { amount, reason } = schema.parse(await readJson(req));

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new ApiError(404, "customer_not_found", "Customer not found.");

    const result =
      amount > 0
        ? await credit({
            customerId: id,
            amount,
            type: "admin_credit",
            reason: `Admin adjustment: ${reason}`,
            createdByAdminId: admin.id,
            referenceType: "admin",
            referenceId: admin.id,
          })
        : await debit({
            customerId: id,
            amount: Math.abs(amount),
            type: "admin_debit",
            reason: `Admin adjustment: ${reason}`,
            createdByAdminId: admin.id,
            referenceType: "admin",
            referenceId: admin.id,
          });

    await audit({
      actorType: "admin",
      actorId: admin.id,
      actorName: admin.name,
      action: "wallet.adjusted",
      targetType: "customer",
      targetId: id,
      detail: { amount, reason, balanceAfter: result.balance },
    });
    return ok({ balance: result.balance, transactionId: result.transactionId });
  });
}
