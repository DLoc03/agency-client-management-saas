/**
 * BFF Route Handler: POST /api/auth/logout — FE-004
 * Proxies to Laravel POST /api/v1/auth/logout and clears httpOnly cookie.
 */

import { backendLogout } from "@/lib/auth/api";
import { TOKEN_STORAGE_KEY } from "@/lib/auth/types";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function POST() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(TOKEN_STORAGE_KEY)?.value;

    if (token) {
      await backendLogout(token);
    }

    // Always clear the cookie
    cookieStore.delete(TOKEN_STORAGE_KEY);

    return new NextResponse(null, { status: 204 });
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
