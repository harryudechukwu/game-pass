import { handle, ok } from "@/lib/http";
import { prisma } from "@/lib/db";
import { publicGame } from "@/lib/serializers";

// Public catalogue: active + maintenance games (hidden: inactive).
export async function GET() {
  return handle(async () => {
    const games = await prisma.game.findMany({
      where: { status: { in: ["active", "maintenance"] } },
      orderBy: [{ featured: "desc" }, { createdAt: "asc" }],
    });
    const mapped = games.map(publicGame);
    return ok({
      games: mapped,
      featured: mapped.filter((g) => g.featured && g.available),
    });
  });
}
