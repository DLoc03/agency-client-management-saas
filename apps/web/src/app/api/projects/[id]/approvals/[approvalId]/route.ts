import { proxyToBackend } from "@/lib/bff/proxy";
import { NextRequest } from "next/server";
type Ctx = { params: Promise<{ id: string; approvalId: string }> };
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { id, approvalId } = await ctx.params;
  return proxyToBackend(request, `projects/${id}/approvals/${approvalId}`);
}
