import { handle, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  return handle(async () => {
    const admin = await requireAdmin();
    return ok({ admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
  });
}
