import { handle, ok } from "@/lib/http";
import { requireCustomer } from "@/lib/auth";
import { cancelPlayPass } from "@/lib/playpass";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const customer = await requireCustomer();
    const { id } = await params;
    const { refunded } = await cancelPlayPass(customer.id, id);
    return ok({ cancelled: true, refunded });
  });
}
