import { z } from "zod";
import { ApiError, handle, ok, readJson } from "@/lib/http";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { setAdminSession } from "@/lib/auth";
import { audit } from "@/lib/audit";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(req: Request) {
  return handle(async () => {
    const { email, password } = schema.parse(await readJson(req));
    const admin = await prisma.adminUser.findUnique({ where: { email: email.toLowerCase() } });
    if (!admin || !verifyPassword(password, admin.passwordHash)) {
      throw new ApiError(401, "invalid_credentials", "Incorrect email or password.");
    }
    await setAdminSession(admin.id, admin.role);
    await audit({ actorType: "admin", actorId: admin.id, actorName: admin.name, action: "admin.login" });
    return ok({ admin: { id: admin.id, name: admin.name, email: admin.email, role: admin.role } });
  });
}
