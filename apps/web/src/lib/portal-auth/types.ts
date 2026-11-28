/**
 * Client Portal Auth Types — FE-003, real-API wiring FE-013
 * Derived from docs/AUTH_CONTRACT.md §3 (Portal) & DEC-008
 *
 * The portal token lives only in an httpOnly cookie set by the BFF
 * (same pattern as the internal app, FE-004) — it never reaches
 * client-side storage or JavaScript-readable cookies.
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

/** Raw backend response of POST /api/v1/portal/auth/login (server-side only). */
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

/**
 * FIX-024 (DEC-030): raw backend outcome when the identity exists but
 * holds no active client membership yet while a client invitation is
 * pending — an invitation-scoped token instead of a Portal session.
 * The token lives in the shared httpOnly invitation_token cookie (see
 * lib/auth/types) and is useful only for POST /invitations/accept.
 */
export interface PortalBackendInvitationOnly {
  invitation_only: true;
  token: string;
  identity: PortalClient;
  invitation: {
    kind: string;
    agency: { id: number; name: string };
  };
}

/** Client-side session: identity only, the token stays in the BFF cookie. */
export interface PortalAuthSession {
  client: PortalClient;
  agency: PortalAgency;
}

export type PortalLoginResult =
  | { success: true; session: PortalAuthSession }
  | {
      success: true;
      invitationOnly: true;
      invitation: PortalBackendInvitationOnly["invitation"];
    }
  | { success: false; code: string; message?: string };

export type PortalResetResult =
  | { success: true; message: string }
  | { success: false; code: string; message?: string };

export interface PortalProject {
  id: number;
  name: string;
  description: string | null;
  status: string;
  start_date: string | null;
  due_date: string | null;
  tasks_count?: number;
  tasks_done_count?: number;
  progress_percent?: number;
  milestones?: {
    id: number;
    name: string;
    due_date: string | null;
    status: string;
    progress_percent: number;
  }[];
  tasks?: {
    id: number;
    title: string;
    status: string;
    priority: string;
    due_date: string | null;
    completed_at: string | null;
  }[];
}
