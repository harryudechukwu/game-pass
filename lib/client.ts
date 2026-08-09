import { localApi, LocalError } from "@/lib/local/api";

// This used to be a fetch wrapper hitting a REST backend. In the demo build there
// is no server — `api()` dispatches to the in-browser engine over localStorage,
// keeping the exact same signature and return shapes so no page had to change.

export class ApiClientError extends Error {
  code: string;
  status: number;
  constructor(message: string, code: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

type Options = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown;
  headers?: Record<string, string>;
};

export async function api<T = unknown>(path: string, opts: Options = {}): Promise<T> {
  const method = (opts.method ?? "GET").toString().toUpperCase();
  try {
    const data = await localApi(
      path,
      method,
      opts.body as Record<string, unknown> | undefined,
      opts.headers,
    );
    return data as T;
  } catch (e) {
    if (e instanceof LocalError) throw new ApiClientError(e.message, e.code, e.status);
    throw e;
  }
}
