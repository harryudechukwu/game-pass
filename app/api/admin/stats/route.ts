import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const today = { gte: startOfDay };

    const [
      visitorRows,
      gamesPlayedToday,
      pointsSold,
      pointsRedeemed,
      rewardsAgg,
      revenue,
      activeSessions,
      failedPasses,
      popular,
      totalCustomers,
    ] = await Promise.all([
      prisma.gameSession.findMany({
        where: { createdAt: today },
        distinct: ["customerId"],
        select: { customerId: true },
      }),
      prisma.gameSession.count({ where: { status: "completed", completionTime: today } }),
      prisma.purchase.aggregate({
        where: { status: "success", updatedAt: today },
        _sum: { pointsCredited: true },
      }),
      prisma.walletTransaction.aggregate({
        where: { type: "play_spend", createdAt: today },
        _sum: { amount: true },
      }),
      prisma.walletTransaction.aggregate({
        where: { type: "reward", createdAt: today },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      prisma.purchase.aggregate({
        where: { status: "success", updatedAt: today },
        _sum: { amountKobo: true },
      }),
      prisma.gameSession.count({ where: { status: { in: ["authorized", "in_progress"] } } }),
      prisma.playPass.count({ where: { status: { in: ["expired", "cancelled"] }, createdAt: today } }),
      prisma.gameSession.groupBy({
        by: ["gameId"],
        _count: { _all: true },
        orderBy: { _count: { gameId: "desc" } },
        take: 5,
      }),
      prisma.customer.count(),
    ]);

    const popularGames = await Promise.all(
      popular.map(async (p) => {
        const game = await prisma.game.findUnique({ where: { id: p.gameId }, select: { name: true } });
        return { gameId: p.gameId, name: game?.name ?? "—", plays: p._count._all };
      }),
    );

    return ok({
      todaysVisitors: visitorRows.length,
      gamesPlayed: gamesPlayedToday,
      pointsSold: pointsSold._sum.pointsCredited ?? 0,
      pointsRedeemed: Math.abs(pointsRedeemed._sum.amount ?? 0),
      rewardsIssued: rewardsAgg._sum.amount ?? 0,
      rewardsCount: rewardsAgg._count._all,
      revenueKobo: revenue._sum.amountKobo ?? 0,
      activeSessions,
      failedOrExpiredPasses: failedPasses,
      popularGames,
      totalCustomers,
    });
  });
}
