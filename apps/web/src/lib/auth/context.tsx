/**
 * Auth context — FE-004
 * Provides real authentication state with httpOnly cookie token management
 * and /api/v1/auth/me revalidation. FE-014 adds agency selection/switching.
 */

"use client";

import { useLocale } from "next-intl";
import { usePathname, useRouter, useSearchParams } from "@/i18n/routing";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  clientGetMe,
  clientLogin,
  clientLogout,
  clientSelectAgency,
  clientSwitchAgency,
} from "./api";
import {
  clearCachedSession,
  clearSelection,
  clearSession,
  loadSession,
  saveSelection,
  saveSession,
} from "./storage";
import type { AuthSession, LoginError, LoginRequest, LoginResult } from "./types";

interface AuthContextValue {
  session: AuthSession | null;
  login: (req: LoginRequest) => Promise<LoginResult>;
  selectAgency: (
    selectionToken: string,
    membershipId: number
  ) => Promise<LoginError | null>;
  switchAgency: (membershipId: number) => Promise<LoginError | null>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // FE-025: apply the account's stored locale on session start.
  // Only replace when locale actually differs; preserve pathname + query.
  const applyStoredLocale = useCallback((userLocale: string | undefined) => {
    if (!userLocale) return;
    if (userLocale !== locale) {
      const qs = searchParams.toString();
      const target = qs ? `${pathname}?${qs}` : pathname;
      router.replace(target, { locale: userLocale as "en" | "vi" });
    }
  }, [locale, pathname, searchParams, router]);

  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      const cached = loadSession();
      if (cached && isMounted) {
        setSession(cached);
      }

      const meResult = await clientGetMe(locale);
      if (!isMounted) return;

      if (meResult.success) {
        const validatedSession: AuthSession = {
          token: "httpOnly",
          user: meResult.user,
          agency: meResult.agency,
        };
        setSession(validatedSession);
        saveSession(validatedSession);
        applyStoredLocale(meResult.user.locale);
      } else if (cached) {
        clearCachedSession();
        setSession(null);
      }

      setIsLoading(false);
    }

    initSession();

    return () => {
      isMounted = false;
    };
  }, [locale]);

  const login = useCallback(
    async (req: LoginRequest): Promise<LoginResult> => {
      const result = await clientLogin(req, locale);

      if (!result.success) {
        return result;
      }

      if ("invitationOnly" in result) {
        // FIX-024: no session exists yet — the only credential is the
        // invitation cookie set by the BFF; the form navigates back to
        // the accept page (or shows the pending-invitation notice).
        clearCachedSession();
        clearSelection();
        setSession(null);
        return result;
      }

      if (result.requiresSelection) {
        clearCachedSession();
        saveSelection(result.selection);
        setSession(null);
        return result;
      }

      clearSelection();
      saveSession(result.session);
      setSession(result.session);
      applyStoredLocale(result.session.user.locale);
      return result;
    },
    [locale, applyStoredLocale]
  );

  const selectAgency = useCallback(
    async (
      selectionToken: string,
      membershipId: number
    ): Promise<LoginError | null> => {
      const result = await clientSelectAgency(selectionToken, membershipId, locale);

      if (!result.success) {
        return { code: result.code, message: result.message, details: result.details };
      }

      clearSelection();
      saveSession(result.session);
      setSession(result.session);
      applyStoredLocale(result.session.user.locale);
      return null;
    },
    [locale, applyStoredLocale]
  );

  const switchAgency = useCallback(
    async (membershipId: number): Promise<LoginError | null> => {
      const result = await clientSwitchAgency(membershipId, locale);

      if (!result.success) {
        return { code: result.code, message: result.message, details: result.details };
      }

      saveSession(result.session);
      setSession(result.session);
      applyStoredLocale(result.session.user.locale);
      return null;
    },
    [locale, applyStoredLocale]
  );

  const logout = useCallback(async () => {
    await clientLogout();
    clearSession();
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ session, login, selectAgency, switchAgency, logout, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return ctx;
}
