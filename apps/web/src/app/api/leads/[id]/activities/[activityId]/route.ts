import { proxyToBackend } from "@/lib/bff/proxy";
import { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string; activityId: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id, activityId } = await ctx.params;
  return proxyToBackend(request, `leads/${id}/activities/${activityId}`);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { id, activityId } = await ctx.params;
  return proxyToBackend(request, `leads/${id}/activities/${activityId}`);
}
