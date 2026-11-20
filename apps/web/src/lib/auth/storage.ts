/**
 * Auth token storage — FE-002
 *
 * During mock phase: stores token in sessionStorage so it survives page
 * refreshes within the tab but clears on tab close (safer than localStorage).
 *
 * When BE-003 ships: replace with httpOnly cookie set by the API, and remove
 * sessionStorage reads/writes here.
 */

import { TOKEN_STORAGE_KEY, type AuthSession } from "./types";

const SESSION_KEY = "auth_session";

function isBrowser() {
  return typeof window !== "undefined";
}

export function saveSession(session: AuthSession): void {
  if (!isBrowser()) return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  // Also set a plain token key for middleware-compatible reads
  sessionStorage.setItem(TOKEN_STORAGE_KEY, session.token);
}

export function loadSession(): AuthSession | null {
  if (!isBrowser()) return null;
  const raw = sessionStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  if (!isBrowser()) return;
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function hasSession(): boolean {
  if (!isBrowser()) return false;
  return !!sessionStorage.getItem(TOKEN_STORAGE_KEY);
}
