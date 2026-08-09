import { handle, ok } from "@/lib/http";
import { clearCustomerSession } from "@/lib/auth";

export async function POST() {
  return handle(async () => {
    await clearCustomerSession();
    return ok({ loggedOut: true });
  });
}
