import { describe, expect, it } from "vitest";
import { loginNavOptions } from "./login-nav";

describe("loginNavOptions (FIX-049)", () => {
  it("carries the account locale when present", () => {
    expect(loginNavOptions("vi")).toEqual({ locale: "vi" });
    expect(loginNavOptions("en")).toEqual({ locale: "en" });
  });

  it("returns undefined when locale is missing to keep current behavior", () => {
    expect(loginNavOptions(undefined)).toBeUndefined();
  });
});