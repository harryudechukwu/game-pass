import { prisma } from "@/lib/db";

// Duplicate-request protection. A client sends a stable key (e.g. an
// Idempotency-Key header); the first request does the work and stores its
// response, later identical requests replay it instead of re-executing.

export async function getIdempotent<T>(key: string | null): Promise<T | null> {
  if (!key) return null;
  const row = await prisma.idempotencyKey.findUnique({ where: { key } });
  return row ? (JSON.parse(row.responseJson) as T) : null;
}

export async function saveIdempotent(
  key: string | null,
  scope: string,
  response: unknown,
): Promise<void> {
  if (!key) return;
  await prisma.idempotencyKey.upsert({
    where: { key },
    create: { key, scope, responseJson: JSON.stringify(response) },
    update: {}, // never overwrite a stored response
  });
}
