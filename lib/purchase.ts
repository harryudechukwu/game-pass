import { nanoid } from "nanoid";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { creditWithin } from "@/lib/wallet";
import { audit } from "@/lib/audit";

// Point purchases. Payment is SIMULATED for V1: `initiate` records a pending
// purchase, `confirm` plays the role of the payment-provider webhook. Points are
// credited only on a confirmed-success, and only once (idempotent by reference).

export async function initiatePurchase(customerId: string, packageId: string) {
  const pkg = await prisma.pointPackage.findUnique({ where: { id: packageId } });
  if (!pkg || !pkg.active) {
    throw new ApiError(404, "package_not_found", "That package is not available.");
  }
  const reference = `gp_${nanoid(20)}`;
  const purchase = await prisma.purchase.create({
    data: {
      customerId,
      packageId: pkg.id,
      pointsCredited: pkg.points + pkg.bonusPoints,
      amountKobo: pkg.priceKobo,
      currency: pkg.currency,
      provider: "simulated",
      reference,
      status: "pending",
    },
  });
  await audit({
    actorType: "customer",
    actorId: customerId,
    action: "purchase.initiated",
    targetType: "purchase",
    targetId: purchase.id,
    detail: { packageId, reference },
  });
  return { purchase, pkg };
}

export async function confirmPurchase(
  customerId: string,
  reference: string,
  outcome: "success" | "failed" = "success",
) {
  const res = await prisma.$transaction(async (tx) => {
    const purchase = await tx.purchase.findUnique({
      where: { reference },
      include: { package: true },
    });
    if (!purchase) throw new ApiError(404, "purchase_not_found", "Purchase not found.");
    if (purchase.customerId !== customerId) {
      throw new ApiError(403, "forbidden", "This purchase belongs to another account.");
    }
    // Idempotent: replay a completed purchase without double-crediting.
    if (purchase.status === "success") {
      return { purchase, credited: false, balance: null as number | null };
    }
    if (purchase.status === "failed") {
      throw new ApiError(409, "purchase_failed", "This purchase already failed. Start a new one.");
    }
    if (outcome === "failed") {
      const failed = await tx.purchase.update({
        where: { id: purchase.id },
        data: { status: "failed" },
      });
      return { purchase: failed, credited: false, balance: null };
    }
    const credited = await creditWithin(tx, {
      customerId: purchase.customerId,
      amount: purchase.pointsCredited,
      type: "purchase",
      reason: `Purchased ${purchase.package.name}`,
      referenceType: "purchase",
      referenceId: purchase.id,
    });
    const success = await tx.purchase.update({
      where: { id: purchase.id },
      data: { status: "success", walletTxnId: credited.transactionId },
    });
    return { purchase: success, credited: true, balance: credited.balance };
  });

  await audit({
    actorType: "customer",
    actorId: customerId,
    action: `purchase.${res.purchase.status}`,
    targetType: "purchase",
    targetId: res.purchase.id,
  });
  return res;
}
