import { proxyToBackend } from "@/lib/bff/proxy";
import { NextRequest } from "next/server";
type Ctx = { params: Promise<{ id: string; commentId: string }> };
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { id, commentId } = await ctx.params;
  return proxyToBackend(request, `projects/${id}/portal-comments/${commentId}`);
}
