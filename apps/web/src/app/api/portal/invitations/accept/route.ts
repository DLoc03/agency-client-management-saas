import { INVITATION_TOKEN_STORAGE_KEY } from "@/lib/auth/types";
import { portalProxyToBackend } from "@/lib/bff/portal-proxy";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  // FIX-024: mirror of the internal accept route — forward the
  // invitation-scoped cookie when no portal session exists, and clear
  // it after a successful accept (the backend deletes the token).
  const response = await portalProxyToBackend(request, "invitations/accept", {
    invitationFallback: true,
  });
  if (response.status >= 200 && response.status < 300) {
    (await cookies()).delete(INVITATION_TOKEN_STORAGE_KEY);
  }
  return response;
}
