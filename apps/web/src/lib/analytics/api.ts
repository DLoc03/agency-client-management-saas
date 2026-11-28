import type { AnalyticsOverview } from "./types";

async function request<T>(path: string): Promise<T> {
  const res = await fetch(path, {
    headers: { Accept: "application/json" },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body?.error?.message || `Request failed (${res.status})`;
    const err = new Error(msg) as Error & { code?: string; status?: number };
    err.code = body?.error?.code;
    err.status = res.status;
    throw err;
  }
  return body as T;
}

export async function getAnalyticsOverview() {
  const res = await request<{ data: AnalyticsOverview }>("/api/analytics/overview");
  return res.data;
}
