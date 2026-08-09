import { handle, ok, requireStationKey, ApiError } from "@/lib/http";
import { prisma } from "@/lib/db";
import { firstNameOf } from "@/lib/serializers";

// Lightweight, read-only preview a station shows before activating. Deliberately
// reveals only what the kiosk needs — no wallet, no phone number.
export async function GET(req: Request) {
  return handle(async () => {
    requireStationKey(req);
    const token = new URL(req.url).searchParams.get("token");
    if (!token) throw new ApiError(400, "bad_request", "token query param required.");
    const pass = await prisma.playPass.findUnique({
      where: { qrToken: token },
      include: { game: true, customer: true, session: true },
    });
    if (!pass) throw new ApiError(404, "pass_not_found", "Play Pass not recognised.");
    return ok({
      playPassId: pass.id,
      status: pass.status,
      customerFirstName: firstNameOf(pass.customer?.name ?? null),
      game: { id: pass.game.id, name: pass.game.name, status: pass.game.status },
      pointCost: pass.pointCost,
      expiresInSeconds: Math.max(0, Math.floor((pass.expiresAt.getTime() - Date.now()) / 1000)),
      sessionId: pass.session?.id ?? null,
      sessionStatus: pass.session?.status ?? null,
    });
  });
}
