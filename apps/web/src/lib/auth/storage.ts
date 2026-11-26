/**
 * Auth session storage — FE-004
 *
 * Security model:
 * 1. The actual API token is stored exclusively in a secure httpOnly cookie (app_token)
 *    managed by the Next.js Route Handlers (BFF) and verified on every server request.
 * 2. Non-sensitive profile data (user, agency) is cached in sessionStorage for fast
 *    client-side UI rehydration between page transitions in the same tab.
 * 3. On page load / mount, AuthProvider revalidates with /api/auth/me.
 * 4. FE-014: a short-lived selection token is kept under a separate key for the
 *    /select-agency screen only. It is never written to the app_token cookie.
 */

import {
  SELECTION_STORAGE_KEY,
  TOKEN_STORAGE_KEY,
  type AgencySelection,
  type AuthSession,
} from "./types";

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

export function saveSelection(selection: AgencySelection): void {
  if (!isBrowser()) return;
  sessionStorage.setItem(SELECTION_STORAGE_KEY, JSON.stringify(selection));
}

export function loadSelection(): AgencySelection | null {
  if (!isBrowser()) return null;
  const raw = sessionStorage.getItem(SELECTION_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AgencySelection;
  } catch {
    return null;
  }
}

export function clearSelection(): void {
  if (!isBrowser()) return;
  sessionStorage.removeItem(SELECTION_STORAGE_KEY);
}

export function clearCachedSession(): void {
  if (!isBrowser()) return;
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

export function clearSession(): void {
  clearCachedSession();
  clearSelection();
}

export function hasSession(): boolean {
  if (!isBrowser()) return false;
  return !!sessionStorage.getItem(SESSION_KEY);
}
