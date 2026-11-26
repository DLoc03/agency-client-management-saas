/**
 * BFF Route Handler: GET /api/auth/memberships — FE-014
 * Proxies Laravel GET /api/v1/auth/memberships using the app token from the
 * httpOnly cookie. Only active staff memberships are exposed to the app.
 */

import { backendGetMemberships } from "@/lib/auth/api";
import { TOKEN_STORAGE_KEY } from "@/lib/auth/types";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(TOKEN_STORAGE_KEY)?.value;

    if (!token) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Unauthenticated." } },
        { status: 401 }
      );
    }

    const locale = request.headers.get("accept-language") || "en";
    const result = await backendGetMemberships(token, locale);

    if (!result.success) {
      if (result.status === 401) {
        cookieStore.delete(TOKEN_STORAGE_KEY);
      }
      return NextResponse.json(
        { error: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json({
      data: result.data.filter((membership) => membership.kind === "staff"),
    });
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
