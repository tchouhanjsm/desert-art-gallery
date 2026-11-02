import { createHash, randomBytes, randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { isSameOriginRequest } from "@/lib/request-security";
import { getMySqlDb } from "@/server/db";
import { passwordResetTokens, users } from "@/server/db/schema";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ message: "When the account exists, a recovery link will be provided." }); }
  const email = body && typeof body === "object" && !Array.isArray(body) && typeof (body as Record<string, unknown>).email === "string"
    ? ((body as Record<string, string>).email.trim().toLowerCase()) : "";
  const [user] = email ? await getMySqlDb().select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1) : [];
  if (user) {
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await getMySqlDb().insert(passwordResetTokens).values({
      id: randomUUID(), userId: user.id,
      tokenHash: createHash("sha256").update(token).digest("hex"),
      expiresAt, createdAt: new Date(),
    });
    const origin = process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin;
    const url = origin + "/account/recovery?token=" + encodeURIComponent(token);
    if (process.env.RESEND_API_KEY && process.env.ORDER_EMAIL_FROM) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ from: process.env.ORDER_EMAIL_FROM, to: [email], subject: "Reset your Desert Art Gallery password", html: '<p>Use this secure link to choose a new password:</p><p><a href="' + url + '">Reset password</a></p><p>This link expires in 30 minutes.</p>' }),
      }).catch(() => undefined);
    } else if (process.env.NODE_ENV !== "production") {
      console.info("Local password recovery link:", url);
    }
  }
  return NextResponse.json({ message: "When the account exists, a recovery link will be provided." }, { headers: { "Cache-Control": "no-store" } });
}
