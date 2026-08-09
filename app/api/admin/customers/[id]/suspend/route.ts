import { z } from "zod";
import { ApiError, handle, ok, readJson } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const schema = z.object({ suspend: z.boolean(), reason: z.string().max(300).optional() });

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await params;
    const { suspend, reason } = schema.parse(await readJson(req));
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new ApiError(404, "customer_not_found", "Customer not found.");

    await prisma.customer.update({
      where: { id },
      data: { suspended: suspend, suspendedReason: suspend ? (reason ?? "Suspended by staff") : null },
    });
    await audit({
      actorType: "admin",
      actorId: admin.id,
      actorName: admin.name,
      action: suspend ? "customer.suspended" : "customer.reinstated",
      targetType: "customer",
      targetId: id,
      detail: { reason },
    });
    return ok({ suspended: suspend });
  });
}
