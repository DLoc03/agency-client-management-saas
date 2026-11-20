/**
 * Auth context — FE-002
 * Provides { session, login, logout } to the whole app.
 */

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { mockLogin } from "./mock";
import { clearSession, loadSession, saveSession } from "./storage";
import type { AuthSession, LoginRequest } from "./types";

interface AuthContextValue {
  session: AuthSession | null;
  /** Returns error code string on failure, null on success */
  login: (req: LoginRequest) => Promise<string | null>;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate session on mount
  useEffect(() => {
    setSession(loadSession());
    setIsLoading(false);
  }, []);

  const login = useCallback(async (req: LoginRequest): Promise<string | null> => {
    const result = await mockLogin(req);

    if ("status" in result) {
      // Error branch
      return result.code;
    }

    const newSession: AuthSession = {
      token: result.data.token,
      user: result.data.user,
      agency: result.data.agency,
    };
    saveSession(newSession);
    setSession(newSession);
    return null;
  }, []);

  const logout = useCallback(() => {
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
