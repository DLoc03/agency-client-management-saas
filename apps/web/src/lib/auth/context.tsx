/**
 * Auth context — FE-004
 * Provides real authentication state { session, login, logout, isLoading }
 * with httpOnly cookie token management and /api/v1/auth/me revalidation.
 */

"use client";

import { useLocale } from "next-intl";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { clientGetMe, clientLogin, clientLogout } from "./api";
import { clearSession, loadSession, saveSession } from "./storage";
import type { AuthSession, LoginError, LoginRequest } from "./types";

interface AuthContextValue {
  session: AuthSession | null;
  /** Returns LoginError on failure, null on success */
  login: (req: LoginRequest) => Promise<LoginError | null>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const locale = useLocale();

  // Rehydrate and revalidate session on mount via /api/auth/me
  useEffect(() => {
    let isMounted = true;

    async function initSession() {
      // 1. Instant rehydration from client storage cache if available
      const cached = loadSession();
      if (cached && isMounted) {
        setSession(cached);
      }

      // 2. Authoritative check with backend /api/v1/auth/me via httpOnly cookie
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
      } else if (cached) {
        // Token expired, revoked, or invalid on backend
        clearSession();
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
    async (req: LoginRequest): Promise<LoginError | null> => {
      const result = await clientLogin(req, locale);

      if (!result.success) {
        return {
          code: result.code,
          message: result.message,
        };
      }

      saveSession(result.session);
      setSession(result.session);
      return null;
    },
    [locale]
  );

  const logout = useCallback(async () => {
    await clientLogout();
    clearSession();
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, login, logout, isLoading }}>
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
