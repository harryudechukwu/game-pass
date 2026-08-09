import { z } from "zod";
import {
  ApiError,
  handle,
  idempotencyKey,
  ok,
  readJson,
  requireStationKey,
} from "@/lib/http";
import { activate } from "@/lib/station";
import { getIdempotent, saveIdempotent } from "@/lib/idempotency";
import { publicSession } from "@/lib/serializers";

const schema = z
  .object({
    qrToken: z.string().optional(),
    playPassId: z.string().optional(),
    stationId: z.string().optional(),
    expectedGameId: z.string().optional(),
  })
  .refine((v) => v.qrToken || v.playPassId, {
    message: "qrToken or playPassId is required",
  });

// The station presents the scanned QR token. Runs all 7 validation checks and,
// if valid, returns PLAY AUTHORIZED with a fresh (or replayed) session.
export async function POST(req: Request) {
  return handle(async () => {
    requireStationKey(req);
    const body = schema.parse(await readJson(req));

    const key = idempotencyKey(req) ? `station-activate:${idempotencyKey(req)}` : null;
    const cached = await getIdempotent<{ sessionId: string }>(key);
    if (cached) {
      return ok({ authorized: true, replay: true, sessionId: cached.sessionId });
    }

    const res = await activate(body);
    const payload = {
      authorized: true,
      replay: res.replay,
      message: "PLAY AUTHORIZED",
      session: publicSession(res.session as never),
      game: { id: res.playPass.gameId, name: (res.playPass as never as { game?: { name: string } }).game?.name },
    };
    await saveIdempotent(key, "station-activate", { sessionId: res.session.id });
    return ok(payload);
  });
}
