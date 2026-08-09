import { handle, ok, requireStationKey } from "@/lib/http";
import { expireStalePasses } from "@/lib/playpass";

// Sweep expired Play Passes (refunding unplayed ones). Intended for a cron/worker
// but callable on demand. Guarded by the station key.
export async function POST(req: Request) {
  return handle(async () => {
    requireStationKey(req);
    const expired = await expireStalePasses();
    return ok({ expired });
  });
}
