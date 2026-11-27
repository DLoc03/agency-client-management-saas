export type {
  AgencyPaymentDetails,
  Invoice,
  InvoiceItem,
  InvoicePayment,
  InvoiceStatus,
  Paginated,
} from "./types";

import type {
  AgencyPaymentDetails,
  Invoice,
  InvoiceItem,
  InvoicePayment,
  Paginated,
} from "./types";

/**
 * Invoice-module API client (FE-020). Talks to the BFF routes under /api/*,
 * which proxy to the Laravel API with the httpOnly session cookie (FE-004
 * pattern). Mirrors src/lib/clients/api.ts.
 */

/** Structured API error carrying the backend error code + HTTP status. */
export class InvoiceApiError extends Error {
  code: string;
  status: number;
  details: Record<string, string[]> | null;

  constructor(message: string, code: string, status: number, details = null) {
    super(message);
    this.name = "InvoiceApiError";
    this.code = code;
    this.status = status;
    this.details = details;
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
    throw new InvoiceApiError(
      payload.message || `Request failed (${res.status})`,
      payload.code || (res.status === 403 ? "FORBIDDEN" : "UNKNOWN"),
      res.status,
      payload.details || null,
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

/* ---------------- Invoices ---------------- */

export async function listInvoicesPage(
  params: Record<string, string | number | undefined> = {},
): Promise<Paginated<Invoice>> {
  return request<Paginated<Invoice>>(`/api/invoices${queryString(params)}`);
}

export async function listInvoices(
  params: Record<string, string | number | undefined> = {},
): Promise<Invoice[]> {
  const res = await listInvoicesPage(params);
  return res.data || [];
}

export async function getInvoice(id: number): Promise<Invoice> {
  const res = await request<{ data: Invoice }>(`/api/invoices/${id}`);
  return res.data;
}

export interface InvoiceCreateInput {
  client_id: number;
  project_id?: number | null;
  tax_rate?: string | number | null;
  issue_date?: string | null;
  due_date?: string | null;
  notes?: string | null;
  items: Array<{
    description: string;
    quantity: string | number;
    unit_price: string | number;
  }>;
}

export async function createInvoice(payload: InvoiceCreateInput): Promise<Invoice> {
  const res = await request<{ data: Invoice }>("/api/invoices", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function updateInvoice(id: number, payload: InvoiceCreateInput): Promise<Invoice> {
  const res = await request<{ data: Invoice }>(`/api/invoices/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return res.data;
}

export async function deleteInvoice(id: number): Promise<void> {
  await request(`/api/invoices/${id}`, { method: "DELETE" });
}

export async function sendInvoice(id: number): Promise<Invoice> {
  const res = await request<{ data: Invoice }>(`/api/invoices/${id}/send`, {
    method: "POST",
  });
  return res.data;
}

export async function cancelInvoice(id: number): Promise<Invoice> {
  const res = await request<{ data: Invoice }>(`/api/invoices/${id}/cancel`, {
    method: "POST",
  });
  return res.data;
}

export async function getInvoicePdf(id: number): Promise<Blob> {
  const res = await fetch(`/api/invoices/${id}/pdf`, {
    method: "GET",
    headers: { Accept: "application/pdf" },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    const payload = body?.error || {};
    throw new InvoiceApiError(
      payload.message || `PDF failed (${res.status})`,
      payload.code || "UNKNOWN",
      res.status,
      payload.details || null,
    );
  }
  return res.blob();
}

/* ---------------- Payments ---------------- */

export interface PaymentCreateInput {
  amount: string | number;
  paid_on?: string | null;
  method: "bank_transfer" | "cash";
  note?: string | null;
}

export async function listPayments(invoiceId: number): Promise<InvoicePayment[]> {
  const res = await request<Paginated<InvoicePayment>>(
    `/api/invoices/${invoiceId}/payments?per_page=100`,
  );
  return res.data || [];
}

export async function recordPayment(
  invoiceId: number,
  payload: PaymentCreateInput,
): Promise<InvoicePayment> {
  const res = await request<{ data: InvoicePayment }>(
    `/api/invoices/${invoiceId}/payments`,
    { method: "POST", body: JSON.stringify(payload) },
  );
  return res.data;
}

export async function deletePayment(paymentId: number): Promise<void> {
  await request(`/api/payments/${paymentId}`, { method: "DELETE" });
}

/* ---------------- Agency payment details ---------------- */

export interface AgencyPaymentDetailsInput {
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_account_holder?: string | null;
  vietqr_payload?: string | null;
}

export async function updateAgencyPaymentDetails(
  agencyId: number | string,
  payload: AgencyPaymentDetailsInput,
): Promise<AgencyPaymentDetails> {
  const res = await request<{ data: AgencyPaymentDetails }>(
    `/api/agencies/${agencyId}/payment-details`,
    { method: "PATCH", body: JSON.stringify(payload) },
  );
  return res.data;
}
