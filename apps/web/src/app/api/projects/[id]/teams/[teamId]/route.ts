import { proxyToBackend } from "@/lib/bff/proxy";
import { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string; teamId: string }> };

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { id, teamId } = await ctx.params;
  return proxyToBackend(request, `projects/${id}/teams/${teamId}`);
}