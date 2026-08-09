import { handle, ok } from "@/lib/http";
import { requireCustomer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { publicTxn } from "@/lib/serializers";

export async function GET() {
  return handle(async () => {
    const customer = await requireCustomer();
    const transactions = await prisma.walletTransaction.findMany({
      where: { customerId: customer.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return ok({
      balance: customer.balance,
      transactions: transactions.map(publicTxn),
    });
  });
}
