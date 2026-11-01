import { describe, expect, it } from "vitest";
import { getSafeRedirectPath } from "./safe-redirect";

describe("getSafeRedirectPath", () => {
  const origin = "https://desertartgallery.net";

  it("keeps a valid same-origin path with query and hash", () => {
    expect(getSafeRedirectPath("/account?tab=orders#recent", origin)).toBe("/account?tab=orders#recent");
  });

  it("rejects absolute external URLs", () => {
    expect(getSafeRedirectPath("https://attacker.example/path", origin)).toBe("/account");
  });

  it("rejects protocol-relative URLs", () => {
    expect(getSafeRedirectPath("//attacker.example/path", origin)).toBe("/account");
  });

  it("rejects slash-backslash redirect variants", () => {
    expect(getSafeRedirectPath("/\\\\attacker.example/path", origin)).toBe("/account");
  });

  it("uses the supplied fallback for empty values", () => {
    expect(getSafeRedirectPath(null, origin, "/shop")).toBe("/shop");
  });
}
