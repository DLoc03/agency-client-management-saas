/**
 * Real API client for Internal Auth — FE-004
 * Implements calls to Laravel API per docs/AUTH_CONTRACT.md §3 & §4
 */

import type {
  ApiErrorPayload,
  ApiErrorResponse,
  AuthSession,
  LoginRequest,
  LoginResponse,
  LoginResult,
  MeResponse,
} from "./types";

export function getBackendApiUrl(): string {
  // In server-side / docker environment, prefer internal URL; fallback to public or localhost
  return (
    process.env.INTERNAL_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:8000/api"
  );
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

/**
 * Client-side call to Next.js BFF: POST /api/auth/login
 * Sets httpOnly cookie on response.
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
      const error = (body as ApiErrorResponse | null)?.error;
      return {
        success: false,
        code: error?.code || "UNKNOWN",
        message: error?.message,
        details: error?.details,
      };
    }

    const sessionData = body as {
      data: { user: AuthSession["user"]; agency: AuthSession["agency"] };
    };

    return {
      success: true,
      session: {
        token: "httpOnly", // token securely stored in httpOnly cookie
        user: sessionData.data.user,
        agency: sessionData.data.agency,
      },
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
