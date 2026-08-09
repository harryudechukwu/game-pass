import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { env } from "@/lib/env";

// A small, consistent envelope for every API response:
//   success -> { ok: true, data }
//   failure -> { ok: false, error: { code, message } }

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function ok(data: unknown, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}

export function fail(status: number, code: string, message: string) {
  return NextResponse.json(
    { ok: false, error: { code, message } },
    { status },
  );
}

// Wrap a route handler body so thrown ApiError / ZodError become clean JSON.
export async function handle(
  fn: () => Promise<NextResponse>,
): Promise<NextResponse> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError) return fail(e.status, e.code, e.message);
    if (e instanceof ZodError) {
      return fail(
        400,
        "validation_error",
        e.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      );
    }
    console.error("[api] unhandled error:", e);
    return fail(500, "internal_error", "Something went wrong");
  }
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError(400, "bad_json", "Request body must be valid JSON.");
  }
}

export function idempotencyKey(req: Request): string | null {
  return req.headers.get("idempotency-key");
}

// Physical stations authenticate with a shared secret, never a customer session.
export function requireStationKey(req: Request): void {
  const key = req.headers.get("x-station-key");
  if (!key || key !== env.stationApiKey) {
    throw new ApiError(401, "station_unauthorized", "Invalid or missing station key.");
  }
}
