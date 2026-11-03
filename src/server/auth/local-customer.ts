import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt, lte } from "drizzle-orm";
import { cookies } from "next/headers";
import { normalizeCustomerEmail, isValidCustomerEmail, validateCustomerDisplayName } from "@/lib/customer-account";
import { getMySqlDb } from "@/server/db";
import { customerSessions, customerUsers } from "@/server/db/schema";
import { hashOwnerPassword, verifyOwnerPassword } from "./password";

export const LOCAL_CUSTOMER_SESSION_COOKIE = "dag_customer_session";
const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;
const DUMMY_PASSWORD_HASH = "scrypt$" + "44".repeat(16) + "$" + "00".repeat(64);

export type LocalCustomer = { id: string; email: string; displayName: string; phone: string };

export function isMySqlCustomerAuthEnabled(): boolean {
  const enabled = process.env.MYSQL_CUSTOMER_AUTH_ENABLED?.trim().toLowerCase() === "true";
  if (!enabled) return false;
  if (!process.env.DATABASE_URL?.trim()) throw new Error("MYSQL_CUSTOMER_AUTH_ENABLED requires DATABASE_URL.");
  if (process.env.MYSQL_CATALOGUE_ENABLED?.trim().toLowerCase() !== "true") {
    throw new Error("MYSQL_CUSTOMER_AUTH_ENABLED also requires MYSQL_CATALOGUE_ENABLED.");
  }
  return true;
}

function requireCustomerAuthEnabled(): void {
  if (!isMySqlCustomerAuthEnabled()) {
    throw new Error("Customer authentication is not enabled on this environment.");
  }
}

function tokenDigest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function setCustomerCookie(rawToken: string): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(LOCAL_CUSTOMER_SESSION_COOKIE, rawToken, {
    httpOnly: true, secure: process.env.NODE_ENV === "production",
    sameSite: "lax", path: "/", maxAge: SESSION_LIFETIME_SECONDS,
  });
}

export async function createLocalCustomerAccount(input: {
  email: string; password: string; displayName: string;
}): Promise<void> {
  requireCustomerAuthEnabled();
  const email = normalizeCustomerEmail(input.email);
  if (!isValidCustomerEmail(email)) throw new Error("Enter a valid email address.");
  const displayName = validateCustomerDisplayName(input.displayName);
  if (typeof input.password !== "string" || input.password.length < 12 || input.password.length > 256) {
    throw new Error("Choose a password between 12 and 256 characters.");
  }

  const passwordHash = hashOwnerPassword(input.password);
  const customerId = randomUUID();
  const rawToken = randomBytes(32).toString("base64url");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_SECONDS * 1000);
  try {
    await getMySqlDb().transaction(async (tx) => {
      await tx.insert(customerUsers).values({
        id: customerId, email, displayName, phone: "", passwordHash,
        isActive: true, failedLoginCount: 0, lockedUntil: null,
        lastLoginAt: now, createdAt: now, updatedAt: now,
      });
      await tx.insert(customerSessions).values({
        id: randomUUID(), customerUserId: customerId,
        tokenHash: tokenDigest(rawToken), expiresAt, createdAt: now,
      });
    });
  } catch (error) {
    if ((error as { code?: string } | null)?.code === "ER_DUP_ENTRY") {
      throw new Error("An account could not be created with those details. Sign in if you already have an account.");
    }
    throw error;
  }
  await setCustomerCookie(rawToken);
}

export async function createLocalCustomerSession(emailInput: string, password: string): Promise<void> {
  requireCustomerAuthEnabled();
  const email = normalizeCustomerEmail(emailInput);
  if (!isValidCustomerEmail(email) || typeof password !== "string" || !password || password.length > 256) {
    verifyOwnerPassword(typeof password === "string" ? password : "", DUMMY_PASSWORD_HASH);
    throw new Error("Email or password is incorrect.");
  }

  const now = new Date();
  const result = await getMySqlDb().transaction(async (tx) => {
    // Serialize attempts for this account. Without a row lock, concurrent bad
    // passwords can all read the same counter and overwrite one another.
    const [user] = await tx.select().from(customerUsers)
      .where(eq(customerUsers.email, email))
      .limit(1)
      .for("update");

    if (!user || !user.isActive) {
      verifyOwnerPassword(password, DUMMY_PASSWORD_HASH);
      return { status: "invalid" as const };
    }
    if (user.lockedUntil && user.lockedUntil > now) {
      // Keep account existence and lock state out of the response/timing signal.
      verifyOwnerPassword(password, DUMMY_PASSWORD_HASH);
      return { status: "invalid" as const };
    }

    if (!verifyOwnerPassword(password, user.passwordHash)) {
      const nextFailedCount = Math.min(user.failedLoginCount + 1, 100);
      const lockedUntil = nextFailedCount >= MAX_FAILED_LOGIN_ATTEMPTS
        ? new Date(now.getTime() + LOCKOUT_MINUTES * 60 * 1000)
        : user.lockedUntil;
      await tx.update(customerUsers).set({
        failedLoginCount: nextFailedCount, lockedUntil, updatedAt: now,
      }).where(eq(customerUsers.id, user.id));
      // Return instead of throwing so the failed-attempt update commits.
      return { status: "invalid" as const };
    }

    const rawToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_SECONDS * 1000);
    await tx.delete(customerSessions).where(and(
      eq(customerSessions.customerUserId, user.id), lte(customerSessions.expiresAt, now),
    ));
    await tx.insert(customerSessions).values({
      id: randomUUID(), customerUserId: user.id, tokenHash: tokenDigest(rawToken), expiresAt, createdAt: now,
    });
    await tx.update(customerUsers).set({
      failedLoginCount: 0, lockedUntil: null, lastLoginAt: now, updatedAt: now,
    }).where(eq(customerUsers.id, user.id));
    return { status: "success" as const, rawToken };
  });

  if (result.status !== "success") throw new Error("Email or password is incorrect.");
  await setCustomerCookie(result.rawToken);
}

export async function getCurrentCustomer(): Promise<LocalCustomer | null> {
  if (!isMySqlCustomerAuthEnabled()) return null;
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(LOCAL_CUSTOMER_SESSION_COOKIE)?.value;
  if (!rawToken || !/^[A-Za-z0-9_-]{43}$/.test(rawToken)) return null;
  const [row] = await getMySqlDb().select({
    id: customerUsers.id, email: customerUsers.email,
    displayName: customerUsers.displayName, phone: customerUsers.phone,
  }).from(customerSessions)
    .innerJoin(customerUsers, eq(customerUsers.id, customerSessions.customerUserId))
    .where(and(
      eq(customerSessions.tokenHash, tokenDigest(rawToken)),
      gt(customerSessions.expiresAt, new Date()),
      eq(customerUsers.isActive, true),
    )).limit(1);
  return row ?? null;
}

export async function destroyLocalCustomerSession(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(LOCAL_CUSTOMER_SESSION_COOKIE)?.value;
  if (rawToken && /^[A-Za-z0-9_-]{43}$/.test(rawToken)) {
    await getMySqlDb().delete(customerSessions).where(eq(customerSessions.tokenHash, tokenDigest(rawToken)));
  }
  cookieStore.delete(LOCAL_CUSTOMER_SESSION_COOKIE);
}
