import { handle, ok } from "@/lib/http";
import { requireCustomer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { publicSession, publicTxn } from "@/lib/serializers";

// The activity feed is driven by the wallet ledger (spends, rewards, purchases,
// bonuses, refunds) plus the session history (games actually played).
export async function GET() {
  return handle(async () => {
    const customer = await requireCustomer();
    const [transactions, sessions] = await Promise.all([
      prisma.walletTransaction.findMany({
        where: { customerId: customer.id },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.gameSession.findMany({
        where: { customerId: customer.id },
        include: { game: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    ]);
    return ok({
      balance: customer.balance,
      transactions: transactions.map(publicTxn),
      sessions: sessions.map(publicSession),
    });
  });
}
