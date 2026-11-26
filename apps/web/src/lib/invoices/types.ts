export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue" | "cancelled";

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  description: string;
  quantity: string | number;
  unit_price: string | number;
  amount: string | number;
  sort_order?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface InvoicePayment {
  id: number;
  invoice_id: number;
  amount: string | number;
  paid_on: string;
  method: "bank_transfer" | "cash";
  note: string | null;
  recorded_by: number;
  recorded_by_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface AgencyPaymentDetails {
  bank_name: string | null;
  bank_account_number: string | null;
  bank_account_holder: string | null;
  vietqr_payload: string | null;
}

export interface Invoice {
  id: number;
  number: string;
  client_id: number;
  project_id: number | null;
  client: { id: number; name: string };
  project: { id: number; name: string } | null;
  status: InvoiceStatus;
  stored_status: "draft" | "sent" | "paid" | "cancelled";
  issue_date: string;
  due_date: string | null;
  tax_rate: string | number | null;
  subtotal: string | number;
  tax_amount: string | number;
  total: string | number;
  paid_total: string | number;
  balance_due: string | number;
  sent_at: string | null;
  paid_at: string | null;
  notes: string | null;
  items: InvoiceItem[];
  payments: InvoicePayment[];
  agency_payment_details: AgencyPaymentDetails | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface Paginated<T> {
  data: T[];
  meta?: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}
