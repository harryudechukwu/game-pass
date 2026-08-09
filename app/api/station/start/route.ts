import { z } from "zod";
import { handle, ok, readJson, requireStationKey } from "@/lib/http";
import { start } from "@/lib/station";
import { publicSession } from "@/lib/serializers";

const schema = z.object({ sessionId: z.string().min(1), stationId: z.string().optional() });

export async function POST(req: Request) {
  return handle(async () => {
    requireStationKey(req);
    const { sessionId, stationId } = schema.parse(await readJson(req));
    const res = await start(sessionId, stationId);
    return ok({ started: true, replay: res.replay, session: publicSession(res.session as never) });
  });
}
