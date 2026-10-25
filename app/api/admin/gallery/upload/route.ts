import { NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { cols } from "@/lib/server/db";
import { getSession } from "@/lib/server/session";
import type { GalleryPhoto } from "@/lib/server/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024;
const MAX_PHOTOS = 40;

function fail(status: number, message: string) {
  return NextResponse.json({ ok: false, error: { code: "gallery_upload_error", message } }, { status });
}

function imageMime(bytes: Uint8Array): string | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return "image/png";
  if (bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session.adminId) return fail(401, "Sign in as an admin to upload venue photos.");

  try {
    const c = await cols();
    const admin = await c.admins.findOne({ _id: session.adminId });
    if (!admin || admin.active === false || admin.role !== "admin") return fail(403, "Only the owner admin can manage the website gallery.");

    const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
    const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
    const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
    if (!cloudName || !/^[a-zA-Z0-9_-]+$/.test(cloudName) || !apiKey || !apiSecret) {
      return fail(503, "Gallery uploads are not configured. Set the Cloudinary credentials in your deployment environment.");
    }

    const sizeHeader = Number(request.headers.get("content-length"));
    if (sizeHeader > MAX_BYTES + 100_000) return fail(413, "Choose an image smaller than 4 MB.");
    if (await c.gallery.countDocuments({ published: true }) >= MAX_PHOTOS) return fail(409, "The gallery is full. Hide an older photo before adding more.");

    const form = await request.formData();
    const file = form.get("file");
    const alt = String(form.get("alt") ?? "").trim();
    const caption = String(form.get("caption") ?? "").trim();
    if (!file || typeof file === "string") return fail(400, "Choose a photo to upload.");
    if (file.size === 0 || file.size > MAX_BYTES) return fail(413, "Choose an image smaller than 4 MB.");
    if (alt.length < 5 || alt.length > 140) return fail(400, "Describe the photo in 5–140 characters.");
    if (caption.length > 120) return fail(400, "Caption must be 120 characters or fewer.");

    const bytes = new Uint8Array(await file.arrayBuffer());
    const mime = imageMime(bytes);
    if (!mime) return fail(400, "Use a JPEG, PNG, or WebP image.");

    const upload = new FormData();
    upload.append("file", new Blob([bytes], { type: mime }), `venue-${nanoid(10)}.${mime.split("/")[1]}`);
    upload.append("folder", "creamy-castle/gallery");
    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:${apiSecret}`).toString("base64")}` },
      body: upload,
      signal: AbortSignal.timeout(25000),
    });
    if (!response.ok) {
      console.error("[gallery] Cloudinary upload failed:", response.status);
      return fail(502, "The photo could not be uploaded. Please try again.");
    }
    const result = await response.json() as { secure_url?: unknown; public_id?: unknown; width?: unknown; height?: unknown };
    const url = typeof result.secure_url === "string" ? result.secure_url : "";
    const publicId = typeof result.public_id === "string" ? result.public_id : "";
    const location = new URL(url);
    if (location.protocol !== "https:" || location.hostname !== "res.cloudinary.com" ||
        !location.pathname.startsWith(`/${cloudName}/image/upload/`) || !publicId ||
        !Number.isInteger(result.width) || !Number.isInteger(result.height)) {
      return fail(502, "The image host returned an invalid response.");
    }

    const photo: GalleryPhoto = {
      _id: `pic_${nanoid(12)}`,
      url,
      cloudinaryId: publicId,
      alt,
      caption,
      width: result.width as number,
      height: result.height as number,
      published: true,
      createdAt: Date.now(),
    };
    await c.gallery.insertOne(photo);
    return NextResponse.json({ ok: true, data: { photo } }, { status: 201 });
  } catch (error) {
    console.error("[gallery] upload error:", error);
    return fail(500, "The photo could not be saved. Please try again.");
  }
}
