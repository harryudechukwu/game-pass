import { NextResponse } from "next/server";
import { handle, HttpError } from "@/lib/server/engine";
import {
  getSession,
  setPlayerSession,
  clearPlayerSession,
  setAdminSession,
  clearAdminSession,
  setAttendantSession,
  clearAttendantSession,
} from "@/lib/server/session";

// Single catch-all API. It parses the path, reads the session cookies, runs the
// domain engine against MongoDB, and applies login/logout cookie side-effects.
export const dynamic = "force-dynamic";

async function dispatch(req: Request, method: string): Promise<NextResponse> {
  const url = new URL(req.url);
  const path = url.pathname;
  let body: Record<string, unknown> = {};
  if (method === "POST" || method === "PATCH" || method === "PUT") {
    body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  }
  const session = await getSession();

  try {
    const data = (await handle(path, method, body, session, url.searchParams)) as Record<string, unknown>;
    const seg = path.split("/").filter(Boolean).slice(1);
    if (seg[0] === "auth" && seg[1] === "login" && method === "POST") await setPlayerSession((data.player as { id: string }).id);
    else if (seg[0] === "auth" && seg[1] === "logout" && method === "POST") await clearPlayerSession();
    else if (seg[0] === "admin" && seg[1] === "login" && method === "POST") await setAdminSession((data.admin as { id: string }).id);
    else if (seg[0] === "admin" && seg[1] === "logout" && method === "POST") await clearAdminSession();
    else if (seg[0] === "attendant" && seg[1] === "login" && method === "POST") await setAttendantSession((data.attendant as { id: string }).id);
    else if (seg[0] === "attendant" && seg[1] === "logout" && method === "POST") await clearAttendantSession();
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    if (e instanceof HttpError) {
      return NextResponse.json({ ok: false, error: { code: e.code, message: e.message } }, { status: e.status });
    }
    console.error("[api] unhandled:", e);
    return NextResponse.json({ ok: false, error: { code: "internal_error", message: "Something went wrong" } }, { status: 500 });
  }
}

export const GET = (req: Request) => dispatch(req, "GET");
export const POST = (req: Request) => dispatch(req, "POST");
export const PATCH = (req: Request) => dispatch(req, "PATCH");
export const DELETE = (req: Request) => dispatch(req, "DELETE");
