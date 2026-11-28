/**
 * Server-side calls to the real Portal auth API — FE-013.
 * Used only by the BFF route handlers; mirrors lib/auth/api.ts.
 */

import { getBackendApiUrl } from "@/lib/auth/api";
import type {
  PortalBackendInvitationOnly,
  PortalLoginRequest,
  PortalLoginResponse,
} from "./types";

type ApiErrorPayload = { code: string; message: string };

export async function backendPortalLogin(
  req: PortalLoginRequest,
  locale = "en"
): Promise<
  | {
      success: true;
      data: PortalLoginResponse["data"] | PortalBackendInvitationOnly;
    }
  | { success: false; status: number; error: ApiErrorPayload }
> {
  const baseUrl = getBackendApiUrl();
  const url = `${baseUrl}/v1/portal/auth/login`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "Accept-Language": locale,
      },
      body: JSON.stringify(req),
    });

    const body = await res.json().catch(() => null);

    if (!res.ok) {
      const error: ApiErrorPayload = body?.error || {
        code: "LOGIN_FAILED",
        message: "Portal login failed.",
      };
      return { success: false, status: res.status, error };
    }

    return {
      success: true,
      data: (body as PortalLoginResponse).data as
        | PortalLoginResponse["data"]
        | PortalBackendInvitationOnly,
    };
  } catch {
    return {
      success: false,
      status: 500,
      error: { code: "NETWORK_ERROR", message: "Cannot reach the API." },
    };
  }
}
