import { z } from "zod";
import { handle, ok, readJson } from "@/lib/http";
import { requireCustomer } from "@/lib/auth";
import { confirmPurchase } from "@/lib/purchase";

const schema = z.object({
  reference: z.string().min(1),
  outcome: z.enum(["success", "failed"]).optional(),
});

// Stands in for the payment provider's webhook/callback. Idempotent: confirming
// the same reference twice never double-credits.
export async function POST(req: Request) {
  return handle(async () => {
    const customer = await requireCustomer();
    const { reference, outcome } = schema.parse(await readJson(req));
    const res = await confirmPurchase(customer.id, reference, outcome ?? "success");
    return ok({
      status: res.purchase.status,
      credited: res.credited,
      pointsCredited: res.purchase.pointsCredited,
      balance: res.balance,
    });
  });
}
