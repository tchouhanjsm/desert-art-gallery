import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const N = 32_768;
const R = 8;
const P = 1;
const KEY_LENGTH = 64;

async function derive(password: string, salt: Buffer): Promise<Buffer> {
  return await scrypt(password, salt, KEY_LENGTH, {
    N, r: R, p: P, maxmem: 64 * 1024 * 1024,
  }) as Buffer;
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 128) {
    throw new Error("Password must contain between 12 and 128 characters.");
  }
  const salt = randomBytes(16);
  const key = await derive(password, salt);
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [algorithm, nText, rText, pText, saltText, keyText] = encoded.split("$");
  if (algorithm !== "scrypt" || nText !== String(N) || rText !== String(R) || pText !== String(P) || !saltText || !keyText) {
    return false;
  }
  try {
    const salt = Buffer.from(saltText, "base64url");
    const expected = Buffer.from(keyText, "base64url");
    if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
    const actual = await derive(password, salt);
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
