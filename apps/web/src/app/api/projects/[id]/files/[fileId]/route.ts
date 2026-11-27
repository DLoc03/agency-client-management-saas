import { proxyToBackend } from "@/lib/bff/proxy";
import { NextRequest } from "next/server";
type Ctx = { params: Promise<{ id: string; fileId: string }> };
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id, fileId } = await ctx.params;
  return proxyToBackend(request, `projects/${id}/files/${fileId}`);
}
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { id, fileId } = await ctx.params;
  return proxyToBackend(request, `projects/${id}/files/${fileId}`);
}
