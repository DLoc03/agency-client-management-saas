/**
 * Middleware — FE-002 (extends FE-001 i18n middleware)
 *
 * Responsibilities:
 *  1. next-intl locale routing (prefix all paths with /[locale])
 *  2. Route guard: redirect unauthenticated visitors away from /dashboard
 *     (and any future protected paths) to /login.
 *
 * Token check at this layer is intentionally lightweight: we only verify the
 * presence of a session token in the cookie jar. The API layer (BE-003) is the
 * real auth authority; a stale/invalid token will get a 401 response from the
 * API and the client auth context will redirect to /login.
 *
 * Note: During the mock phase the token lives in sessionStorage (client-only),
 * so the middleware cannot read it. The middleware therefore only blocks based
 * on a "app_token" cookie, which the real BE will set as an httpOnly cookie.
 * Client-side guards in protected pages handle the sessionStorage case.
 */

import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { TOKEN_STORAGE_KEY } from "./lib/auth/types";

const intlMiddleware = createIntlMiddleware(routing);

/** Paths (without locale prefix) that require authentication */
const PROTECTED_PATHS = ["/dashboard"];

/** Paths (without locale prefix) that authenticated users should not revisit */
const AUTH_ONLY_PATHS = ["/login"];

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Strip locale prefix to get the bare path for guard checks
  // e.g. /vi/dashboard → /dashboard, /en/login → /login
  const locales = routing.locales as readonly string[];
  const pathnameWithoutLocale = locales.reduce(
    (p, loc) => (p.startsWith(`/${loc}/`) ? p.slice(loc.length + 1) : p.startsWith(`/${loc}`) && p.length === loc.length + 1 ? "/" : p),
    pathname
  );

  const tokenCookie = request.cookies.get(TOKEN_STORAGE_KEY);
  const isAuthenticated = !!tokenCookie?.value;

  // Redirect unauthenticated users away from protected pages
  const isProtected = PROTECTED_PATHS.some(
    (p) => pathnameWithoutLocale === p || pathnameWithoutLocale.startsWith(p + "/")
  );
  if (isProtected && !isAuthenticated) {
    const loginUrl = new URL(request.url);
    // Preserve locale by going to the intl-processed /login path
    // Let intlMiddleware handle the locale prefix; we just rewrite the path.
    loginUrl.pathname = pathname.replace(pathnameWithoutLocale, "/login");
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from login page
  const isAuthOnly = AUTH_ONLY_PATHS.some(
    (p) => pathnameWithoutLocale === p
  );
  if (isAuthOnly && isAuthenticated) {
    const dashUrl = new URL(request.url);
    dashUrl.pathname = pathname.replace(pathnameWithoutLocale, "/dashboard");
    return NextResponse.redirect(dashUrl);
  }

  // Delegate to next-intl for locale routing
  return intlMiddleware(request);
}

export const config = {
  // Run on all paths except API routes, Next internals and static files.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)", "/"],
};
