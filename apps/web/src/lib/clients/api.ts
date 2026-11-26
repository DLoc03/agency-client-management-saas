import type {
  Client,
  ClientNote,
  Contact,
  DirectoryUser,
  Paginated,
  PortalAccount,
  PortalGrantResult,
  Tag,
} from "./types";

/**
 * Client-module API client (FE-010). Talks to the BFF routes under /api/*,
 * which proxy to the Laravel API with the httpOnly session cookie (FE-004
 * pattern). Mirrors src/lib/projects/api.ts.
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
    const err = new Error(msg) as Error & { code?: string; status?: number };
    err.code = body?.error?.code;
    err.status = res.status;
    throw err;
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

/* ---------------- Clients ---------------- */

export async function listClients(
  params: Record<string, string | number | undefined> = {},
) {
  const res = await request<Paginated<Client>>(`/api/clients${queryString(params)}`);
  return res.data || [];
}

export async function getClient(id: number) {
  const res = await request<{ data: Client }>(`/api/clients/${id}`);
  return res.data;
}

export async function createClient(payload: Record<string, unknown>) {
  const res = await request<{ data: Client }>("/api/clients", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateClient(id: number, payload: Record<string, unknown>) {
  const res = await request<{ data: Client }>(`/api/clients/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteClient(id: number) {
  await request(`/api/clients/${id}`, { method: "DELETE" });
}

/* ---------------- Contacts ---------------- */

export async function listContacts(clientId: number) {
  const res = await request<Paginated<Contact>>(`/api/clients/${clientId}/contacts`);
  return res.data || [];
}

export async function createContact(clientId: number, payload: Record<string, unknown>) {
  const res = await request<{ data: Contact }>(`/api/clients/${clientId}/contacts`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateContact(
  clientId: number,
  contactId: number,
  payload: Record<string, unknown>,
) {
  const res = await request<{ data: Contact }>(
    `/api/clients/${clientId}/contacts/${contactId}`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
  return res.data;
}

export async function deleteContact(clientId: number, contactId: number) {
  await request(`/api/clients/${clientId}/contacts/${contactId}`, { method: "DELETE" });
}

/* ---------------- Notes (internal only) ---------------- */

export async function listNotes(clientId: number) {
  const res = await request<Paginated<ClientNote>>(`/api/clients/${clientId}/notes`);
  return res.data || [];
}

export async function createNote(clientId: number, body: string) {
  const res = await request<{ data: ClientNote }>(`/api/clients/${clientId}/notes`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
  return res.data;
}

export async function deleteNote(clientId: number, noteId: number) {
  await request(`/api/clients/${clientId}/notes/${noteId}`, { method: "DELETE" });
}

/* ---------------- Tags ---------------- */

export async function listTags() {
  const res = await request<Paginated<Tag>>("/api/tags");
  return res.data || [];
}

export async function createTag(payload: Record<string, unknown>) {
  const res = await request<{ data: Tag }>("/api/tags", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

/* ---------------- Portal accounts ---------------- */

export async function listPortalAccounts(clientId: number) {
  const res = await request<Paginated<PortalAccount>>(
    `/api/clients/${clientId}/portal-accounts`,
  );
  return res.data || [];
}

export async function createPortalAccount(
  clientId: number,
  payload: Record<string, unknown>,
) {
  const res = await request<{ data: PortalGrantResult }>(
    `/api/clients/${clientId}/portal-accounts`,
    { method: "POST", body: JSON.stringify(payload) },
  );
  return res.data;
}

export async function setPortalAccountActive(
  clientId: number,
  accountId: number,
  isActive: boolean,
) {
  const res = await request<{ data: PortalAccount }>(
    `/api/clients/${clientId}/portal-accounts/${accountId}`,
    { method: "PATCH", body: JSON.stringify({ is_active: isActive }) },
  );
  return res.data;
}

/* ---------------- Directory (account-manager picker) ---------------- */

export async function listDirectoryUsers() {
  const res = await request<Paginated<DirectoryUser>>("/api/users");
  return res.data || [];
}
