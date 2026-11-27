import type {
  DirectoryUser,
  Lead,
  LeadActivity,
  LeadContact,
  LeadNote,
  Paginated,
  PipelineSummaryRow,
} from "./types";
import { LeadApiError } from "./types";

/**
 * CRM / Lead API client (FE-011). Talks to the BFF routes under /api/*,
 * which proxy to the Laravel API with the httpOnly session cookie (FE-004
 * pattern). Mirrors src/lib/clients/api.ts; errors carry the API error code
 * so the convert flow can react to DUPLICATE_CLIENT_CANDIDATE / 409.
 */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers || {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = body?.error?.message || `Request failed (${res.status})`;
    throw new LeadApiError(msg, body?.error?.code);
  }
  return body as T;
}

function queryString(params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== "" && v !== null) qs.set(k, String(v));
  });
  const q = qs.toString();
  return q ? `?${q}` : "";
}

/* ---------------- Leads ---------------- */

export async function listLeads(
  params: Record<string, string | number | undefined> = {},
) {
  const res = await request<Paginated<Lead>>(`/api/leads${queryString(params)}`);
  return res.data || [];
}

export async function listLeadsPage(
  params: Record<string, string | number | undefined> = {},
) {
  return request<Paginated<Lead>>(`/api/leads${queryString(params)}`);
}

export async function getLead(id: number) {
  const res = await request<{ data: Lead }>(`/api/leads/${id}`);
  return res.data;
}

export async function createLead(payload: Record<string, unknown>) {
  const res = await request<{ data: Lead }>("/api/leads", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateLead(id: number, payload: Record<string, unknown>) {
  const res = await request<{ data: Lead }>(`/api/leads/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteLead(id: number) {
  await request(`/api/leads/${id}`, { method: "DELETE" });
}

export async function convertLead(
  id: number,
  payload: { force?: boolean; account_manager_id?: number | null },
) {
  const res = await request<{ data: { id: number } }>(`/api/leads/${id}/convert`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function getPipelineSummary() {
  const res = await request<{ data: PipelineSummaryRow[] }>(
    "/api/leads/pipeline-summary",
  );
  return res.data || [];
}

/* ---------------- Contacts (shared table) ---------------- */

export async function listLeadContacts(leadId: number) {
  const res = await request<Paginated<LeadContact>>(`/api/leads/${leadId}/contacts?per_page=100`);
  return res.data || [];
}

export async function createLeadContact(
  leadId: number,
  payload: Record<string, unknown>,
) {
  const res = await request<{ data: LeadContact }>(`/api/leads/${leadId}/contacts`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateLeadContact(
  leadId: number,
  contactId: number,
  payload: Record<string, unknown>,
) {
  const res = await request<{ data: LeadContact }>(
    `/api/leads/${leadId}/contacts/${contactId}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
  return res.data;
}

export async function deleteLeadContact(leadId: number, contactId: number) {
  await request(`/api/leads/${leadId}/contacts/${contactId}`, { method: "DELETE" });
}

/* ---------------- Notes ---------------- */

export async function listLeadNotes(leadId: number) {
  const res = await request<Paginated<LeadNote>>(`/api/leads/${leadId}/notes?per_page=100`);
  return res.data || [];
}

export async function createLeadNote(leadId: number, body: string) {
  const res = await request<{ data: LeadNote }>(`/api/leads/${leadId}/notes`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  return res.data;
}

export async function deleteLeadNote(leadId: number, noteId: number) {
  await request(`/api/leads/${leadId}/notes/${noteId}`, { method: "DELETE" });
}

/* ---------------- Activities ---------------- */

export async function listLeadActivities(leadId: number) {
  const res = await request<Paginated<LeadActivity>>(
    `/api/leads/${leadId}/activities?per_page=100`,
  );
  return res.data || [];
}

export async function createLeadActivity(
  leadId: number,
  payload: Record<string, unknown>,
) {
  const res = await request<{ data: LeadActivity }>(
    `/api/leads/${leadId}/activities`,
    { method: "POST", body: JSON.stringify(payload) },
  );
  return res.data;
}

export async function updateLeadActivity(
  leadId: number,
  activityId: number,
  payload: Record<string, unknown>,
) {
  const res = await request<{ data: LeadActivity }>(
    `/api/leads/${leadId}/activities/${activityId}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
  return res.data;
}

export async function deleteLeadActivity(leadId: number, activityId: number) {
  await request(`/api/leads/${leadId}/activities/${activityId}`, {
    method: "DELETE",
  });
}

export async function listDueActivities() {
  const res = await request<Paginated<LeadActivity>>("/api/lead-activities/due?per_page=100");
  return res.data || [];
}

/* ---------------- Directory (owner picker) ---------------- */

export async function listDirectoryUsers() {
  const res = await request<Paginated<DirectoryUser>>("/api/users");
  return res.data || [];
}
