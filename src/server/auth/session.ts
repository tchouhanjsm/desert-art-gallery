import "server-only";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getMySqlDb } from "@/server/db";
import { userSessions, users } from "@/server/db/schema";

const COOKIE_NAME = "desert_gallery_session";
const SESSION_DAYS = 30;

export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  role: "customer" | "staff" | "admin" | "owner";
  emailVerifiedAt: Date | null;
};

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createUserSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await getMySqlDb().insert(userSessions).values({
    id: randomUUID(),
    userId,
    tokenHash: tokenHash(token),
    expiresAt,
    createdAt: new Date(),
  });
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token || token.length > 128) return null;

  const [row] = await getMySqlDb().select({
    id: users.id,
    email: users.email,
    fullName: users.fullName,
    phone: users.phone,
    role: users.role,
    emailVerifiedAt: users.emailVerifiedAt,
  }).from(userSessions)
    .innerJoin(users, eq(users.id, userSessions.userId))
    .where(and(
      eq(userSessions.tokenHash, tokenHash(token)),
      gt(userSessions.expiresAt, new Date()),
      eq(users.status, "active"),
    )).limit(1);

  if (!row || !["customer", "staff", "admin", "owner"].includes(row.role)) return null;
  return { ...row, role: row.role as AuthUser["role"] };
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user || !["admin", "owner"].includes(user.role)) {
    throw new Error("Administrator permissions are required.");
  }
  return user;
}

export async function requireOwner(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user || user.role !== "owner") throw new Error("Owner permissions are required.");
  return user;
}

export async function requireAdminPage(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=%2Fadmin");
  if (!["admin", "owner"].includes(user.role)) redirect("/account");
  return user;
}

export async function signOutSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    await getMySqlDb().delete(userSessions).where(eq(userSessions.tokenHash, tokenHash(token)));
  }
  store.delete(COOKIE_NAME);
}

export async function revokeAllUserSessions(userId: string): Promise<void> {
  await getMySqlDb().delete(userSessions).where(eq(userSessions.userId, userId));
}
