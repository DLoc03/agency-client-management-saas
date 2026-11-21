/**
 * Unit tests for Real Auth API Client — FE-004
 * Tests backendLogin, backendGetMe, backendLogout, error code mapping, and locale handling.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { backendGetMe, backendLogin, backendLogout, getBackendApiUrl, normalizeBackendBaseUrl } from "./api";

describe("Real Auth API (backendLogin, backendGetMe, backendLogout)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("backendLogin", () => {
    it("returns token + user + agency on 200 OK", async () => {
      const mockResponseData = {
        token: "1|sanctum_token_123",
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
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: mockResponseData }),
      } as Response);

      const result = await backendLogin(
        { email: "owner@acme.test", password: "password8" },
        "en"
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.token).toBe("1|sanctum_token_123");
        expect(result.data.user.roles).toContain("agency_owner");
        expect(result.data.agency.slug).toBe("acme");
      }

      // Check request headers and body
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/auth/login"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Accept: "application/json",
            "Accept-Language": "en",
          }),
          body: JSON.stringify({
            email: "owner@acme.test",
            password: "password8",
          }),
        })
      );
    });

    it("maps 401 response to INVALID_CREDENTIALS with bilingual message", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            code: "INVALID_CREDENTIALS",
            message: "Email hoặc mật khẩu không đúng.",
          },
        }),
      } as Response);

      const result = await backendLogin(
        { email: "wrong@acme.test", password: "badpassword" },
        "vi"
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(401);
        expect(result.error.code).toBe("INVALID_CREDENTIALS");
        expect(result.error.message).toBe("Email hoặc mật khẩu không đúng.");
      }
    });

    it("maps 403 response to AGENCY_LOCKED", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: {
            code: "AGENCY_LOCKED",
            message: "Your agency workspace has been locked.",
          },
        }),
      } as Response);

      const result = await backendLogin(
        { email: "locked@beta.test", password: "password8" },
        "en"
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(403);
        expect(result.error.code).toBe("AGENCY_LOCKED");
      }
    });

    it("maps 403 response to ACCOUNT_DISABLED", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 403,
        json: async () => ({
          error: {
            code: "ACCOUNT_DISABLED",
            message: "Tài khoản của bạn đã bị vô hiệu hoá.",
          },
        }),
      } as Response);

      const result = await backendLogin(
        { email: "disabled@acme.test", password: "password8" },
        "vi"
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(403);
        expect(result.error.code).toBe("ACCOUNT_DISABLED");
        expect(result.error.message).toBe("Tài khoản của bạn đã bị vô hiệu hoá.");
      }
    });

    it("handles network failure gracefully", async () => {
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Connection refused"));

      const result = await backendLogin(
        { email: "owner@acme.test", password: "password8" },
        "en"
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe("NETWORK_ERROR");
      }
    });
  });

  describe("backendGetMe", () => {
    it("returns current user + roles + permissions on 200 OK", async () => {
      const mockMeData = {
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
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ data: mockMeData }),
      } as Response);

      const result = await backendGetMe("valid_token", "en");

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.user.name).toBe("Alice Owner");
        expect(result.data.user.permissions).toContain("workspace.delete");
      }

      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/auth/me"),
        expect.objectContaining({
          method: "GET",
          headers: expect.objectContaining({
            Authorization: "Bearer valid_token",
          }),
        })
      );
    });

    it("returns UNAUTHENTICATED error on 401", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({
          error: {
            code: "UNAUTHENTICATED",
            message: "Unauthenticated.",
          },
        }),
      } as Response);

      const result = await backendGetMe("invalid_token", "en");
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(401);
        expect(result.error.code).toBe("UNAUTHENTICATED");
      }
    });
  });

  describe("backendLogout", () => {
    it("calls POST /v1/auth/logout with Bearer token", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        status: 204,
      } as Response);

      const success = await backendLogout("valid_token");
      expect(success).toBe(true);
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining("/v1/auth/logout"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer valid_token",
          }),
        })
      );
    });
  });
});


describe("getBackendApiUrl (FE-006 normalization)", () => {
  const originalInternal = process.env.INTERNAL_API_URL;
  const originalPublic = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    if (originalInternal === undefined) delete process.env.INTERNAL_API_URL;
    else process.env.INTERNAL_API_URL = originalInternal;
    if (originalPublic === undefined) delete process.env.NEXT_PUBLIC_API_URL;
    else process.env.NEXT_PUBLIC_API_URL = originalPublic;
  });

  it("normalizes a base that already ends with /v1 (no double /v1)", () => {
    expect(normalizeBackendBaseUrl("http://localhost:8000/api/v1")).toBe("http://localhost:8000/api");
    expect(normalizeBackendBaseUrl("http://localhost:8000/api/v1/")).toBe("http://localhost:8000/api");
    expect(normalizeBackendBaseUrl("http://localhost:8000/api/")).toBe("http://localhost:8000/api");
  });

  it("returns canonical base when NEXT_PUBLIC_API_URL carries /v1 (regression)", () => {
    delete process.env.INTERNAL_API_URL;
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:8000/api/v1";
    expect(getBackendApiUrl()).toBe("http://localhost:8000/api");
  });

  it("prefers INTERNAL_API_URL and normalizes it too", () => {
    process.env.INTERNAL_API_URL = "http://api:8000/api/v1/";
    expect(getBackendApiUrl()).toBe("http://api:8000/api");
  });
});
