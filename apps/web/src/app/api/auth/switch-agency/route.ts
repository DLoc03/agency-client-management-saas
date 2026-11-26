/**
 * BFF Route Handler: POST /api/auth/switch-agency — FE-014
 * Uses the app token from the httpOnly cookie, rotates it at Laravel
 * POST /api/v1/auth/switch-agency and replaces the cookie with the new token.
 */

import { backendSwitchAgency } from "@/lib/auth/api";
import { TOKEN_STORAGE_KEY } from "@/lib/auth/types";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(TOKEN_STORAGE_KEY)?.value;

    if (!token) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Unauthenticated." } },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    const membershipId = body?.membership_id;

    if (!Number.isInteger(membershipId)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Membership id is required.",
          },
        },
        { status: 422 }
      );
    }

    const locale = request.headers.get("accept-language") || "en";
    const result = await backendSwitchAgency(token, membershipId, locale);

    if (!result.success) {
      if (result.status === 401) {
        cookieStore.delete(TOKEN_STORAGE_KEY);
      }
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    const { token: newToken, user, agency } = result.data;
    cookieStore.set({
      name: TOKEN_STORAGE_KEY,
      value: newToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });

    return NextResponse.json({ data: { user, agency } });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        error: {
          code: "SERVER_ERROR",
          message: err instanceof Error ? err.message : "Internal server error.",
        },
      },
      { status: 500 }
    );
  }
}
