import { handle, ok, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { publicGame } from "@/lib/serializers";
import { gameCreateSchema } from "@/lib/gameSchema";
import { uniqueGameSlug } from "@/lib/slug";
import { audit } from "@/lib/audit";

// List every game (including inactive) for admins.
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const games = await prisma.game.findMany({ orderBy: { createdAt: "asc" } });
    return ok({ games: games.map(publicGame) });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const data = gameCreateSchema.parse(await readJson(req));
    const slug = await uniqueGameSlug(data.name);
    const game = await prisma.game.create({ data: { ...data, slug } });
    await audit({
      actorType: "admin",
      actorId: admin.id,
      actorName: admin.name,
      action: "game.created",
      targetType: "game",
      targetId: game.id,
      detail: { name: game.name },
    });
    return ok({ game: publicGame(game) }, 201);
  });
}
