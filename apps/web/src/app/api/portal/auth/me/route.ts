import { portalProxyToBackend } from "@/lib/bff/portal-proxy";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  return portalProxyToBackend(request, "portal/auth/me");
}
