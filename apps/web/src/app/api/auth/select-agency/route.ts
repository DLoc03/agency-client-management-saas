/**
 * BFF Route Handler: POST /api/auth/select-agency — FE-014
 * Forwards the short-lived selection token as a Bearer header to Laravel
 * POST /api/v1/auth/select-agency and stores the resulting app token in the
 * httpOnly app_token cookie.
 */

import { backendSelectAgency } from "@/lib/auth/api";
import { TOKEN_STORAGE_KEY } from "@/lib/auth/types";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const selectionToken = body?.selection_token;
    const membershipId = body?.membership_id;

    if (typeof selectionToken !== "string" || !selectionToken || !Number.isInteger(membershipId)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_FAILED",
            message: "Selection token and membership id are required.",
          },
        },
        { status: 422 }
      );
    }

    const locale = request.headers.get("accept-language") || "en";
    const result = await backendSelectAgency(selectionToken, membershipId, locale);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    const { token, user, agency } = result.data;
    const cookieStore = await cookies();
    cookieStore.set({
      name: TOKEN_STORAGE_KEY,
      value: token,
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
