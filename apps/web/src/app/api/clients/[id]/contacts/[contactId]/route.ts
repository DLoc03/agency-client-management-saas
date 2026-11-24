import { proxyToBackend } from "@/lib/bff/proxy";
import { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string; contactId: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id, contactId } = await ctx.params;
  return proxyToBackend(request, `clients/${id}/contacts/${contactId}`);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { id, contactId } = await ctx.params;
  return proxyToBackend(request, `clients/${id}/contacts/${contactId}`);
}
