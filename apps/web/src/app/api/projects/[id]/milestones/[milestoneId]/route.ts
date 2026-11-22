import { proxyToBackend } from "@/lib/bff/proxy";
import { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string; milestoneId: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id, milestoneId } = await ctx.params;
  return proxyToBackend(request, `projects/${id}/milestones/${milestoneId}`);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { id, milestoneId } = await ctx.params;
  return proxyToBackend(request, `projects/${id}/milestones/${milestoneId}`);
}