/**
 * Auth types — derived from AUTH_CONTRACT.md §3 & §4 (FE-002)
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

/** Token storage key (cookie name when real BE ships) */
export const TOKEN_STORAGE_KEY = "app_token";

/** Auth session stored in memory / sessionStorage for mock phase */
export interface AuthSession {
  token: string;
  user: AuthUser;
  agency: AuthAgency;
}
