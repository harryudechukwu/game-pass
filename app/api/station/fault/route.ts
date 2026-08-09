import { z } from "zod";
import { handle, ok, readJson, requireStationKey } from "@/lib/http";
import { reportFault } from "@/lib/station";

const schema = z.object({ sessionId: z.string().min(1), reason: z.string().max(300).optional() });

// A physical fault cancels the session and refunds the customer.
export async function POST(req: Request) {
  return handle(async () => {
    requireStationKey(req);
    const { sessionId, reason } = schema.parse(await readJson(req));
    const res = await reportFault(sessionId, reason);
    return ok({ cancelled: true, refunded: res.refunded });
  });
}
