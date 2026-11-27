import { portalProxyToBackend } from "@/lib/bff/portal-proxy";
import { NextRequest } from "next/server";
type Ctx = { params: Promise<{ projectId: string; approvalId: string }> };
export async function POST(request: NextRequest, ctx: Ctx) {
  const { projectId, approvalId } = await ctx.params;
  return portalProxyToBackend(request, `portal/projects/${projectId}/approvals/${approvalId}/respond`);
}
