import { handle, ok } from "@/lib/http";
import { requireCustomer } from "@/lib/auth";
import { getActivePlayPass } from "@/lib/playpass";
import { generateQrDataUrl } from "@/lib/qr";
import { publicPass } from "@/lib/serializers";

export async function GET() {
  return handle(async () => {
    const customer = await requireCustomer();
    const pass = await getActivePlayPass(customer.id);
    if (!pass) return ok({ playPass: null });
    const qr = await generateQrDataUrl(pass.qrToken);
    // qrToken is exposed here (owner-only) so the demo can deep-link the station
    // simulator. It is the same value already encoded in the QR image.
    return ok({ playPass: { ...publicPass(pass, qr), qrToken: pass.qrToken } });
  });
}
