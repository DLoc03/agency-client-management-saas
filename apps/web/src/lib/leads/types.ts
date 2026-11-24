/**
 * CRM / Lead module types — derived from docs/CRM_CONTRACT.md (BE-005, DEC-014)
 * and the API resources (LeadResource, LeadNoteResource, LeadActivityResource,
 * shared ContactResource).
 */

export type LeadStatus = "new" | "contacted" | "qualified" | "unqualified";
export type LeadSource =
  | "website"
  | "referral"
  | "social"
  | "cold_outreach"
  | "other";
export type LeadActivityType = "call" | "message" | "meeting" | "other";

export interface LeadOwner {
  id: number;
  name: string;
  email: string;
}

export interface LeadContact {
  id: number;
  client_id: number | null;
  lead_id: number | null;
  organization_id: number | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  is_primary: boolean;
}

export interface Lead {
  id: number;
  name: string;
  company_name: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  source: LeadSource | null;
  status: LeadStatus;
  estimated_value: string | number | null;
  owner?: LeadOwner | null;
  unqualified_reason: string | null;
  converted_client_id: number | null;
  converted_at: string | null;
  last_contacted_at: string | null;
  contacts?: LeadContact[];
  notes_count?: number | null;
  activities_count?: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface LeadNote {
  id: number;
  lead_id: number;
  author: { id: number; name: string } | null;
  body: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface LeadActivity {
  id: number;
  lead_id: number;
  lead?: { id: number; name: string } | null;
  type: LeadActivityType;
  scheduled_at: string | null;
  note: string | null;
  is_done: boolean;
  completed_at: string | null;
  creator?: { id: number; name: string } | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface PipelineSummaryRow {
  status: LeadStatus;
  leads_count: number;
  total_estimated_value: number;
}

export interface DirectoryUser {
  id: number;
  name: string;
  email: string;
}

export interface Paginated<T> {
  data: T[];
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
}

/** Error thrown by the leads API client; carries the API error code when present. */
export class LeadApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}
