/**
 * Mock Service for Client Portal Auth — FE-003
 * Simulates POST /api/v1/portal/auth/login, logout, me, forgot-password, reset-password
 * per docs/AUTH_CONTRACT.md §3 & DEC-008.
 */

import type {
  PortalForgotPasswordRequest,
  PortalLoginRequest,
  PortalLoginResponse,
  PortalMeResponse,
  PortalResetPasswordRequest,
  PortalResetResult,
} from "./types";

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Pre-seeded mock client accounts */
export const MOCK_PORTAL_ACCOUNTS = [
  {
    email: "client@partner.test",
    password: "password8",
    agencyLocked: false,
    accountDisabled: false,
    client: {
      id: 1,
      client_id: 101,
      name: "Acme Client User",
      email: "client@partner.test",
      locale: "en" as const,
    },
    agency: {
      id: 1,
      name: "Acme Agency",
      slug: "acme",
    },
  },
  {
    email: "khachhang@partner.test",
    password: "password8",
    agencyLocked: false,
    accountDisabled: false,
    client: {
      id: 2,
      client_id: 102,
      name: "Khách Hàng Việt Nam",
      email: "khachhang@partner.test",
      locale: "vi" as const,
    },
    agency: {
      id: 1,
      name: "Acme Agency",
      slug: "acme",
    },
  },
  {
    email: "disabled@client.test",
    password: "password8",
    agencyLocked: false,
    accountDisabled: true,
    client: {
      id: 3,
      client_id: 103,
      name: "Disabled Client",
      email: "disabled@client.test",
      locale: "en" as const,
    },
    agency: {
      id: 1,
      name: "Acme Agency",
      slug: "acme",
    },
  },
  {
    email: "locked@client.test",
    password: "password8",
    agencyLocked: true,
    accountDisabled: false,
    client: {
      id: 4,
      client_id: 104,
      name: "Locked Agency Client",
      email: "locked@client.test",
      locale: "en" as const,
    },
    agency: {
      id: 2,
      name: "Locked Agency",
      slug: "locked",
    },
  },
];

export type MockPortalLoginError =
  | { status: 401; code: "INVALID_CREDENTIALS" }
  | { status: 403; code: "AGENCY_LOCKED" }
  | { status: 403; code: "ACCOUNT_DISABLED" };

/**
 * Simulates POST /api/v1/portal/auth/login
 */
export async function mockPortalLogin(
  req: PortalLoginRequest
): Promise<PortalLoginResponse | MockPortalLoginError> {
  await delay(100);

  const account = MOCK_PORTAL_ACCOUNTS.find(
    (a) => a.email.toLowerCase() === req.email.toLowerCase()
  );

  if (!account || account.password !== req.password) {
    return { status: 401, code: "INVALID_CREDENTIALS" };
  }

  if (account.agencyLocked) {
    return { status: 403, code: "AGENCY_LOCKED" };
  }

  if (account.accountDisabled) {
    return { status: 403, code: "ACCOUNT_DISABLED" };
  }

  // Token carries ability 'portal' (§1 & §3)
  const token = `mock_portal_token_${account.client.id}_${Date.now()}`;

  return {
    data: {
      token,
      client: account.client,
      agency: account.agency,
    },
  };
}

/**
 * Simulates GET /api/v1/portal/auth/me
 */
export async function mockPortalGetMe(
  token: string
): Promise<PortalMeResponse | { status: 401; code: "UNAUTHENTICATED" }> {
  await delay(50);
  if (!token || !token.startsWith("mock_portal_token_")) {
    return { status: 401, code: "UNAUTHENTICATED" };
  }

  const account = MOCK_PORTAL_ACCOUNTS[0];
  return {
    data: {
      client: account.client,
      agency: account.agency,
    },
  };
}

/**
 * Simulates POST /api/v1/portal/auth/forgot-password
 * Contract: Luôn trả 200 kể cả email không tồn tại (chống dò tài khoản).
 */
export async function mockPortalForgotPassword(
  _req: PortalForgotPasswordRequest
): Promise<{ data: { message: string } }> {
  await delay(100);
  return {
    data: {
      message: "If the account exists, a password reset email has been sent.",
    },
  };
}

/**
 * Simulates POST /api/v1/portal/auth/reset-password
 * Contract: { token, email, password }. Token sai/hết hạn → 422 INVALID_RESET_TOKEN.
 */
export async function mockPortalResetPassword(
  req: PortalResetPasswordRequest
): Promise<PortalResetResult> {
  await delay(100);

  // Accept "valid-token" or tokens containing "valid"
  if (!req.token || (!req.token.includes("valid") && req.token.length < 8)) {
    return {
      success: false,
      code: "INVALID_RESET_TOKEN",
      message: "Invalid or expired reset token.",
    };
  }

  return {
    success: true,
    message: "Your password has been reset.",
  };
}
