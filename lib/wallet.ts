import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/http";

type TxClient = Prisma.TransactionClient;

export type CreditType =
  | "signup_bonus"
  | "purchase"
  | "reward"
  | "promo"
  | "refund"
  | "admin_credit";

export type DebitType = "play_spend" | "admin_debit";

type CreditInput = {
  customerId: string;
  amount: number; // always positive
  type: CreditType;
  reason: string;
  referenceType?: string;
  referenceId?: string;
  createdByAdminId?: string;
};

type DebitInput = Omit<CreditInput, "type"> & { type: DebitType };

export type LedgerResult = {
  transactionId: string;
  balance: number;
};

// ── Building blocks that run inside an existing transaction ───────────────
// Exported so higher-level flows (create play pass, complete session) can bundle
// a wallet mutation together with their own writes in a single atomic unit.

export async function creditWithin(
  tx: TxClient,
  input: CreditInput,
): Promise<LedgerResult> {
  if (input.amount <= 0) {
    throw new ApiError(400, "invalid_amount", "Credit amount must be positive");
  }
  const updated = await tx.customer.update({
    where: { id: input.customerId },
    data: { balance: { increment: input.amount } },
    select: { balance: true },
  });
  const txn = await tx.walletTransaction.create({
    data: {
      customerId: input.customerId,
      amount: input.amount,
      type: input.type,
      reason: input.reason,
      balanceAfter: updated.balance,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      createdByAdminId: input.createdByAdminId,
    },
  });
  return { transactionId: txn.id, balance: updated.balance };
}

export async function debitWithin(
  tx: TxClient,
  input: DebitInput,
): Promise<LedgerResult> {
  if (input.amount <= 0) {
    throw new ApiError(400, "invalid_amount", "Debit amount must be positive");
  }
  // Atomic, conditional decrement. Because SQLite serialises writes, two
  // concurrent debits cannot both satisfy `balance >= amount` — this is what
  // prevents double-spending / negative balances without app-level locks.
  const res = await tx.customer.updateMany({
    where: {
      id: input.customerId,
      suspended: false,
      balance: { gte: input.amount },
    },
    data: { balance: { decrement: input.amount } },
  });

  if (res.count === 0) {
    const c = await tx.customer.findUnique({
      where: { id: input.customerId },
      select: { balance: true, suspended: true },
    });
    if (!c) throw new ApiError(404, "customer_not_found", "Customer not found");
    if (c.suspended) {
      throw new ApiError(403, "account_suspended", "This account is suspended");
    }
    throw new ApiError(
      402,
      "insufficient_points",
      `Not enough points. Balance is ${c.balance}, this costs ${input.amount}.`,
    );
  }

  const after = await tx.customer.findUnique({
    where: { id: input.customerId },
    select: { balance: true },
  });
  const txn = await tx.walletTransaction.create({
    data: {
      customerId: input.customerId,
      amount: -input.amount,
      type: input.type,
      reason: input.reason,
      balanceAfter: after!.balance,
      referenceType: input.referenceType,
      referenceId: input.referenceId,
      createdByAdminId: input.createdByAdminId,
    },
  });
  return { transactionId: txn.id, balance: after!.balance };
}

// ── Standalone wrappers ───────────────────────────────────────────────────

export function credit(input: CreditInput): Promise<LedgerResult> {
  return prisma.$transaction((tx) => creditWithin(tx, input));
}

export function debit(input: DebitInput): Promise<LedgerResult> {
  return prisma.$transaction((tx) => debitWithin(tx, input));
}

export async function getBalance(customerId: string): Promise<number> {
  const c = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { balance: true },
  });
  return c?.balance ?? 0;
}

// Integrity check used by admin tooling: the mirrored balance must always equal
// the sum of the ledger.
export async function ledgerSum(customerId: string): Promise<number> {
  const agg = await prisma.walletTransaction.aggregate({
    where: { customerId },
    _sum: { amount: true },
  });
  return agg._sum.amount ?? 0;
}
