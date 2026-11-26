import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getBackendApiUrl } from "@/lib/auth/api";
import { TOKEN_STORAGE_KEY } from "@/lib/auth/types";

type Ctx = { params: Promise<{ id: string }> };

/**
 * Streks the invoice PDF from the backend. Returns the raw bytes (array
 * buffer) so the binary payload is not mangled by text-based proxying, and
 * forwards the backend's content-type so the browser can open/download it.
 */
export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const cookieStore = await cookies();
  const token = cookieStore.get(TOKEN_STORAGE_KEY)?.value;

  const baseUrl = getBackendApiUrl();
  const url = new URL(`${baseUrl}/v1/invoices/${id}/pdf`);
  request.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.append(key, value);
  });

  const headers: Record<string, string> = {
    Accept: request.headers.get("accept") || "application/pdf",
    "Accept-Language": request.headers.get("accept-language") || "en",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url.toString(), { method: "GET", headers });
  const contentType = res.headers.get("content-type") || "application/pdf";
  const buffer = await res.arrayBuffer();
  return new NextResponse(buffer, {
    status: res.status,
    headers: { "Content-Type": contentType },
  });
}
