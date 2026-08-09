import { z } from "zod";
import { handle, idempotencyKey, ok, readJson } from "@/lib/http";
import { requireCustomer } from "@/lib/auth";
import { createPlayPass } from "@/lib/playpass";
import { getIdempotent, saveIdempotent } from "@/lib/idempotency";
import { generateQrDataUrl } from "@/lib/qr";
import { publicPass } from "@/lib/serializers";
import { prisma } from "@/lib/db";

const schema = z.object({ gameId: z.string().min(1) });

// Buy a Play Pass. Idempotency-Key header prevents a double-tap from creating
// two passes (and double-charging).
export async function POST(req: Request) {
  return handle(async () => {
    const customer = await requireCustomer();
    const { gameId } = schema.parse(await readJson(req));

    const key = idempotencyKey(req)
      ? `playpass:${customer.id}:${idempotencyKey(req)}`
      : null;
    const cached = await getIdempotent<{ passId: string }>(key);
    if (cached) {
      const pass = await prisma.playPass.findUnique({
        where: { id: cached.passId },
        include: { game: true, session: true },
      });
      if (pass) {
        const qr = await generateQrDataUrl(pass.qrToken);
        return ok({ playPass: publicPass(pass, qr), balance: customer.balance, replay: true });
      }
    }

    const { playPass, balance } = await createPlayPass(customer.id, gameId);
    const full = await prisma.playPass.findUnique({
      where: { id: playPass.id },
      include: { game: true, session: true },
    });
    const qr = await generateQrDataUrl(playPass.qrToken);
    await saveIdempotent(key, "playpass", { passId: playPass.id });
    return ok({ playPass: publicPass(full!, qr), balance }, 201);
  });
}
