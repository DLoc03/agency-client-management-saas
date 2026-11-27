import { proxyToBackend } from "@/lib/bff/proxy";
import { NextRequest } from "next/server";
type Ctx = { params: Promise<{ id: string }> };
export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return proxyToBackend(request, `projects/${id}/files`);
}
export async function POST(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const { TOKEN_STORAGE_KEY } = await import("@/lib/auth/types");
  const token = cookieStore.get(TOKEN_STORAGE_KEY)?.value;
  const { getBackendApiUrl } = await import("@/lib/auth/api");
  const url = new URL(`${getBackendApiUrl()}/v1/projects/${id}/files`);
  request.nextUrl.searchParams.forEach((v,k)=>url.searchParams.append(k,v));
  const headers: Record<string,string> = { Accept: request.headers.get("accept")||"application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const ct = request.headers.get("content-type");
  if (ct) headers["Content-Type"] = ct;
  const res = await fetch(url.toString(), { method:"POST", headers, body: request.body, duplex:"half" } as RequestInit);
  const text = await res.text();
  return new (await import("next/server")).NextResponse(text, { status: res.status, headers: { "Content-Type": res.headers.get("content-type")||"application/json" } });
}
