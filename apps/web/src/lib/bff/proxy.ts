import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getBackendApiUrl } from "@/lib/auth/api";
import {
  INVITATION_TOKEN_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
} from "@/lib/auth/types";

export interface ProxyOptions {
  /**
   * FIX-024: when no app_token cookie exists, fall back to the
   * invitation-scoped token cookie. Opt-in per route — only the
   * invitation preview/accept routes use it, since the invitation
   * token is valid solely for those backend endpoints.
   */
  invitationFallback?: boolean;
}

/**
 * Generic BFF proxy to the Laravel API (/api/v1/*).
 * Reads the app_token from the httpOnly cookie and forwards the request.
 */
export async function proxyToBackend(
  request: NextRequest,
  backendPath: string,
  options?: ProxyOptions
): Promise<NextResponse> {
  const cookieStore = await cookies();
  let token = cookieStore.get(TOKEN_STORAGE_KEY)?.value;
  if (!token && options?.invitationFallback) {
    token = cookieStore.get(INVITATION_TOKEN_STORAGE_KEY)?.value;
  }

  const baseUrl = getBackendApiUrl();
  const cleaned = backendPath.replace(/^\/+/, "");
  const url = new URL(`${baseUrl}/v1/${cleaned}`);
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  const method = request.method;
  const headers: Record<string, string> = {
    Accept: request.headers.get("accept") || "application/json",
    "Accept-Language": request.headers.get("accept-language") || "en",
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let body: string | undefined;
  if (!["GET", "HEAD"].includes(method)) {
    const ct = request.headers.get("content-type");
    if (ct) headers["Content-Type"] = ct;
    body = await request.text();
  }

  try {
    const res = await fetch(url.toString(), { method, headers, body });
    // Null-body statuses must not carry a body: constructing a Response with
    // one throws "Invalid response status code 204" in Node's fetch stack.
    if (res.status === 204 || res.status === 205 || res.status === 304) {
      return new NextResponse(null, { status: res.status });
    }
    const text = await res.text();
    const contentType = res.headers.get("content-type") || "application/json";
    const outHeaders: Record<string, string> = { "Content-Type": contentType };
    const disposition = res.headers.get("content-disposition");
    if (disposition) outHeaders["Content-Disposition"] = disposition;
    return new NextResponse(text, {
      status: res.status,
      headers: outHeaders,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: {
          code: "NETWORK_ERROR",
          message: err instanceof Error ? err.message : "Network error.",
        },
      },
      { status: 500 }
    );
  }
}