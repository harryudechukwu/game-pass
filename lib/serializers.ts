import type {
  Customer,
  Game,
  GameSession,
  PlayPass,
  WalletTransaction,
} from "@prisma/client";

export function formatDuration(seconds: number): string {
  const m = Math.round(seconds / 60);
  return m >= 1 ? `${m} min` : `${seconds}s`;
}

export function firstNameOf(name: string | null): string | null {
  return name ? (name.trim().split(/\s+/)[0] ?? null) : null;
}

export function publicCustomer(c: Customer) {
  return {
    id: c.id,
    phone: c.phone,
    name: c.name,
    firstName: firstNameOf(c.name),
    balance: c.balance,
    suspended: c.suspended,
    createdAt: c.createdAt,
  };
}

export function publicGame(g: Game) {
  return {
    id: g.id,
    slug: g.slug,
    name: g.name,
    description: g.description,
    imageUrl: g.imageUrl,
    pointCost: g.pointCost,
    durationSeconds: g.durationSeconds,
    durationLabel: formatDuration(g.durationSeconds),
    minPlayers: g.minPlayers,
    maxPlayers: g.maxPlayers,
    playersLabel:
      g.minPlayers === g.maxPlayers
        ? `${g.minPlayers} player${g.minPlayers > 1 ? "s" : ""}`
        : `${g.minPlayers}–${g.maxPlayers} players`,
    location: g.location,
    minAge: g.minAge,
    minHeightCm: g.minHeightCm,
    instructions: g.instructions,
    rules: g.rules,
    safety: g.safety,
    status: g.status,
    selfServiceMode: g.selfServiceMode,
    featured: g.featured,
    available: g.status === "active",
  };
}

export function publicPass(
  p: PlayPass & { game?: Game | null; session?: GameSession | null },
  qrDataUrl?: string,
) {
  return {
    id: p.id,
    status: p.status,
    pointCost: p.pointCost,
    createdAt: p.createdAt,
    expiresAt: p.expiresAt,
    activatedAt: p.activatedAt,
    expiresInSeconds: Math.max(
      0,
      Math.floor((p.expiresAt.getTime() - Date.now()) / 1000),
    ),
    game: p.game ? publicGame(p.game) : undefined,
    sessionId: p.session?.id ?? null,
    sessionStatus: p.session?.status ?? null,
    qrDataUrl,
  };
}

export function publicSession(s: GameSession & { game?: Game | null }) {
  return {
    id: s.id,
    status: s.status,
    pointsSpent: s.pointsSpent,
    score: s.score,
    rewardPointsEarned: s.rewardPointsEarned,
    startTime: s.startTime,
    expectedEndTime: s.expectedEndTime,
    completionTime: s.completionTime,
    createdAt: s.createdAt,
    game: s.game ? publicGame(s.game) : undefined,
  };
}

export function publicTxn(t: WalletTransaction) {
  return {
    id: t.id,
    amount: t.amount,
    type: t.type,
    reason: t.reason,
    balanceAfter: t.balanceAfter,
    referenceType: t.referenceType,
    referenceId: t.referenceId,
    createdAt: t.createdAt,
  };
}
