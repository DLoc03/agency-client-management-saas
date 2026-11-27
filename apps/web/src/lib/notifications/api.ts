export type { NotificationItem, Paginated } from "./types";

import type { NotificationItem, Paginated } from "./types";

export class NotificationApiError extends Error {
  code: string;
  status: number;

  constructor(message: string, code: string, status: number) {
    super(message);
    this.name = "NotificationApiError";
    this.code = code;
    this.status = status;
  }
}

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
    const payload = body?.error || {};
    throw new NotificationApiError(
      payload.message || `Request failed (${res.status})`,
      payload.code || (res.status === 403 ? "FORBIDDEN" : "UNKNOWN"),
      res.status,
    );
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

export async function listNotifications(params: Record<string, string | number | undefined> = {}): Promise<Paginated<NotificationItem>> {
  return request<Paginated<NotificationItem>>(`/api/notifications${queryString(params)}`);
}

export async function getUnreadCount(): Promise<number> {
  const res = await request<{ data: { count: number } }>("/api/notifications/unread-count");
  return res.data?.count ?? 0;
}

export async function markNotificationRead(id: number): Promise<NotificationItem> {
  const res = await request<{ data: NotificationItem }>(`/api/notifications/${id}/read`, { method: "POST" });
  return res.data;
}

export async function markAllNotificationsRead(): Promise<void> {
  await request("/api/notifications/read-all", { method: "POST" });
}
