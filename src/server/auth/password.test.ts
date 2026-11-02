import { describe, expect, it } from "vitest";
import { hashOwnerPassword, verifyOwnerPassword } from "./password";

describe("local owner password hashing", () => {
  it("hashes and verifies a valid password without storing the cleartext", () => {
    const password = "GalleryOwner-Passphrase-2026!";
    const encoded = hashOwnerPassword(password);
    expect(encoded).toMatch(/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    expect(encoded).not.toContain(password);
    expect(verifyOwnerPassword(password, encoded)).toBe(true);
    expect(verifyOwnerPassword("different-password", encoded)).toBe(false);
  });

  it("rejects passwords below the configured minimum length", () => {
    expect(() => hashOwnerPassword("short")).toThrow("between 12 and 256 characters");
  });

  it("fails closed for malformed password hashes", () => {
    expect(verifyOwnerPassword("anything", "plain-password")).toBe(false);
    expect(verifyOwnerPassword("anything", "scrypt$bad$salt")).toBe(false);
  });
});
