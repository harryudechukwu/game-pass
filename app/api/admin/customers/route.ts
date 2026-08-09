import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { firstNameOf } from "@/lib/serializers";

export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const q = new URL(req.url).searchParams.get("q")?.trim();
    const where = q
      ? { OR: [{ name: { contains: q } }, { phone: { contains: q } }] }
      : {};
    const customers = await prisma.customer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { _count: { select: { sessions: true } } },
    });
    return ok({
      customers: customers.map((c) => ({
        id: c.id,
        name: c.name,
        firstName: firstNameOf(c.name),
        phone: c.phone,
        balance: c.balance,
        suspended: c.suspended,
        sessions: c._count.sessions,
        createdAt: c.createdAt,
      })),
    });
  });
}
