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
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import type {
  PortalAuthSession,
  PortalBackendInvitationOnly,
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
  logout: () => Promise<void>;
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
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // FE-025: apply the account's stored locale on session start.
  const applyStoredLocale = useCallback((userLocale: string | undefined) => {
    if (!userLocale) return;
    if (userLocale !== locale) {
      const qs = searchParams.toString();
      const target = qs ? `${pathname}?${qs}` : pathname;
      router.replace(target, { locale: userLocale as "en" | "vi" });
    }
  }, [locale, pathname, searchParams, router]);

  // The bootstrap effect below must run once on mount only. It reads the
  // latest applyStoredLocale through a ref: the callback's identity changes
  // on every navigation (pathname/searchParams deps), so depending on it
  // directly would refetch the session profile on every route change.
  const applyStoredLocaleRef = useRef(applyStoredLocale);
  applyStoredLocaleRef.current = applyStoredLocale;

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
          applyStoredLocaleRef.current(body.data.client.locale);
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
        const body = (await res.json()) as
          | PortalMeResponse
          | { data: PortalBackendInvitationOnly };
        if ("invitation_only" in body.data) {
          // FIX-024: no Portal session exists yet — the BFF parked the
          // invitation-scoped token in its cookie; the form navigates
          // back to the accept page (or shows the pending notice).
          return {
            success: true,
            invitationOnly: true,
            invitation: body.data.invitation,
          };
        }
        const newSession: PortalAuthSession = {
          client: body.data.client,
          agency: body.data.agency,
        };
        setSession(newSession);
        applyStoredLocale(body.data.client.locale);
        return { success: true, session: newSession };
      } catch {
        return { success: false, code: "NETWORK_ERROR" };
      }
    },
    [applyStoredLocale]
  );

  const logout = useCallback(async () => {
    // Await the BFF logout so the portal_token cookie is actually cleared
    // before the caller navigates: the middleware redirects /portal/login
    // back to /portal while the cookie still exists, which stranded the
    // user on a blank page until reload (acceptance round 3, item P6).
    try {
      await fetch("/api/portal/auth/logout", { method: "POST" });
    } catch {
      // Best effort — the local session ends regardless.
    }
    setSession(null);
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
