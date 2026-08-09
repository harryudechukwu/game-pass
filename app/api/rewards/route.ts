import { handle, ok } from "@/lib/http";
import { prisma } from "@/lib/db";

// Customer-facing "ways to earn" — active reward rules described in plain terms.
export async function GET() {
  return handle(async () => {
    const rules = await prisma.rewardRule.findMany({
      where: { active: true },
      orderBy: { priority: "desc" },
    });
    return ok({
      rewards: rules.map((r) => ({
        id: r.id,
        name: r.name,
        description: r.description,
        points: r.points,
        conditionType: r.conditionType,
        threshold: r.threshold,
      })),
    });
  });
}
