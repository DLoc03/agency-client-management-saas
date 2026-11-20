/**
 * Mock Auth Service — FE-002
 * Simulates POST /api/v1/auth/login responses per AUTH_CONTRACT.md §3.
 * Replace with real fetch call when BE-003 ships.
 */

import type { LoginRequest, LoginResponse } from "./types";

/** Simulate network delay */
const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Pre-seeded mock accounts (email is globally unique per DEC-008) */
const MOCK_ACCOUNTS = [
  {
    email: "owner@acme.test",
    password: "password8",
    agencyLocked: false,
    accountDisabled: false,
    user: {
      id: 1,
      name: "Alice Owner",
      email: "owner@acme.test",
      locale: "en" as const,
      roles: ["agency_owner"],
      permissions: ["workspace.settings.update", "workspace.delete"],
    },
    agency: {
      id: 1,
      name: "Acme Agency",
      slug: "acme",
      base_currency: "USD",
      timezone: "America/New_York",
    },
  },
  {
    email: "admin@acme.test",
    password: "password8",
    agencyLocked: false,
    accountDisabled: false,
    user: {
      id: 2,
      name: "Bob Admin",
      email: "admin@acme.test",
      locale: "vi" as const,
      roles: ["admin"],
      permissions: ["workspace.members.lock", "workspace.roles.assign"],
    },
    agency: {
      id: 1,
      name: "Acme Agency",
      slug: "acme",
      base_currency: "USD",
      timezone: "America/New_York",
    },
  },
  {
    email: "locked-agency@beta.test",
    password: "password8",
    agencyLocked: true,
    accountDisabled: false,
    user: {
      id: 3,
      name: "Charlie",
      email: "locked-agency@beta.test",
      locale: "en" as const,
      roles: ["team_member"],
      permissions: [],
    },
    agency: {
      id: 2,
      name: "Beta Agency (Locked)",
      slug: "beta",
      base_currency: "VND",
      timezone: "Asia/Ho_Chi_Minh",
    },
  },
  {
    email: "disabled@acme.test",
    password: "password8",
    agencyLocked: false,
    accountDisabled: true,
    user: {
      id: 4,
      name: "Dave Disabled",
      email: "disabled@acme.test",
      locale: "en" as const,
      roles: ["team_member"],
      permissions: [],
    },
    agency: {
      id: 1,
      name: "Acme Agency",
      slug: "acme",
      base_currency: "USD",
      timezone: "America/New_York",
    },
  },
];

export type MockLoginError =
  | { status: 401; code: "INVALID_CREDENTIALS" }
  | { status: 403; code: "AGENCY_LOCKED" }
  | { status: 403; code: "ACCOUNT_DISABLED" };

export async function mockLogin(
  req: LoginRequest
): Promise<LoginResponse | MockLoginError> {
  await delay(600); // simulate network

  const account = MOCK_ACCOUNTS.find(
    (a) => a.email.toLowerCase() === req.email.toLowerCase()
  );

  // No account OR wrong password → INVALID_CREDENTIALS (do not reveal which)
  if (!account || account.password !== req.password) {
    return { status: 401, code: "INVALID_CREDENTIALS" };
  }

  if (account.agencyLocked) {
    return { status: 403, code: "AGENCY_LOCKED" };
  }

  if (account.accountDisabled) {
    return { status: 403, code: "ACCOUNT_DISABLED" };
  }

  // Success
  const token = `mock_token_${account.user.id}_${Date.now()}`;
  return {
    data: {
      token,
      user: account.user,
      agency: account.agency,
    },
  };
}
