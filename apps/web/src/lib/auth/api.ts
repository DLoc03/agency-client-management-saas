/**
 * Real API client for Internal Auth — FE-004
 * Implements calls to Laravel API per docs/AUTH_CONTRACT.md §3 & §4
 * FE-014: select/switch agency and memberships via the same BFF pattern.
 */

import type {
  AgencyMembership,
  AgencySelection,
  ApiErrorPayload,
  ApiErrorResponse,
  AuthSession,
  BackendSession,
  LoginRequest,
  LoginResponse,
  LoginResult,
  MeResponse,
  SessionResult,
} from "./types";

export function normalizeBackendBaseUrl(url: string): string {
  // Accept either ".../api" or ".../api/v1" (and trailing slashes) and always
  // return the canonical ".../api" base, so callers can safely append "/v1/...".
  return url.trim().replace(/\/+$/, "").replace(/\/v1$/, "");
}

export function getBackendApiUrl(): string {
  // In server-side / docker environment, prefer internal URL; fallback to public or localhost.
  // NEXT_PUBLIC_API_URL historically carried a trailing "/v1", which previously caused
  // a double "/v1" segment when appended again by the callers (FE-006).
  const raw =
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000/api";
  return normalizeBackendBaseUrl(raw);
}

/**
 * Direct call to backend Laravel API: POST /api/v1/auth/login
 */
export async function backendLogin(
  req: LoginRequest,
  locale = "en"
): Promise<
  | { success: true; data: LoginResponse["data"] }
  | { success: false; status: number; error: ApiErrorPayload }
> {
  const baseUrl = getBackendApiUrl();
  const url = `${baseUrl}/v1/auth/login`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Language": locale,
      },
      body: JSON.stringify(req),
    });

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      const errResponse = body as ApiErrorResponse | null;
      const error: ApiErrorPayload = errResponse?.error || {
        code:
          res.status === 401
            ? "INVALID_CREDENTIALS"
            : res.status === 403
            ? "FORBIDDEN"
            : res.status === 429
            ? "TOO_MANY_REQUESTS"
            : "UNKNOWN",
        message:
          errResponse?.error?.message ||
          (res.status === 401
            ? "Invalid credentials."
            : "An unexpected error occurred."),
        details: errResponse?.error?.details,
      };
      return { success: false, status: res.status, error };
    }

    return { success: true, data: (body as LoginResponse).data };
  } catch (err: unknown) {
    return {
      success: false,
      status: 500,
      error: {
        code: "NETWORK_ERROR",
        message:
          err instanceof Error
            ? err.message
            : "Cannot connect to backend server.",
      },
    };
  }
}

/**
 * Direct call to backend Laravel API: GET /api/v1/auth/me
 */
export async function backendGetMe(
  token: string,
  locale = "en"
): Promise<
  | { success: true; data: MeResponse["data"] }
  | { success: false; status: number; error: ApiErrorPayload }
> {
  const baseUrl = getBackendApiUrl();
  const url = `${baseUrl}/v1/auth/me`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Accept-Language": locale,
      },
    });

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      const errResponse = body as ApiErrorResponse | null;
      return {
        success: false,
        status: res.status,
        error: errResponse?.error || {
          code: "UNAUTHENTICATED",
          message: "Unauthenticated.",
        },
      };
    }

    return { success: true, data: (body as MeResponse).data };
  } catch (err: unknown) {
    return {
      success: false,
      status: 500,
      error: {
        code: "NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network error.",
      },
    };
  }
}

/**
 * Direct call to backend Laravel API: POST /api/v1/auth/logout
 */
export async function backendLogout(token: string): Promise<boolean> {
  const baseUrl = getBackendApiUrl();
  const url = `${baseUrl}/v1/auth/logout`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    return res.ok;
  } catch {
    return false;
  }
}

type BackendCall<T> =
  | { success: true; data: T }
  | { success: false; status: number; error: ApiErrorPayload };

async function callBackendAuth<T>(
  path: string,
  token: string,
  options: { method: "GET" | "POST"; body?: Record<string, unknown> },
  locale: string
): Promise<BackendCall<T>> {
  try {
    const res = await fetch(`${getBackendApiUrl()}/v1/auth${path}`, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Language": locale,
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    });

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      const error: ApiErrorPayload = (body as ApiErrorResponse | null)?.error || {
        code:
          res.status === 401
            ? "UNAUTHENTICATED"
            : res.status === 403
            ? "FORBIDDEN"
            : res.status === 404
            ? "NOT_FOUND"
            : res.status === 422
            ? "VALIDATION_FAILED"
            : "UNKNOWN",
        message: "An unexpected error occurred.",
      };
      return { success: false, status: res.status, error };
    }

    return { success: true, data: (body as { data: T }).data };
  } catch (err: unknown) {
    return {
      success: false,
      status: 500,
      error: {
        code: "NETWORK_ERROR",
        message: err instanceof Error ? err.message : "Network error.",
      },
    };
  }
}

export function backendSelectAgency(
  selectionToken: string,
  membershipId: number,
  locale = "en"
): Promise<BackendCall<BackendSession>> {
  return callBackendAuth<BackendSession>(
    "/select-agency",
    selectionToken,
    { method: "POST", body: { membership_id: membershipId } },
    locale
  );
}

export function backendSwitchAgency(
  token: string,
  membershipId: number,
  locale = "en"
): Promise<BackendCall<BackendSession>> {
  return callBackendAuth<BackendSession>(
    "/switch-agency",
    token,
    { method: "POST", body: { membership_id: membershipId } },
    locale
  );
}

export function backendGetMemberships(
  token: string,
  locale = "en"
): Promise<BackendCall<AgencyMembership[]>> {
  return callBackendAuth<AgencyMembership[]>(
    "/memberships",
    token,
    { method: "GET" },
    locale
  );
}

function clientSessionFromData(data: {
  user: AuthSession["user"];
  agency: AuthSession["agency"];
}): AuthSession {
  return {
    token: "httpOnly",
    user: data.user,
    agency: data.agency,
  };
}

function clientError(data: ApiErrorResponse | null): {
  code: string;
  message?: string;
  details?: Record<string, string[]> | null;
} {
  return {
    code: data?.error?.code || "UNKNOWN",
    message: data?.error?.message,
    details: data?.error?.details,
  };
}

/**
 * Client-side call to Next.js BFF: POST /api/auth/login
 * Sets httpOnly cookie on response only when a full session is returned.
 */
export async function clientLogin(
  req: LoginRequest,
  locale = "en"
): Promise<LoginResult> {
  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Language": locale,
      },
      body: JSON.stringify(req),
    });

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      return { success: false, ...clientError(body as ApiErrorResponse | null) };
    }

    const data = (body as { data: BackendSession | AgencySelection }).data;

    if ("selection_token" in data) {
      const selection: AgencySelection = {
        selection_token: data.selection_token,
        identity: data.identity,
        memberships: data.memberships,
      };
      return { success: true, requiresSelection: true, selection };
    }

    return {
      success: true,
      requiresSelection: false,
      session: clientSessionFromData(data),
    };
  } catch (err: unknown) {
    return {
      success: false,
      code: "NETWORK_ERROR",
      message:
        err instanceof Error
          ? err.message
          : "Cannot connect to authentication service.",
    };
  }
}

/**
 * Client-side call to Next.js BFF: POST /api/auth/select-agency
 * The short-lived selection token is sent in the request body; the BFF
 * forwards it to Laravel as an Authorization header.
 */
export async function clientSelectAgency(
  selectionToken: string,
  membershipId: number,
  locale = "en"
): Promise<SessionResult> {
  try {
    const res = await fetch("/api/auth/select-agency", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Language": locale,
      },
      body: JSON.stringify({ selection_token: selectionToken, membership_id: membershipId }),
    });

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      return { success: false, ...clientError(body as ApiErrorResponse | null) };
    }

    return {
      success: true,
      session: clientSessionFromData(
        (body as { data: BackendSession }).data
      ),
    };
  } catch (err: unknown) {
    return {
      success: false,
      code: "NETWORK_ERROR",
      message: err instanceof Error ? err.message : "Network error.",
    };
  }
}

/**
 * Client-side call to Next.js BFF: POST /api/auth/switch-agency
 */
export async function clientSwitchAgency(
  membershipId: number,
  locale = "en"
): Promise<SessionResult> {
  try {
    const res = await fetch("/api/auth/switch-agency", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Language": locale,
      },
      body: JSON.stringify({ membership_id: membershipId }),
    });

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      return { success: false, ...clientError(body as ApiErrorResponse | null) };
    }

    return {
      success: true,
      session: clientSessionFromData(
        (body as { data: BackendSession }).data
      ),
    };
  } catch (err: unknown) {
    return {
      success: false,
      code: "NETWORK_ERROR",
      message: err instanceof Error ? err.message : "Network error.",
    };
  }
}

/**
 * Client-side call to Next.js BFF: GET /api/auth/memberships
 */
export async function clientGetMemberships(
  locale = "en"
): Promise<
  | { success: true; memberships: AgencyMembership[] }
  | { success: false; code: string; message?: string }
> {
  try {
    const res = await fetch("/api/auth/memberships", {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Accept-Language": locale,
      },
    });

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      const error = clientError(body as ApiErrorResponse | null);
      return { success: false, code: error.code, message: error.message };
    }

    const memberships = (body as { data: AgencyMembership[] }).data;
    return {
      success: true,
      memberships: memberships.filter((membership) => membership.kind === "staff"),
    };
  } catch (err: unknown) {
    return {
      success: false,
      code: "NETWORK_ERROR",
      message: err instanceof Error ? err.message : "Network error.",
    };
  }
}

/**
 * Client-side call to Next.js BFF: GET /api/auth/me
 */
export async function clientGetMe(
  locale = "en"
): Promise<
  | { success: true; user: AuthSession["user"]; agency: AuthSession["agency"] }
  | { success: false; code: string; message?: string }
> {
  try {
    const res = await fetch("/api/auth/me", {
      method: "GET",
      headers: {
        Accept: "application/json",
        "Accept-Language": locale,
      },
    });

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      const error = (body as ApiErrorResponse | null)?.error;
      return {
        success: false,
        code: error?.code || "UNAUTHENTICATED",
        message: error?.message,
      };
    }

    const body = (await res.json()) as MeResponse;
    return {
      success: true,
      user: body.data.user,
      agency: body.data.agency,
    };
  } catch (err: unknown) {
    return {
      success: false,
      code: "NETWORK_ERROR",
      message: err instanceof Error ? err.message : "Network error.",
    };
  }
}

/**
 * Client-side call to Next.js BFF: POST /api/auth/logout
 * Clears httpOnly cookie and calls Laravel logout.
 */
export async function clientLogout(): Promise<void> {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: {
        Accept: "application/json",
      },
    });
  } catch {
    // Non-blocking on network failure
  }
}
