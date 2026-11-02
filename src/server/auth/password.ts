import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function hashOwnerPassword(password: string): string {
  if (password.length < 12 || password.length > 256) {
    throw new Error("Owner passwords must be between 12 and 256 characters.");
  }
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return "scrypt$" + salt.toString("hex") + "$" + derived.toString("hex");
}

export function verifyOwnerPassword(password: string, encoded: string): boolean {
  const [algorithm, saltHex, expectedHex] = encoded.split("$");
  if (algorithm !== "scrypt" || !saltHex || !expectedHex
    || !/^[a-f0-9]{32}$/i.test(saltHex)
    || !/^[a-f0-9]{128}$/i.test(expectedHex)) {
    return false;
  }
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
