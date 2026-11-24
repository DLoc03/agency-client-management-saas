import { proxyToBackend } from "@/lib/bff/proxy";
import { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string; accountId: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id, accountId } = await ctx.params;
  return proxyToBackend(request, `clients/${id}/portal-accounts/${accountId}`);
}
