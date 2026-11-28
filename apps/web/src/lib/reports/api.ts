import type { Paginated, ProjectReportRow, ClientReportRow, RevenueReport } from "./types";

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

export async function getRevenueReport(params: { from?: string; to?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  const q = qs.toString();
  const res = await request<{ data: RevenueReport }>(`/api/reports/revenue${q ? `?${q}` : ""}`);
  return res.data;
}

export function revenueExportUrl(params: { from?: string; to?: string } = {}) {
  const qs = new URLSearchParams();
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  const q = qs.toString();
  return `/api/reports/revenue/export${q ? `?${q}` : ""}`;
}

export async function listProjectsReport(params: Record<string, string | number | undefined> = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== null) qs.set(k, String(v));
  });
  const q = qs.toString();
  return request<Paginated<ProjectReportRow>>(`/api/reports/projects${q ? `?${q}` : ""}`);
}

export async function listClientsReport(params: Record<string, string | number | undefined> = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== null) qs.set(k, String(v));
  });
  const q = qs.toString();
  return request<Paginated<ClientReportRow>>(`/api/reports/clients${q ? `?${q}` : ""}`);
}
