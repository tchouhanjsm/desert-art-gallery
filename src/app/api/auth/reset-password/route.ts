import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { isSameOriginRequest } from "@/lib/request-security";
import { hashPassword } from "@/server/auth/password";
import { getMySqlDb } from "@/server/db";
import { passwordResetTokens, userSessions, users } from "@/server/db/schema";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid password reset request." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid password reset request." }, { status: 400 });
  const input = body as Record<string, unknown>;
  const token = typeof input.token === "string" ? input.token : "";
  const password = typeof input.password === "string" ? input.password : "";
  if (token.length < 32 || token.length > 128 || password.length < 12 || password.length > 128) {
    return NextResponse.json({ error: "The recovery link is invalid or expired." }, { status: 400 });
  }
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const [row] = await getMySqlDb().select({
    tokenId: passwordResetTokens.id,
    userId: passwordResetTokens.userId,
  }).from(passwordResetTokens)
    .where(and(eq(passwordResetTokens.tokenHash, tokenHash), gt(passwordResetTokens.expiresAt, new Date()), isNull(passwordResetTokens.consumedAt)))
    .limit(1);
  if (!row) return NextResponse.json({ error: "The recovery link is invalid or expired." }, { status: 400 });
  const db = getMySqlDb();
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash: await hashPassword(password), updatedAt: new Date() }).where(eq(users.id, row.userId));
    await tx.update(passwordResetTokens).set({ consumedAt: new Date() }).where(eq(passwordResetTokens.id, row.tokenId));
    await tx.delete(userSessions).where(eq(userSessions.userId, row.userId));
  });
  return NextResponse.json({ updated: true }, { headers: { "Cache-Control": "no-store" } });
}
