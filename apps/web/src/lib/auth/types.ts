/**
 * Auth types — derived from AUTH_CONTRACT.md §3 & §4 (FE-002, FE-004)
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

export interface LoginResponse {
  data: {
    token: string;
    user: AuthUser;
    agency: AuthAgency;
  };
}

export interface MeResponse {
  data: {
    user: AuthUser;
    agency: AuthAgency;
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

/** Token storage key (cookie name) */
export const TOKEN_STORAGE_KEY = "app_token";

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
  | { success: true; session: AuthSession }
  | {
      success: false;
      code: string;
      message?: string;
      details?: Record<string, string[]> | null;
    };
