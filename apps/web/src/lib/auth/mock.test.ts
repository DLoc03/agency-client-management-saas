/**
 * Auth mock service unit tests — FE-002
 * Uses Vitest. Run: pnpm test
 */

import { describe, expect, it } from "vitest";
import { mockLogin } from "@/lib/auth/mock";

describe("mockLogin", () => {
  it("returns INVALID_CREDENTIALS for unknown email", async () => {
    const result = await mockLogin({ email: "nobody@example.com", password: "password8" });
    expect(result).toMatchObject({ status: 401, code: "INVALID_CREDENTIALS" });
  });

  it("returns INVALID_CREDENTIALS for wrong password", async () => {
    const result = await mockLogin({ email: "owner@acme.test", password: "wrongpass" });
    expect(result).toMatchObject({ status: 401, code: "INVALID_CREDENTIALS" });
  });

  it("returns AGENCY_LOCKED when agency is locked", async () => {
    const result = await mockLogin({ email: "locked-agency@beta.test", password: "password8" });
    expect(result).toMatchObject({ status: 403, code: "AGENCY_LOCKED" });
  });

  it("returns ACCOUNT_DISABLED when account is disabled", async () => {
    const result = await mockLogin({ email: "disabled@acme.test", password: "password8" });
    expect(result).toMatchObject({ status: 403, code: "ACCOUNT_DISABLED" });
  });

  it("returns token + user + agency on valid credentials", async () => {
    const result = await mockLogin({ email: "owner@acme.test", password: "password8" });
    expect("data" in result).toBe(true);
    if ("data" in result && "token" in result.data) {
      expect(result.data.token).toMatch(/^mock_token_/);
      expect(result.data.user.email).toBe("owner@acme.test");
      expect(result.data.user.roles).toContain("agency_owner");
      expect(result.data.agency.slug).toBe("acme");
    }
  });

  it("is case-insensitive for email", async () => {
    const result = await mockLogin({ email: "OWNER@ACME.TEST", password: "password8" });
    expect("data" in result).toBe(true);
  });
});
