import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { evaluateRewardsWithin, type IssuedReward } from "@/lib/rewards";
import { refundAndClosePass } from "@/lib/playpass";
import { audit } from "@/lib/audit";

// ── Game Station API ──────────────────────────────────────────────────────
// A physical station (or the V1 simulator) talks to the backend only through
// these functions. It never sees points, prices, or balances — just a token to
// validate and lifecycle signals to report.

type ActivateInput = {
  qrToken?: string;
  playPassId?: string;
  stationId?: string;
  expectedGameId?: string; // a real station is wired to exactly one game
};

export async function activate(input: ActivateInput) {
  const res = await prisma.$transaction(async (tx) => {
    const where = input.qrToken
      ? { qrToken: input.qrToken }
      : input.playPassId
        ? { id: input.playPassId }
        : null;
    if (!where) throw new ApiError(400, "bad_request", "A QR token or Play Pass id is required.");

    const pass = await tx.playPass.findUnique({
      where,
      include: { game: true, customer: true, session: true },
    });

    // 1. Play Pass exists
    if (!pass) throw new ApiError(404, "pass_not_found", "Play Pass not recognised.");
    // 2. Belongs to a valid, non-suspended customer
    if (!pass.customer || pass.customer.suspended) {
      throw new ApiError(403, "customer_invalid", "Play Pass owner cannot play right now.");
    }
    // 3. Not expired
    if (pass.expiresAt.getTime() < Date.now() || pass.status === "expired") {
      if (pass.status === "created" || pass.status === "activated") {
        await refundAndClosePass(tx, pass, "expired");
      }
      throw new ApiError(410, "pass_expired", "This Play Pass has expired.");
    }
    // 4. Not already used (terminal states)
    if (["completed", "cancelled"].includes(pass.status)) {
      throw new ApiError(409, "pass_used", "This Play Pass has already been used.");
    }
    // 5. Game currently active
    if (pass.game.status !== "active") {
      throw new ApiError(409, "game_unavailable", "This game is currently unavailable.");
    }
    // 6. Game matches the Play Pass
    if (input.expectedGameId && input.expectedGameId !== pass.gameId) {
      throw new ApiError(409, "game_mismatch", "This Play Pass is for a different game.");
    }
    // 7. Session has not already started
    if (pass.session && pass.session.status !== "authorized") {
      throw new ApiError(409, "session_started", "A session has already started for this pass.");
    }

    // Idempotent replay: already activated & waiting -> return existing.
    if (pass.status === "activated" && pass.session) {
      return { playPass: pass, session: pass.session, replay: true };
    }

    const playPass = await tx.playPass.update({
      where: { id: pass.id },
      data: { status: "activated", activatedAt: new Date() },
      include: { game: true },
    });
    const session = await tx.gameSession.create({
      data: {
        customerId: pass.customerId,
        gameId: pass.gameId,
        playPassId: pass.id,
        pointsSpent: pass.pointCost,
        status: "authorized",
        stationId: input.stationId,
      },
    });
    return { playPass, session, replay: false };
  });

  if (!res.replay) {
    await audit({
      actorType: "system",
      action: "session.authorized",
      targetType: "session",
      targetId: res.session.id,
      detail: { stationId: input.stationId, playPassId: res.playPass.id },
    });
  }
  return res;
}

// Report that the physical game has begun. Sets the expected end time from the
// game's configured duration.
export async function start(sessionId: string, stationId?: string) {
  const res = await prisma.$transaction(async (tx) => {
    const session = await tx.gameSession.findUnique({
      where: { id: sessionId },
      include: { game: true },
    });
    if (!session) throw new ApiError(404, "session_not_found", "Session not found.");
    if (session.status === "in_progress") return { session, replay: true };
    if (session.status !== "authorized") {
      throw new ApiError(409, "bad_state", `Cannot start a session that is ${session.status}.`);
    }
    const now = new Date();
    const expectedEndTime = new Date(now.getTime() + session.game.durationSeconds * 1000);
    const updated = await tx.gameSession.update({
      where: { id: session.id },
      data: { status: "in_progress", startTime: now, expectedEndTime, stationId },
    });
    await tx.playPass.update({
      where: { id: session.playPassId },
      data: { status: "in_progress" },
    });
    return { session: updated, replay: false };
  });
  if (!res.replay) {
    await audit({
      actorType: "system",
      action: "session.started",
      targetType: "session",
      targetId: res.session.id,
    });
  }
  return res;
}

// Report completion (optionally with a score). Evaluates configured rewards and
// credits them atomically.
export async function complete(sessionId: string, score?: number | null) {
  const res = await prisma.$transaction(async (tx) => {
    const session = await tx.gameSession.findUnique({ where: { id: sessionId } });
    if (!session) throw new ApiError(404, "session_not_found", "Session not found.");

    if (session.status === "completed") {
      const rewards = await tx.rewardIssue.findMany({ where: { sessionId } });
      return {
        session,
        rewards: rewards.map((r) => ({ ruleId: r.ruleId, name: "", points: r.points })) as IssuedReward[],
        replay: true,
      };
    }
    if (!["authorized", "in_progress"].includes(session.status)) {
      throw new ApiError(409, "bad_state", `Cannot complete a session that is ${session.status}.`);
    }

    const now = new Date();
    let updated = await tx.gameSession.update({
      where: { id: session.id },
      data: {
        status: "completed",
        completionTime: now,
        startTime: session.startTime ?? now,
        score: score ?? session.score,
      },
    });
    await tx.playPass.update({
      where: { id: session.playPassId },
      data: { status: "completed" },
    });

    // First-visit detection (set-once).
    const customer = await tx.customer.findUnique({ where: { id: session.customerId } });
    let isFirstVisit = false;
    if (customer && !customer.firstVisitAt) {
      await tx.customer.update({ where: { id: customer.id }, data: { firstVisitAt: now } });
      isFirstVisit = true;
    }
    const completedCount = await tx.gameSession.count({
      where: { customerId: session.customerId, status: "completed" },
    });

    const rewards = await evaluateRewardsWithin(tx, {
      session: updated,
      isFirstVisit,
      completedCount,
    });
    const totalReward = rewards.reduce((s, r) => s + r.points, 0);
    if (totalReward > 0) {
      updated = await tx.gameSession.update({
        where: { id: session.id },
        data: { rewardPointsEarned: totalReward },
      });
    }
    return { session: updated, rewards, replay: false };
  });

  if (!res.replay) {
    await audit({
      actorType: "system",
      action: "session.completed",
      targetType: "session",
      targetId: res.session.id,
      detail: { score: res.session.score, rewardPointsEarned: res.session.rewardPointsEarned },
    });
  }
  return res;
}

// Physical fault: cancel the session and refund the customer.
export async function reportFault(sessionId: string, reason?: string) {
  const res = await prisma.$transaction(async (tx) => {
    const session = await tx.gameSession.findUnique({
      where: { id: sessionId },
      include: { playPass: true },
    });
    if (!session) throw new ApiError(404, "session_not_found", "Session not found.");
    if (["completed", "cancelled", "expired"].includes(session.status)) {
      throw new ApiError(409, "bad_state", `Session already ${session.status}.`);
    }
    const refund = await refundAndClosePass(tx, session.playPass, "cancelled");
    const updated = await tx.gameSession.update({
      where: { id: session.id },
      data: { status: "cancelled" },
    });
    return { session: updated, refunded: refund.refunded };
  });
  await audit({
    actorType: "system",
    action: "session.fault",
    targetType: "session",
    targetId: sessionId,
    detail: { reason, refunded: res.refunded },
  });
  return res;
}
