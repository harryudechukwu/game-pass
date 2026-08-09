import { ApiError, handle, ok } from "@/lib/http";
import { requireCustomer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateQrDataUrl } from "@/lib/qr";
import { publicPass } from "@/lib/serializers";

// A Play Pass can only ever be read by its owner — it is not transferable.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const customer = await requireCustomer();
    const { id } = await params;
    const pass = await prisma.playPass.findUnique({
      where: { id },
      include: { game: true, session: true },
    });
    if (!pass || pass.customerId !== customer.id) {
      throw new ApiError(404, "pass_not_found", "Play Pass not found.");
    }
    const qr =
      pass.status === "created" || pass.status === "activated"
        ? await generateQrDataUrl(pass.qrToken)
        : undefined;
    return ok({ playPass: { ...publicPass(pass, qr), qrToken: pass.qrToken } });
  });
}
