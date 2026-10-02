// Client-side fetch wrapper for the { ok, data | error } API envelope.

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
  const { body, headers, ...rest } = opts;
  // demo build: run entirely on in-browser sample data, never touch the network
  if (process.env.NEXT_PUBLIC_DEMO === "1") {
    const { demoApi } = await import("@/lib/demo/api");
    return demoApi<T>(path, (rest.method as string) || "GET", body);
  }
  const res = await fetch(path, {
    ...rest,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.ok) {
    throw new ApiClientError(
      json?.error?.message ?? res.statusText ?? "Request failed",
      json?.error?.code ?? "error",
      res.status,
    );
  }
  return json.data as T;
}
