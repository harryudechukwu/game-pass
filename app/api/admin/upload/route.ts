import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { nanoid } from "nanoid";
import { ApiError, handle, ok } from "@/lib/http";
import { requireAdmin } from "@/lib/auth";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

// Store an uploaded game image under /public/uploads and return its public URL.
export async function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ApiError(400, "no_file", "No file was uploaded.");
    }
    if (!ALLOWED.has(file.type)) {
      throw new ApiError(400, "bad_type", "Only PNG, JPEG, WEBP or GIF images are allowed.");
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new ApiError(400, "too_large", "Image must be 5MB or smaller.");
    }
    const ext = file.type.split("/")[1].replace("jpeg", "jpg");
    const name = `${Date.now()}-${nanoid(8)}.${ext}`;
    const dir = path.join(process.cwd(), "public", "uploads");
    await mkdir(dir, { recursive: true });
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(path.join(dir, name), buffer);
    return ok({ url: `/uploads/${name}` }, 201);
  });
}
