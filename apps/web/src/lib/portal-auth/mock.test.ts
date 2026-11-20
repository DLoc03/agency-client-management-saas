/**
 * Unit tests for Portal Auth Mock Service — FE-003
 */

import { describe, expect, it } from "vitest";
import {
  mockPortalForgotPassword,
  mockPortalGetMe,
  mockPortalLogin,
  mockPortalResetPassword,
} from "./mock";

describe("Portal Auth Mock Service (FE-003)", () => {
  describe("mockPortalLogin", () => {
    it("returns portal token + client + agency on valid credentials", async () => {
      const result = await mockPortalLogin({
        email: "client@partner.test",
        password: "password8",
      });

      expect("data" in result).toBe(true);
      if ("data" in result) {
        expect(result.data.token).toMatch(/^mock_portal_token_/);
        expect(result.data.client.email).toBe("client@partner.test");
        expect(result.data.client.client_id).toBe(101);
        expect(result.data.agency.slug).toBe("acme");
      }
    });

    it("returns INVALID_CREDENTIALS for unknown email", async () => {
      const result = await mockPortalLogin({
        email: "unknown@client.test",
        password: "password8",
      });

      expect(result).toMatchObject({
        status: 401,
        code: "INVALID_CREDENTIALS",
      });
    });

    it("returns INVALID_CREDENTIALS for incorrect password", async () => {
      const result = await mockPortalLogin({
        email: "client@partner.test",
        password: "wrong_password",
      });

      expect(result).toMatchObject({
        status: 401,
        code: "INVALID_CREDENTIALS",
      });
    });

    it("returns ACCOUNT_DISABLED when client account is inactive", async () => {
      const result = await mockPortalLogin({
        email: "disabled@client.test",
        password: "password8",
      });

      expect(result).toMatchObject({
        status: 403,
        code: "ACCOUNT_DISABLED",
      });
    });

    it("returns AGENCY_LOCKED when agency is locked", async () => {
      const result = await mockPortalLogin({
        email: "locked@client.test",
        password: "password8",
      });

      expect(result).toMatchObject({
        status: 403,
        code: "AGENCY_LOCKED",
      });
    });
  });

  describe("mockPortalForgotPassword", () => {
    it("always returns 200 success message to prevent account enumeration", async () => {
      const result = await mockPortalForgotPassword({
        email: "any_email@test.com",
      });

      expect(result.data.message).toBe(
        "If the account exists, a password reset email has been sent."
      );
    });
  });

  describe("mockPortalResetPassword", () => {
    it("succeeds with a valid token", async () => {
      const result = await mockPortalResetPassword({
        token: "valid-reset-token-12345",
        email: "client@partner.test",
        password: "newpassword123",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.message).toBe("Your password has been reset.");
      }
    });

    it("returns INVALID_RESET_TOKEN for invalid/expired token", async () => {
      const result = await mockPortalResetPassword({
        token: "bad",
        email: "client@partner.test",
        password: "newpassword123",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.code).toBe("INVALID_RESET_TOKEN");
      }
    });
  });

  describe("mockPortalGetMe", () => {
    it("returns client info for valid portal token", async () => {
      const result = await mockPortalGetMe("mock_portal_token_1_123");
      expect("data" in result).toBe(true);
    });

    it("returns 401 UNAUTHENTICATED for invalid token", async () => {
      const result = await mockPortalGetMe("wrong_token");
      expect(result).toMatchObject({
        status: 401,
        code: "UNAUTHENTICATED",
      });
    });
  });
});
