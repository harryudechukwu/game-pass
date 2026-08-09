import { ApiError, handle, ok, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { publicGame } from "@/lib/serializers";
import { gameUpdateSchema } from "@/lib/gameSchema";
import { audit } from "@/lib/audit";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    const game = await prisma.game.findUnique({ where: { id } });
    if (!game) throw new ApiError(404, "game_not_found", "Game not found.");
    return ok({ game: publicGame(game) });
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const data = gameUpdateSchema.parse(await readJson(req));
    const existing = await prisma.game.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "game_not_found", "Game not found.");
    const game = await prisma.game.update({ where: { id }, data });
    await audit({
      actorType: "admin",
      actorId: admin.id,
      actorName: admin.name,
      action: "game.updated",
      targetType: "game",
      targetId: id,
      detail: data,
    });
    return ok({ game: publicGame(game) });
  });
}

// Hard delete only when the game has no history; otherwise deactivate instead.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin("admin");
    const { id } = await params;
    const [passes, sessions] = await Promise.all([
      prisma.playPass.count({ where: { gameId: id } }),
      prisma.gameSession.count({ where: { gameId: id } }),
    ]);
    if (passes > 0 || sessions > 0) {
      throw new ApiError(
        409,
        "game_in_use",
        "This game has play history. Deactivate it instead of deleting.",
      );
    }
    await prisma.game.delete({ where: { id } });
    await audit({
      actorType: "admin",
      actorId: admin.id,
      actorName: admin.name,
      action: "game.deleted",
      targetType: "game",
      targetId: id,
    });
    return ok({ deleted: true });
  });
}
