/**
 * Auth session storage — FE-004
 *
 * Security model:
 * 1. The actual API token is stored exclusively in a secure httpOnly cookie (app_token)
 *    managed by the Next.js Route Handlers (BFF) and verified on every server request.
 * 2. Non-sensitive profile data (user, agency) is cached in sessionStorage for fast
 *    client-side UI rehydration between page transitions in the same tab.
 * 3. On page load / mount, AuthProvider revalidates with /api/auth/me.
 */

import { TOKEN_STORAGE_KEY, type AuthSession } from "./types";

const SESSION_KEY = "auth_session";

function isBrowser() {
  return typeof window !== "undefined";
}

export function saveSession(session: AuthSession): void {
  if (!isBrowser()) return;
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
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
  return !!sessionStorage.getItem(SESSION_KEY);
}
