import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { isSameOriginRequest } from "@/lib/request-security";
import { verifyPassword } from "@/server/auth/password";
import { createUserSession } from "@/server/auth/session";
import { getMySqlDb } from "@/server/db";
import { users } from "@/server/db/schema";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  let payload: unknown;
  try { payload = await request.json(); } catch { return NextResponse.json({ error: "Invalid sign-in request." }, { status: 400 }); }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return NextResponse.json({ error: "Invalid sign-in request." }, { status: 400 });
  const body = payload as Record<string, unknown>;
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length > 128) {
    return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  }
  const [user] = await getMySqlDb().select().from(users).where(eq(users.email, email)).limit(1);
  const valid = user?.status === "active" ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !valid) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  await createUserSession(user.id);
  return NextResponse.json({ authenticated: true }, { headers: { "Cache-Control": "no-store" } });
}
