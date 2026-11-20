/**
 * Portal Session Storage — FE-003
 *
 * Stores portal_token and session separately from internal app_token.
 * Sets portal_token cookie for Edge middleware route guard verification.
 */

import { PORTAL_TOKEN_STORAGE_KEY, type PortalAuthSession } from "./types";

const PORTAL_SESSION_KEY = "portal_auth_session";

function isBrowser() {
  return typeof window !== "undefined";
}

export function savePortalSession(session: PortalAuthSession): void {
  if (!isBrowser()) return;
  sessionStorage.setItem(PORTAL_SESSION_KEY, JSON.stringify(session));
  sessionStorage.setItem(PORTAL_TOKEN_STORAGE_KEY, session.token);

  // Set cookie for middleware route guard
  document.cookie = `${PORTAL_TOKEN_STORAGE_KEY}=${encodeURIComponent(
    session.token
  )}; path=/; SameSite=Lax`;
}

export function loadPortalSession(): PortalAuthSession | null {
  if (!isBrowser()) return null;
  const raw = sessionStorage.getItem(PORTAL_SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PortalAuthSession;
  } catch {
    return null;
  }
}

export function clearPortalSession(): void {
  if (!isBrowser()) return;
  sessionStorage.removeItem(PORTAL_SESSION_KEY);
  sessionStorage.removeItem(PORTAL_TOKEN_STORAGE_KEY);

  // Expire cookie
  document.cookie = `${PORTAL_TOKEN_STORAGE_KEY}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

export function hasPortalSession(): boolean {
  if (!isBrowser()) return false;
  return !!sessionStorage.getItem(PORTAL_TOKEN_STORAGE_KEY);
}
