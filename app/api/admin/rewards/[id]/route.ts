import { z } from "zod";
import { ApiError, handle, ok, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const schema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).nullish(),
  conditionType: z.enum(["play_completed", "score_above", "games_count", "first_visit"]).optional(),
  threshold: z.number().int().min(0).nullish(),
  points: z.number().int().min(1).max(100000).optional(),
  active: z.boolean().optional(),
  expiryDays: z.number().int().min(0).nullish(),
  priority: z.number().int().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const data = schema.parse(await readJson(req));
    const existing = await prisma.rewardRule.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, "reward_not_found", "Reward not found.");
    const reward = await prisma.rewardRule.update({ where: { id }, data });
    await audit({
      actorType: "admin",
      actorId: admin.id,
      actorName: admin.name,
      action: "reward.updated",
      targetType: "reward",
      targetId: id,
      detail: data,
    });
    return ok({ reward });
  });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin("admin");
    const { id } = await params;
    const issued = await prisma.rewardIssue.count({ where: { ruleId: id } });
    if (issued > 0) {
      // Preserve history: disable instead of delete.
      await prisma.rewardRule.update({ where: { id }, data: { active: false } });
      return ok({ disabled: true });
    }
    await prisma.rewardRule.delete({ where: { id } });
    await audit({
      actorType: "admin",
      actorId: admin.id,
      actorName: admin.name,
      action: "reward.deleted",
      targetType: "reward",
      targetId: id,
    });
    return ok({ deleted: true });
  });
}
