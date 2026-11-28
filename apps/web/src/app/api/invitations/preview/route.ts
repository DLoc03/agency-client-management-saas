import { proxyToBackend } from "@/lib/bff/proxy";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  // FIX-024: the preview's matches_current_user flag is computed from
  // the bearer token — forwarding the invitation-scoped cookie lets a
  // just-logged-in invitee reach the confirm state instead of looping
  // on "login required". Read-only; no behaviour change for sessions.
  return proxyToBackend(request, "invitations/preview", {
    invitationFallback: true,
  });
}
