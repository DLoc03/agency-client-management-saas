/**
 * Client module types — derived from docs/CLIENT_CONTRACT.md (BE-004, DEC-009)
 * and the API resources (ClientResource, OrganizationResource, ContactResource,
 * ClientNoteResource, TagResource, PortalAccountResource).
 */

export type ClientStatus = "active" | "paused" | "churned";
export type ClientType = "company" | "individual";

export interface ClientManager {
  id: number;
  name: string;
  email: string;
}

export interface Organization {
  id: number;
  client_id: number;
  legal_name: string | null;
  industry: string | null;
  size: string | null;
  address: string | null;
  tax_code: string | null;
  website: string | null;
}

export interface Tag {
  id: number;
  name: string;
  color: string | null;
  clients_count?: number | null;
}

export interface Contact {
  id: number;
  client_id: number;
  lead_id: number | null;
  organization_id: number | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  position: string | null;
  is_primary: boolean;
}

export interface ClientNote {
  id: number;
  client_id: number;
  author: { id: number; name: string } | null;
  body: string;
  created_at: string | null;
  updated_at: string | null;
}

export interface PortalAccount {
  id: number;
  client_id: number;
  name: string;
  email: string;
  locale: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string | null;
}

export interface PortalInvitation {
  id: number;
  email: string;
  kind: "client";
  client_id: number | null;
  expires_at: string;
  created_at: string | null;
}

export type PortalGrantResult = PortalAccount | PortalInvitation;

export interface Client {
  id: number;
  name: string;
  type: ClientType;
  status: ClientStatus;
  account_manager?: ClientManager | null;
  source_lead_id: number | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  address: string | null;
  tax_code: string | null;
  organization?: Organization | null;
  contacts?: Contact[];
  tags?: Tag[];
  portal_accounts_count?: number | null;
  created_at: string | null;
  updated_at: string | null;
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
