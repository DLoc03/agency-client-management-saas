import { portalProxyToBackend } from "@/lib/bff/portal-proxy";
import { NextRequest } from "next/server";

export async function PATCH(request: NextRequest) {
  return portalProxyToBackend(request, "portal/auth/profile");
}