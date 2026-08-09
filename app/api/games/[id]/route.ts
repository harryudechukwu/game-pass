import { ApiError, handle, ok } from "@/lib/http";
import { prisma } from "@/lib/db";
import { publicGame } from "@/lib/serializers";

// Fetch one game by id or slug.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const game = await prisma.game.findFirst({
      where: { OR: [{ id }, { slug: id }] },
    });
    if (!game || game.status === "inactive") {
      throw new ApiError(404, "game_not_found", "Game not found.");
    }
    return ok({ game: publicGame(game) });
  });
}
