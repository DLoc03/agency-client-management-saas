import { portalProxyToBackend } from "@/lib/bff/portal-proxy";
import { NextRequest } from "next/server";
type Ctx = { params: Promise<{ projectId: string }> };
export async function GET(request: NextRequest, ctx: Ctx) {
  const { projectId } = await ctx.params;
  return portalProxyToBackend(request, `portal/projects/${projectId}/comments`);
}
export async function POST(request: NextRequest, ctx: Ctx) {
  const { projectId } = await ctx.params;
  return portalProxyToBackend(request, `portal/projects/${projectId}/comments`);
}
