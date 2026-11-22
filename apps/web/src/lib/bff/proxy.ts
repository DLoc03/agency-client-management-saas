import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { getBackendApiUrl } from "@/lib/auth/api";
import { TOKEN_STORAGE_KEY } from "@/lib/auth/types";

/**
 * Generic BFF proxy to the Laravel API (/api/v1/*).
 * Reads the app_token from the httpOnly cookie and forwards the request.
 */
export async function proxyToBackend(
  request: NextRequest,
  backendPath: string
): Promise<NextResponse> {
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_STORAGE_KEY)?.value;

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