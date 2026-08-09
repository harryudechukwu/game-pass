import type { Prisma } from "@prisma/client";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/http";
import { creditWithin, debitWithin } from "@/lib/wallet";
import { audit } from "@/lib/audit";

type TxClient = Prisma.TransactionClient;

// Create a single-use Play Pass. Points are debited here — atomically with the
// pass row — using the server-side game price. The client never supplies price.
export async function createPlayPass(customerId: string, gameId: string) {
  const game = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new ApiError(404, "game_not_found", "Game not found.");
  if (game.status !== "active") {
    throw new ApiError(409, "game_unavailable", `${game.name} is currently unavailable.`);
  }

  // One active pass at a time keeps the customer experience unambiguous.
  await expireStalePasses(customerId);
  const existing = await prisma.playPass.findFirst({
    where: { customerId, status: { in: ["created", "activated", "in_progress"] } },
  });
  if (existing) {
    throw new ApiError(
      409,
      "pass_active",
      "You already have an active Play Pass. Use or cancel it before buying another.",
    );
  }

  const qrToken = `pp_${nanoid(32)}`;
  const expiresAt = new Date(Date.now() + env.playPassTtlSeconds * 1000);

  const result = await prisma.$transaction(async (tx) => {
    const debit = await debitWithin(tx, {
      customerId,
      amount: game.pointCost,
      type: "play_spend",
      reason: `Play Pass — ${game.name}`,
    });
    const playPass = await tx.playPass.create({
      data: {
        customerId,
        gameId: game.id,
        pointCost: game.pointCost,
        status: "created",
        qrToken,
        expiresAt,
      },
    });
    // Back-fill the ledger reference now that the pass id exists.
    await tx.walletTransaction.update({
      where: { id: debit.transactionId },
      data: { referenceType: "play_pass", referenceId: playPass.id },
    });
    return { playPass, balance: debit.balance };
  });

  await audit({
    actorType: "customer",
    actorId: customerId,
    action: "play_pass.created",
    targetType: "play_pass",
    targetId: result.playPass.id,
    detail: { gameId, pointCost: game.pointCost },
  });
  return result;
}

// Cancel a not-yet-played pass and refund the points.
export async function cancelPlayPass(customerId: string, playPassId: string) {
  const pass = await prisma.playPass.findUnique({
    where: { id: playPassId },
    include: { game: true },
  });
  if (!pass || pass.customerId !== customerId) {
    throw new ApiError(404, "pass_not_found", "Play Pass not found.");
  }
  if (!["created", "activated"].includes(pass.status)) {
    throw new ApiError(409, "pass_not_cancellable", "This Play Pass can no longer be cancelled.");
  }
  const result = await prisma.$transaction((tx) => refundAndClosePass(tx, pass, "cancelled"));
  await audit({
    actorType: "customer",
    actorId: customerId,
    action: "play_pass.cancelled",
    targetType: "play_pass",
    targetId: pass.id,
  });
  return result;
}

// Refund (if still unplayed) and set a terminal status. Shared by cancel + expiry.
export async function refundAndClosePass(
  tx: TxClient,
  pass: { id: string; customerId: string; pointCost: number; status: string; gameId: string },
  terminalStatus: "cancelled" | "expired",
) {
  let refunded = 0;
  if (pass.status === "created" || pass.status === "activated") {
    const game = await tx.game.findUnique({ where: { id: pass.gameId }, select: { name: true } });
    const credit = await creditWithin(tx, {
      customerId: pass.customerId,
      amount: pass.pointCost,
      type: "refund",
      reason: `Refund — ${terminalStatus} Play Pass (${game?.name ?? "game"})`,
      referenceType: "play_pass",
      referenceId: pass.id,
    });
    refunded = pass.pointCost;
    void credit;
  }
  await tx.playPass.update({ where: { id: pass.id }, data: { status: terminalStatus } });
  await tx.gameSession.updateMany({
    where: { playPassId: pass.id, status: { in: ["authorized", "pending", "in_progress"] } },
    data: { status: terminalStatus === "cancelled" ? "cancelled" : "expired" },
  });
  return { refunded };
}

// Lazily expire (and refund) passes past their TTL. Called opportunistically on
// reads and by the /api/maintenance/expire sweep — no background worker needed.
export async function expireStalePasses(customerId?: string): Promise<number> {
  const stale = await prisma.playPass.findMany({
    where: {
      status: { in: ["created", "activated"] },
      expiresAt: { lt: new Date() },
      ...(customerId ? { customerId } : {}),
    },
    take: 200,
  });
  for (const pass of stale) {
    await prisma.$transaction((tx) => refundAndClosePass(tx, pass, "expired"));
    await audit({
      actorType: "system",
      action: "play_pass.expired",
      targetType: "play_pass",
      targetId: pass.id,
    });
  }
  return stale.length;
}

// The customer's current usable pass (if any), after clearing stale ones.
export async function getActivePlayPass(customerId: string) {
  await expireStalePasses(customerId);
  return prisma.playPass.findFirst({
    where: { customerId, status: { in: ["created", "activated", "in_progress"] } },
    include: { game: true, session: true },
    orderBy: { createdAt: "desc" },
  });
}
