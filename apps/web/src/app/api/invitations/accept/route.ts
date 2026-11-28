import { INVITATION_TOKEN_STORAGE_KEY } from "@/lib/auth/types";
import { proxyToBackend } from "@/lib/bff/proxy";
import { cookies } from "next/headers";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  // FIX-024: a visitor who logged in with a pending invitation carries
  // only the invitation-scoped cookie — forward it so the backend can
  // match the identity. On success the backend deletes that token, so
  // the cookie is cleared here and cannot linger.
  const response = await proxyToBackend(request, "invitations/accept", {
    invitationFallback: true,
  });
  if (response.status >= 200 && response.status < 300) {
    (await cookies()).delete(INVITATION_TOKEN_STORAGE_KEY);
  }
  return response;
}
