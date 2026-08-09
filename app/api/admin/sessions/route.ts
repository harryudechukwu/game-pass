import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { firstNameOf, publicSession } from "@/lib/serializers";

const VALID = ["pending", "authorized", "in_progress", "completed", "cancelled", "expired"];

export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const status = new URL(req.url).searchParams.get("status");
    const where = status && VALID.includes(status) ? { status } : {};
    const sessions = await prisma.gameSession.findMany({
      where,
      include: { game: true, customer: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return ok({
      sessions: sessions.map((s) => ({
        ...publicSession(s),
        customer: { id: s.customerId, firstName: firstNameOf(s.customer?.name ?? null) },
        stationId: s.stationId,
      })),
    });
  });
}
