/**
 * BFF Route Handler: POST /api/portal/auth/login — FE-013
 * Proxies to Laravel POST /api/v1/portal/auth/login and stores the
 * Sanctum token in an httpOnly cookie (portal_token), mirroring the
 * internal app login (FE-004). The token never reaches client JS.
 */

import { INVITATION_TOKEN_STORAGE_KEY } from "@/lib/auth/types";
import { backendPortalLogin } from "@/lib/portal-auth/api";
import { PORTAL_TOKEN_STORAGE_KEY } from "@/lib/portal-auth/types";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body || {};

    if (!email || !password) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Email and password are required.",
          },
        },
        { status: 422 }
      );
    }

    const locale = request.headers.get("accept-language") || "en";
    const result = await backendPortalLogin({ email, password }, locale);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    if ("invitation_only" in result.data) {
      // FIX-024 (DEC-030): no client membership yet, but a client
      // invitation is pending. Park the invitation-scoped token in its
      // own httpOnly cookie (60 minutes, mirroring the backend expiry)
      // so the Portal accept page can complete; the raw token never
      // reaches client JS and no portal session cookie is set.
      const data = result.data;
      const cookieStore = await cookies();
      cookieStore.delete(PORTAL_TOKEN_STORAGE_KEY);
      cookieStore.set({
        name: INVITATION_TOKEN_STORAGE_KEY,
        value: data.token,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 3600,
      });
      return NextResponse.json({
        data: {
          invitation_only: true,
          identity: data.identity,
          invitation: data.invitation,
        },
      });
    }

    const { token, client, agency } = result.data;

    const cookieStore = await cookies();
    cookieStore.set({
      name: PORTAL_TOKEN_STORAGE_KEY,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return NextResponse.json({ data: { client, agency } });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: {
          code: "SERVER_ERROR",
          message:
            err instanceof Error ? err.message : "Internal server error.",
        },
      },
      { status: 500 }
    );
  }
}
