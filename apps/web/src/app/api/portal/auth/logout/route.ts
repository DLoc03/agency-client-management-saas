/**
 * BFF Route Handler: POST /api/portal/auth/logout — FE-013
 * Revokes the token at the backend (best effort) and clears the cookie.
 */

import { getBackendApiUrl } from "@/lib/auth/api";
import { PORTAL_TOKEN_STORAGE_KEY } from "@/lib/portal-auth/types";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(PORTAL_TOKEN_STORAGE_KEY)?.value;

  if (token) {
    try {
      await fetch(`${getBackendApiUrl()}/v1/portal/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
          "Accept-Language": request.headers.get("accept-language") || "en",
        },
      });
    } catch {
      // Best effort — the cookie is cleared regardless.
    }
  }

  cookieStore.delete(PORTAL_TOKEN_STORAGE_KEY);
  return NextResponse.json({ data: { success: true } });
}
