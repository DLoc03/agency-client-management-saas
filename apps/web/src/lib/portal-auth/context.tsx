/**
 * Client Portal Auth Context — FE-003
 * Provides { session, login, logout, forgotPassword, resetPassword, isLoading }
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
import {
  mockPortalForgotPassword,
  mockPortalLogin,
  mockPortalResetPassword,
} from "./mock";
import {
  clearPortalSession,
  loadPortalSession,
  savePortalSession,
} from "./storage";
import type {
  PortalAuthSession,
  PortalForgotPasswordRequest,
  PortalLoginRequest,
  PortalLoginResult,
  PortalResetPasswordRequest,
  PortalResetResult,
} from "./types";

interface PortalAuthContextValue {
  session: PortalAuthSession | null;
  login: (req: PortalLoginRequest) => Promise<PortalLoginResult>;
  logout: () => void;
  forgotPassword: (
    req: PortalForgotPasswordRequest
  ) => Promise<{ success: boolean; message: string }>;
  resetPassword: (req: PortalResetPasswordRequest) => Promise<PortalResetResult>;
  isLoading: boolean;
}

const PortalAuthContext = createContext<PortalAuthContextValue | null>(null);

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PortalAuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setSession(loadPortalSession());
    setIsLoading(false);
  }, []);

  const login = useCallback(
    async (req: PortalLoginRequest): Promise<PortalLoginResult> => {
      const result = await mockPortalLogin(req);

      if ("status" in result) {
        return {
          success: false,
          code: result.code,
        };
      }

      const newSession: PortalAuthSession = {
        token: result.data.token,
        client: result.data.client,
        agency: result.data.agency,
      };

      savePortalSession(newSession);
      setSession(newSession);
      return { success: true, session: newSession };
    },
    []
  );

  const logout = useCallback(() => {
    clearPortalSession();
    setSession(null);
  }, []);

  const forgotPassword = useCallback(
    async (req: PortalForgotPasswordRequest) => {
      const res = await mockPortalForgotPassword(req);
      return { success: true, message: res.data.message };
    },
    []
  );

  const resetPassword = useCallback(
    async (req: PortalResetPasswordRequest): Promise<PortalResetResult> => {
      return await mockPortalResetPassword(req);
    },
    []
  );

  return (
    <PortalAuthContext.Provider
      value={{
        session,
        login,
        logout,
        forgotPassword,
        resetPassword,
        isLoading,
      }}
    >
      {children}
    </PortalAuthContext.Provider>
  );
}

export function usePortalAuth(): PortalAuthContextValue {
  const ctx = useContext(PortalAuthContext);
  if (!ctx) {
    throw new Error(
      "usePortalAuth must be used inside a <PortalAuthProvider>"
    );
  }
  return ctx;
}
