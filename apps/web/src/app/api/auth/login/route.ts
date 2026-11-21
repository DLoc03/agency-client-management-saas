/**
 * BFF Route Handler: POST /api/auth/login — FE-004
 * Proxies to Laravel POST /api/v1/auth/login, sets httpOnly cookie,
 * calls GET /api/v1/auth/me to verify roles/permissions.
 */

import { backendGetMe, backendLogin } from "@/lib/auth/api";
import { TOKEN_STORAGE_KEY } from "@/lib/auth/types";
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

    // 1. Call real backend POST /api/v1/auth/login
    const loginResult = await backendLogin({ email, password }, locale);

    if (!loginResult.success) {
      return NextResponse.json(
        { error: loginResult.error },
        { status: loginResult.status }
      );
    }

    const { token, user: initialUser, agency: initialAgency } = loginResult.data;

    // 2. Call GET /api/v1/auth/me to retrieve/verify complete roles & permissions
    const meResult = await backendGetMe(token, locale);
    const user = meResult.success ? meResult.data.user : initialUser;
    const agency = meResult.success ? meResult.data.agency : initialAgency;

    // 3. Set secure httpOnly cookie (BFF pattern — token never exposed to document.cookie)
    const cookieStore = await cookies();
    cookieStore.set({
      name: TOKEN_STORAGE_KEY,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return NextResponse.json({
      data: {
        user,
        agency,
      },
    });
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
