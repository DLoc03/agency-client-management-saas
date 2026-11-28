import { portalProxyToBackend } from "@/lib/bff/portal-proxy";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  // FIX-024: mirror of the internal preview route — see the note there.
  return portalProxyToBackend(request, "invitations/preview", {
    invitationFallback: true,
  });
}
