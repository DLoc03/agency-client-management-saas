import { proxyToBackend } from "@/lib/bff/proxy";
import { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string; userId: string }> };

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { id, userId } = await ctx.params;
  return proxyToBackend(request, `projects/${id}/members/${userId}`);
}