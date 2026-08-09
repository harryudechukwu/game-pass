import type { GameSession, Prisma } from "@prisma/client";
import { creditWithin } from "@/lib/wallet";

type TxClient = Prisma.TransactionClient;

export type IssuedReward = { ruleId: string; name: string; points: number };

// Configurable reward engine. Rules live in the RewardRule table — nothing here
// is game-specific. Runs inside the session-completion transaction so reward
// credits are atomic with the completion itself.
export async function evaluateRewardsWithin(
  tx: TxClient,
  ctx: {
    session: GameSession;
    isFirstVisit: boolean;
    completedCount: number; // total completed sessions incl. this one
  },
): Promise<IssuedReward[]> {
  const { session, isFirstVisit, completedCount } = ctx;
  const rules = await tx.rewardRule.findMany({
    where: { active: true },
    orderBy: { priority: "desc" },
  });

  const issued: IssuedReward[] = [];

  for (const rule of rules) {
    let matched = false;
    switch (rule.conditionType) {
      case "play_completed":
        matched = true;
        break;
      case "score_above":
        matched =
          session.score != null &&
          rule.threshold != null &&
          session.score > rule.threshold;
        break;
      case "games_count":
        matched =
          rule.threshold != null &&
          rule.threshold > 0 &&
          completedCount % rule.threshold === 0;
        break;
      case "first_visit":
        matched = isFirstVisit;
        break;
    }
    if (!matched) continue;

    // first_visit must only ever fire once per customer.
    if (rule.conditionType === "first_visit") {
      const prior = await tx.rewardIssue.findFirst({
        where: { customerId: session.customerId, ruleId: rule.id },
      });
      if (prior) continue;
    }

    const credited = await creditWithin(tx, {
      customerId: session.customerId,
      amount: rule.points,
      type: "reward",
      reason: `Reward — ${rule.name}`,
      referenceType: "reward",
      referenceId: rule.id,
    });
    await tx.rewardIssue.create({
      data: {
        customerId: session.customerId,
        ruleId: rule.id,
        sessionId: session.id,
        points: rule.points,
        walletTxnId: credited.transactionId,
      },
    });
    issued.push({ ruleId: rule.id, name: rule.name, points: rule.points });
  }

  return issued;
}
