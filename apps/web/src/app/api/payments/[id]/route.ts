import { proxyToBackend } from "@/lib/bff/proxy";
import { NextRequest } from "next/server";

type Ctx = { params: Promise<{ id: string }> };

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  return proxyToBackend(request, `payments/${id}`);
}
