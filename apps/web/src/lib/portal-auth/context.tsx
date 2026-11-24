/**
 * Client Portal Auth Context — FE-003, real-API wiring FE-013
 * Provides { session, login, logout, forgotPassword, resetPassword, isLoading }
 *
 * All calls go through the BFF (/api/portal/auth/*); the Sanctum token
 * lives in the httpOnly portal_token cookie and is never seen by this
 * code. The session holds identity only (client + agency).
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
import type {
  PortalAuthSession,
  PortalForgotPasswordRequest,
  PortalLoginRequest,
  PortalLoginResult,
  PortalMeResponse,
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

async function readErrorCode(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  return body?.error?.code || "REQUEST_FAILED";
}

async function readMessage(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  return body?.data?.message || body?.message || "";
}

export function PortalAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<PortalAuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Bootstrap the session from the httpOnly cookie via the BFF.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/portal/auth/me", {
          headers: { Accept: "application/json" },
        });
        if (!cancelled && res.ok) {
          const body = (await res.json()) as PortalMeResponse;
          setSession({ client: body.data.client, agency: body.data.agency });
        }
      } catch {
        // No session — the route guards handle redirection.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (req: PortalLoginRequest): Promise<PortalLoginResult> => {
      try {
        const res = await fetch("/api/portal/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(req),
        });
        if (!res.ok) {
          return { success: false, code: await readErrorCode(res) };
        }
        const body = (await res.json()) as PortalMeResponse;
        const newSession: PortalAuthSession = {
          client: body.data.client,
          agency: body.data.agency,
        };
        setSession(newSession);
        return { success: true, session: newSession };
      } catch {
        return { success: false, code: "NETWORK_ERROR" };
      }
    },
    []
  );

  const logout = useCallback(() => {
    setSession(null);
    // Fire and forget: revoke at the backend + clear the cookie.
    void fetch("/api/portal/auth/logout", { method: "POST" }).catch(() => undefined);
  }, []);

  const forgotPassword = useCallback(
    async (req: PortalForgotPasswordRequest) => {
      try {
        const res = await fetch("/api/portal/auth/forgot-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(req),
        });
        return { success: res.ok, message: await readMessage(res) };
      } catch {
        return { success: false, message: "" };
      }
    },
    []
  );

  const resetPassword = useCallback(
    async (req: PortalResetPasswordRequest): Promise<PortalResetResult> => {
      try {
        const res = await fetch("/api/portal/auth/reset-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(req),
        });
        if (!res.ok) {
          return { success: false, code: await readErrorCode(res) };
        }
        return { success: true, message: await readMessage(res) };
      } catch {
        return { success: false, code: "NETWORK_ERROR" };
      }
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
