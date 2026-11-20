/**
 * Client Portal Auth Types — FE-003
 * Derived from docs/AUTH_CONTRACT.md §3 (Portal) & DEC-008
 */

export const PORTAL_TOKEN_STORAGE_KEY = "portal_token";

export interface PortalLoginRequest {
  email: string;
  password: string;
}

export interface PortalClient {
  id: number;
  client_id: number | null;
  name: string;
  email: string;
  locale: "en" | "vi";
}

export interface PortalAgency {
  id: number;
  name: string;
  slug: string;
}

export interface PortalLoginResponse {
  data: {
    token: string;
    client: PortalClient;
    agency: PortalAgency;
  };
}

export interface PortalMeResponse {
  data: {
    client: PortalClient;
    agency: PortalAgency;
  };
}

export interface PortalForgotPasswordRequest {
  email: string;
}

export interface PortalResetPasswordRequest {
  token: string;
  email: string;
  password: string;
}

export interface PortalAuthSession {
  token: string;
  client: PortalClient;
  agency: PortalAgency;
}

export type PortalLoginResult =
  | { success: true; session: PortalAuthSession }
  | { success: false; code: string; message?: string };

export type PortalResetResult =
  | { success: true; message: string }
  | { success: false; code: string; message?: string };
