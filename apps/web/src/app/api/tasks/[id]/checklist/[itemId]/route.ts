import { proxyToBackend } from "@/lib/bff/proxy";
import { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string; itemId: string }> };

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id, itemId } = await ctx.params;
  return proxyToBackend(request, `tasks/${id}/checklist/${itemId}`);
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { id, itemId } = await ctx.params;
  return proxyToBackend(request, `tasks/${id}/checklist/${itemId}`);
}