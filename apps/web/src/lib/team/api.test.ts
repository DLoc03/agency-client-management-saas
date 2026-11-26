import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acceptInvitation, previewInvitation } from "./api";

describe("Team invitation API (FE-015)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("previews an invitation through the internal BFF", async () => {
    const data = {
      agency: { id: 1, name: "Acme" },
      email: "invitee@demo.test",
      kind: "staff" as const,
      roles: ["agency_owner"],
      has_identity: false,
      matches_current_user: null,
      expires_at: "2026-12-01T00:00:00Z",
    };
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data }),
    } as Response);

    await expect(previewInvitation("raw token")).resolves.toEqual(data);
    expect(fetch).toHaveBeenCalledWith(
      "/api/invitations/preview?token=raw%20token",
      expect.objectContaining({ headers: expect.objectContaining({ Accept: "application/json" }) })
    );
  });

  it("previews an invitation through the Portal BFF", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ data: { matches_current_user: true } }),
    } as Response);

    await previewInvitation("abc", { portal: true });
    expect(fetch).toHaveBeenCalledWith(
      "/api/portal/invitations/preview?token=abc",
      expect.anything()
    );
  });

  it("accepts a known identity without sending a password", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({
        data: {
          user_id: 1,
          email: "invitee@demo.test",
          agency_id: 1,
          kind: "staff",
        },
      }),
    } as Response);

    await acceptInvitation({ token: "abc" });
    expect(fetch).toHaveBeenCalledWith(
      "/api/invitations/accept",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "abc" }),
      })
    );
  });

  it("posts a Portal acceptance through the Portal BFF", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ data: { kind: "client" } }),
    } as Response);

    await acceptInvitation(
      { token: "abc", name: "Client", password: "password8" },
      { portal: true }
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/portal/invitations/accept",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "abc", name: "Client", password: "password8" }),
      })
    );
  });

  it("preserves the API error code for login-required", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
      json: async () => ({
        error: { code: "INVITATION_LOGIN_REQUIRED", message: "Sign in first." },
      }),
    } as Response);

    await expect(acceptInvitation({ token: "abc" })).rejects.toMatchObject({
      code: "INVITATION_LOGIN_REQUIRED",
      status: 403,
    });
  });
});
