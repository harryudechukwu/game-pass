import { z } from "zod";
import { handle, ok, readJson } from "@/lib/http";
import { requireCustomer } from "@/lib/auth";
import { initiatePurchase } from "@/lib/purchase";

const schema = z.object({ packageId: z.string().min(1) });

// Start a purchase. Returns a reference + the amount to charge. Payment is
// simulated, so the client immediately calls /api/purchases/confirm — but points
// are still only credited on a confirmed success (see confirm route).
export async function POST(req: Request) {
  return handle(async () => {
    const customer = await requireCustomer();
    const { packageId } = schema.parse(await readJson(req));
    const { purchase, pkg } = await initiatePurchase(customer.id, packageId);
    return ok(
      {
        reference: purchase.reference,
        amountKobo: purchase.amountKobo,
        currency: purchase.currency,
        pointsCredited: purchase.pointsCredited,
        package: { id: pkg.id, name: pkg.name },
        // In production this would be a hosted checkout URL / Paystack params.
        simulated: true,
      },
      201,
    );
  });
}
