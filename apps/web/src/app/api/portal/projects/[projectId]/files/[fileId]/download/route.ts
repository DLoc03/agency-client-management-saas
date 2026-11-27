import { portalProxyToBackend } from "@/lib/bff/portal-proxy";
import { NextRequest } from "next/server";
type Ctx = { params: Promise<{ projectId: string; fileId: string }> };
export async function GET(request: NextRequest, ctx: Ctx) {
  const { projectId, fileId } = await ctx.params;
  return portalProxyToBackend(request, `portal/projects/${projectId}/files/${fileId}/download`);
}
