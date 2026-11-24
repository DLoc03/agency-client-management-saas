import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getBackendApiUrl } from "@/lib/auth/api";
import { PORTAL_TOKEN_STORAGE_KEY } from "@/lib/portal-auth/types";

/**
 * BFF proxy for the Client Portal API (/api/v1/portal/*).
 * Reads the portal_token from the httpOnly cookie (set by the portal
 * login BFF route) and forwards the request. Strictly separate from the
 * internal app proxy: the app_token is never sent to portal endpoints.
 */
export async function portalProxyToBackend(
  request: NextRequest,
  backendPath: string
): Promise<NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get(PORTAL_TOKEN_STORAGE_KEY)?.value;

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
    // Null-body statuses must not carry a body (Node fetch throws otherwise).
    if (res.status === 204 || res.status === 205 || res.status === 304) {
      return new NextResponse(null, { status: res.status });
    }
    const text = await res.text();
    const contentType = res.headers.get("content-type") || "application/json";
    return new NextResponse(text, {
      status: res.status,
      headers: { "Content-Type": contentType },
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
