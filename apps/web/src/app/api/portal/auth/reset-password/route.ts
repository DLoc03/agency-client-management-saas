import { portalProxyToBackend } from "@/lib/bff/portal-proxy";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  return portalProxyToBackend(request, "portal/auth/reset-password");
}
