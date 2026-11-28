/**
 * Auth types — derived from AUTH_CONTRACT.md §3 & §4 (FE-002, FE-004)
 * FE-014: multi-agency identity (DEC-018) — selection vs app session.
 */

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthUser {
  id: number;
  name: string;
  email: string;
  locale: "en" | "vi";
  roles: string[];
  permissions: string[];
}

export interface AuthAgency {
  id: number;
  name: string;
  slug: string;
  base_currency: string;
  timezone: string;
}

export interface AgencyMembership {
  id: number;
  kind: "staff" | "client";
  agency: AuthAgency;
  client: { id: number; name: string } | null;
  roles: string[];
}

export interface BackendSession {
  token: string;
  user: AuthUser;
  agency: AuthAgency;
  membership?: AgencyMembership;
}

export interface AgencySelection {
  selection_token: string;
  identity: AuthUser;
  memberships: AgencyMembership[];
}

/**
 * FIX-024 (DEC-030): the identity exists but holds no active staff
 * membership yet while a staff invitation is pending. The backend
 * returns a short-lived invitation-scoped token instead of a session;
 * it is useful only for POST /invitations/accept and lives in its own
 * httpOnly cookie (see INVITATION_TOKEN_STORAGE_KEY) — never in the
 * app token cookie and never exposed to client JS.
 */
export interface BackendInvitationOnly {
  invitation_only: true;
  token: string;
  identity: AuthUser;
  invitation: {
    kind: string;
    agency: { id: number; name: string };
  };
}

export interface LoginResponse {
  data: BackendSession | AgencySelection | BackendInvitationOnly;
}

export interface SessionResponse {
  data: BackendSession;
}

export interface MembershipsResponse {
  data: AgencyMembership[];
}

export interface MeResponse {
  data: {
    user: AuthUser;
    agency: AuthAgency;
    membership?: AgencyMembership;
    memberships?: AgencyMembership[];
  };
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: Record<string, string[]> | null;
}

export interface ApiErrorResponse {
  error: ApiErrorPayload;
}

/** Token storage key (httpOnly cookie name) */
export const TOKEN_STORAGE_KEY = "app_token";

/** Short-lived selection token lives here, never in the app token cookie. */
export const SELECTION_STORAGE_KEY = "auth_selection";

/** Invitation-scoped token cookie (httpOnly, FIX-024) — accept-flow only. */
export const INVITATION_TOKEN_STORAGE_KEY = "invitation_token";

/** Auth session stored in memory / client state */
export interface AuthSession {
  token: string;
  user: AuthUser;
  agency: AuthAgency;
}

export interface LoginError {
  code: string;
  message?: string;
  details?: Record<string, string[]> | null;
}

export type LoginResult =
  | { success: true; requiresSelection: false; session: AuthSession }
  | { success: true; requiresSelection: true; selection: AgencySelection }
  | {
      success: true;
      invitationOnly: true;
      invitation: BackendInvitationOnly["invitation"];
    }
  | {
      success: false;
      code: string;
      message?: string;
      details?: Record<string, string[]> | null;
    };

export type SessionResult =
  | { success: true; session: AuthSession }
  | {
      success: false;
      code: string;
      message?: string;
      details?: Record<string, string[]> | null;
    };
