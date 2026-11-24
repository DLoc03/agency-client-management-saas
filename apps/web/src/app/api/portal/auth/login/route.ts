/**
 * BFF Route Handler: POST /api/portal/auth/login — FE-013
 * Proxies to Laravel POST /api/v1/portal/auth/login and stores the
 * Sanctum token in an httpOnly cookie (portal_token), mirroring the
 * internal app login (FE-004). The token never reaches client JS.
 */

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
