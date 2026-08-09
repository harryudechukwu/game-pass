import { z } from "zod";
import { handle, ok, readJson, requireStationKey } from "@/lib/http";
import { complete } from "@/lib/station";
import { publicSession } from "@/lib/serializers";

const schema = z.object({
  sessionId: z.string().min(1),
  score: z.number().int().min(0).max(1_000_000).nullish(),
});

// Report completion (and optional score). Rewards are evaluated + credited here.
export async function POST(req: Request) {
  return handle(async () => {
    requireStationKey(req);
    const { sessionId, score } = schema.parse(await readJson(req));
    const res = await complete(sessionId, score ?? undefined);
    return ok({
      completed: true,
      replay: res.replay,
      session: publicSession(res.session as never),
      rewards: res.rewards,
      rewardPointsEarned: res.session.rewardPointsEarned,
    });
  });
}
