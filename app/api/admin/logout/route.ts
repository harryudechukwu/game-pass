import { handle, ok } from "@/lib/http";
import { clearAdminSession } from "@/lib/auth";

export async function POST() {
  return handle(async () => {
    await clearAdminSession();
    return ok({ loggedOut: true });
  });
}
