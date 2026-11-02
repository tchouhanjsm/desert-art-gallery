import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { isSameOriginRequest } from "@/lib/request-security";
import { hashPassword } from "@/server/auth/password";
import { createUserSession } from "@/server/auth/session";
import { getMySqlDb } from "@/server/db";
import { users } from "@/server/db/schema";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Invalid registration request." }, { status: 400 }); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return NextResponse.json({ error: "Invalid registration request." }, { status: 400 });
  const body = payload as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320 || fullName.length < 2 || fullName.length > 160) {
    return NextResponse.json({ error: "Enter a valid name and email address." }, { status: 400 });
  }
  if (password.length < 12 || password.length > 128) {
    return NextResponse.json({ error: "Use a password between 12 and 128 characters." }, { status: 400 });
  }
  const [existing] = await getMySqlDb().select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing) return NextResponse.json({ error: "An account already exists for this email address." }, { status: 409 });
  const now = new Date();
  const userId = randomUUID();
  await getMySqlDb().insert(users).values({
    id: userId, email, fullName, passwordHash: await hashPassword(password),
    role: "customer", status: "active", emailVerifiedAt: now, createdAt: now, updatedAt: now,
  });
  await createUserSession(userId);
  return NextResponse.json({ authenticated: true }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
