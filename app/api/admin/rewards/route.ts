import { z } from "zod";
import { handle, ok, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const schema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).nullish(),
  conditionType: z.enum(["play_completed", "score_above", "games_count", "first_visit"]),
  threshold: z.number().int().min(0).nullish(),
  points: z.number().int().min(1).max(100000),
  active: z.boolean().default(true),
  expiryDays: z.number().int().min(0).nullish(),
  priority: z.number().int().default(0),
});

export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const rules = await prisma.rewardRule.findMany({ orderBy: { priority: "desc" } });
    return ok({ rewards: rules });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const data = schema.parse(await readJson(req));
    const rule = await prisma.rewardRule.create({ data });
    await audit({
      actorType: "admin",
      actorId: admin.id,
      actorName: admin.name,
      action: "reward.created",
      targetType: "reward",
      targetId: rule.id,
      detail: { name: rule.name, conditionType: rule.conditionType, points: rule.points },
    });
    return ok({ reward: rule }, 201);
  });
}
