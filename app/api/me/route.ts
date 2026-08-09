import { handle, ok } from "@/lib/http";
import { requireCustomer } from "@/lib/auth";
import { getActivePlayPass } from "@/lib/playpass";
import { publicCustomer, publicPass } from "@/lib/serializers";

// Current signed-in customer + whether they hold an active Play Pass.
export async function GET() {
  return handle(async () => {
    const customer = await requireCustomer();
    const pass = await getActivePlayPass(customer.id);
    return ok({
      customer: publicCustomer(customer),
      activePass: pass ? publicPass(pass) : null,
    });
  });
}
