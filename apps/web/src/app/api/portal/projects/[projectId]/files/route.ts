import { portalProxyToBackend } from "@/lib/bff/portal-proxy";
import { NextRequest } from "next/server";
type Ctx = { params: Promise<{ projectId: string }> };
export async function GET(request: NextRequest, ctx: Ctx) {
  const { projectId } = await ctx.params;
  return portalProxyToBackend(request, `portal/projects/${projectId}/files`);
}
export async function POST(request: NextRequest, ctx: Ctx) {
  const { projectId } = await ctx.params;
  // stream body for multipart upload
  const token = (await import("@/lib/portal-auth/types")).PORTAL_TOKEN_STORAGE_KEY;
  const { cookies } = await import("next/headers");
  const cookieStore = await cookies();
  const t = cookieStore.get(token)?.value;
  const { getBackendApiUrl } = await import("@/lib/auth/api");
  const url = new URL(`${getBackendApiUrl()}/v1/portal/projects/${projectId}/files`);
  request.nextUrl.searchParams.forEach((v,k)=>url.searchParams.append(k,v));
  const headers: Record<string,string> = { Accept: request.headers.get("accept")||"application/json" };
  if (t) headers.Authorization = `Bearer ${t}`;
  const ct = request.headers.get("content-type");
  if (ct) headers["Content-Type"] = ct;
  const res = await fetch(url.toString(), { method:"POST", headers, body: request.body, duplex:"half" } as RequestInit);
  const text = await res.text();
  return new (await import("next/server")).NextResponse(text, { status: res.status, headers: { "Content-Type": res.headers.get("content-type")||"application/json" } });
}
