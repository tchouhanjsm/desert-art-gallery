import "server-only";

import { createHash, randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { and, eq, gt, sql } from "drizzle-orm";
import { getMySqlDb } from "@/server/db";
import { adminSessions, adminUsers } from "@/server/db/schema";

export const LOCAL_ADMIN_SESSION_COOKIE = "dag_owner_session";
const SESSION_LIFETIME_SECONDS = 8 * 60 * 60;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 15;

export type LocalAdmin = {
  id: string;
  email: string;
  displayName: string;
  role: "owner" | "admin";
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function tokenDigest(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function hashAdminPassword(password: string): string {
  if (password.length < 12 || password.length > 256) {
    throw new Error("Owner passwords must be between 12 and 256 characters.");
  }
  const salt = randomBytes(16);
  const derived = scryptSync(password, salt, 64);
  return "scrypt$" + salt.toString("hex") + "$" + derived.toString("hex");
}

function verifyAdminPassword(password: string, encoded: string): boolean {
  const [algorithm, saltHex, expectedHex] = encoded.split("$");
  if (algorithm !== "scrypt" || !saltHex || !expectedHex || !/^[a-f0-9]{32}$/i.test(saltHex) || !/^[a-f0-9]{128}$/i.test(expectedHex)) {
    return false;
  }
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function createLocalAdminSession(emailInput: string, password: string): Promise<void> {
  const email = normalizeEmail(emailInput);
  if (!email || email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Enter a valid owner email address.");
  }
  if (!password || password.length > 256) throw new Error("Enter your owner password.");

  const db = getMySqlDb();
  const [user] = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
  if (!user || !user.isActive) {
    // Do a password derivation even for unknown accounts to reduce timing-based account enumeration.
    scryptSync(password, Buffer.alloc(16, 0x44), 64);
    throw new Error("Email or password is incorrect.");
  }

  const now = new Date();
  if (user.lockedUntil && user.lockedUntil > now) {
    throw new Error("Sign-in is temporarily locked. Wait 15 minutes or ask another owner to reset access.");
  }

  if (!verifyAdminPassword(password, user.passwordHash)) {
    await db.update(adminUsers).set({
      failedLoginCount: sql`LEAST(${adminUsers.failedLoginCount} + 1, 100)`,
      lockedUntil: sql`CASE WHEN ${adminUsers.failedLoginCount} + 1 >= ${MAX_FAILED_LOGIN_ATTEMPTS} THEN DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL ${LOCKOUT_MINUTES} MINUTE) ELSE ${adminUsers.lockedUntil} END`,
    }).where(eq(adminUsers.id, user.id));
    throw new Error("Email or password is incorrect.");
  }

  const rawToken = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_LIFETIME_SECONDS * 1000);
  await db.transaction(async (tx) => {
    await tx.delete(adminSessions).where(and(
      eq(adminSessions.adminUserId, user.id),
      sql`${adminSessions.expiresAt} <= ${now}`,
    ));
    await tx.insert(adminSessions).values({
      id: randomUUID(),
      adminUserId: user.id,
      tokenHash: tokenDigest(rawToken),
      expiresAt,
      createdAt: now,
    });
    await tx.update(adminUsers).set({
      failedLoginCount: 0,
      lockedUntil: null,
      lastLoginAt: now,
      updatedAt: now,
    }).where(eq(adminUsers.id, user.id));
  });

  const cookieStore = await cookies();
  cookieStore.set(LOCAL_ADMIN_SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_LIFETIME_SECONDS,
  });
}

export async function getCurrentLocalAdmin(): Promise<LocalAdmin | null> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(LOCAL_ADMIN_SESSION_COOKIE)?.value;
  if (!rawToken || rawToken.length > 100) return null;

  const [row] = await getMySqlDb().select({
    id: adminUsers.id,
    email: adminUsers.email,
    displayName: adminUsers.displayName,
    role: adminUsers.role,
  }).from(adminSessions)
    .innerJoin(adminUsers, eq(adminUsers.id, adminSessions.adminUserId))
    .where(and(
      eq(adminSessions.tokenHash, tokenDigest(rawToken)),
      gt(adminSessions.expiresAt, new Date()),
      eq(adminUsers.isActive, true),
    ))
    .limit(1);

  if (!row || (row.role !== "owner" && row.role !== "admin")) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    role: row.role,
  };
}

export async function requireLocalAdmin(): Promise<LocalAdmin> {
  const admin = await getCurrentLocalAdmin();
  if (!admin) throw new Error("Sign in with an active local owner account.");
  return admin;
}

export async function destroyLocalAdminSession(): Promise<void> {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(LOCAL_ADMIN_SESSION_COOKIE)?.value;
  if (rawToken && rawToken.length <= 100) {
    await getMySqlDb().delete(adminSessions).where(eq(adminSessions.tokenHash, tokenDigest(rawToken)));
  }
  cookieStore.delete(LOCAL_ADMIN_SESSION_COOKIE);
}
