import { ApiError, handle, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ledgerSum } from "@/lib/wallet";
import { publicCustomer, publicSession, publicTxn } from "@/lib/serializers";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new ApiError(404, "customer_not_found", "Customer not found.");

    const [transactions, sessions, purchases, ledger] = await Promise.all([
      prisma.walletTransaction.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.gameSession.findMany({ where: { customerId: id }, include: { game: true }, orderBy: { createdAt: "desc" }, take: 50 }),
      prisma.purchase.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" }, take: 50 }),
      ledgerSum(id),
    ]);

    return ok({
      customer: publicCustomer(customer),
      suspendedReason: customer.suspendedReason,
      transactions: transactions.map(publicTxn),
      sessions: sessions.map(publicSession),
      purchases,
      integrity: { balance: customer.balance, ledgerSum: ledger, consistent: customer.balance === ledger },
    });
  });
}
