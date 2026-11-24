/**
 * Middleware — FE-002, FE-003
 *
 * Responsibilities:
 *  1. next-intl locale routing (prefix all paths with /[locale])
 *  2. Internal Route Guard: Protects /dashboard using app_token.
 *  3. Client Portal Route Guard: Protects /portal using portal_token.
 *     Strict token isolation (§1 & §3) — app_token cannot access portal
 *     and portal_token cannot access internal routes.
 */

import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { TOKEN_STORAGE_KEY } from "./lib/auth/types";
import { PORTAL_TOKEN_STORAGE_KEY } from "./lib/portal-auth/types";

const intlMiddleware = createIntlMiddleware(routing);

/** Internal app paths */
const INTERNAL_PROTECTED_PATHS = ["/dashboard", "/projects", "/team", "/leads"];
const INTERNAL_AUTH_ONLY_PATHS = ["/login"];

/** Client portal paths */
const PORTAL_AUTH_ONLY_PATHS = [
  "/portal/login",
  "/portal/forgot-password",
  "/portal/reset-password",
];

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Strip locale prefix to get the bare path for guard checks
  // e.g. /vi/dashboard → /dashboard, /en/portal/login → /portal/login
  const locales = routing.locales as readonly string[];
  const pathnameWithoutLocale = locales.reduce(
    (p, loc) =>
      p.startsWith(`/${loc}/`)
        ? p.slice(loc.length + 1)
        : p.startsWith(`/${loc}`) && p.length === loc.length + 1
        ? "/"
        : p,
    pathname
  );

  // 1. Internal App Route Guard
  const internalToken = request.cookies.get(TOKEN_STORAGE_KEY);
  const isInternalAuthenticated = !!internalToken?.value;

  const isInternalProtected = INTERNAL_PROTECTED_PATHS.some(
    (p) =>
      pathnameWithoutLocale === p || pathnameWithoutLocale.startsWith(p + "/")
  );
  if (isInternalProtected && !isInternalAuthenticated) {
    const loginUrl = new URL(request.url);
    loginUrl.pathname = pathname.replace(pathnameWithoutLocale, "/login");
    return NextResponse.redirect(loginUrl);
  }

  const isInternalAuthOnly = INTERNAL_AUTH_ONLY_PATHS.some(
    (p) => pathnameWithoutLocale === p
  );
  if (isInternalAuthOnly && isInternalAuthenticated) {
    const dashUrl = new URL(request.url);
    dashUrl.pathname = pathname.replace(pathnameWithoutLocale, "/dashboard");
    return NextResponse.redirect(dashUrl);
  }

  // 2. Client Portal Route Guard
  const portalToken = request.cookies.get(PORTAL_TOKEN_STORAGE_KEY);
  const isPortalAuthenticated = !!portalToken?.value;

  // Protected portal routes: /portal and sub-paths, EXCEPT /portal/login, /portal/forgot-password, /portal/reset-password
  const isPortalAuthOnly = PORTAL_AUTH_ONLY_PATHS.some(
    (p) => pathnameWithoutLocale === p
  );
  const isPortalPath =
    pathnameWithoutLocale === "/portal" ||
    pathnameWithoutLocale.startsWith("/portal/");

  if (isPortalPath && !isPortalAuthOnly && !isPortalAuthenticated) {
    const portalLoginUrl = new URL(request.url);
    portalLoginUrl.pathname = pathname.replace(
      pathnameWithoutLocale,
      "/portal/login"
    );
    return NextResponse.redirect(portalLoginUrl);
  }

  if (isPortalAuthOnly && isPortalAuthenticated) {
    const portalHomeUrl = new URL(request.url);
    portalHomeUrl.pathname = pathname.replace(
      pathnameWithoutLocale,
      "/portal"
    );
    return NextResponse.redirect(portalHomeUrl);
  }

  // 3. Delegate to next-intl for locale routing
  return intlMiddleware(request);
}

export const config = {
  // Run on all paths except API routes, Next internals and static files.
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)", "/"],
};
