import { prisma } from "@/lib/db";

type AuditInput = {
  actorType: "admin" | "system" | "customer";
  actorId?: string | null;
  actorName?: string | null;
  action: string;
  targetType?: string;
  targetId?: string;
  detail?: unknown;
};

// Append-only audit trail. Never throws into the caller — auditing must not
// break the operation it records.
export async function audit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorType: input.actorType,
        actorId: input.actorId ?? null,
        actorName: input.actorName ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId,
        detail: input.detail ? JSON.stringify(input.detail) : null,
      },
    });
  } catch (e) {
    console.error("[audit] failed to write:", e);
  }
}
