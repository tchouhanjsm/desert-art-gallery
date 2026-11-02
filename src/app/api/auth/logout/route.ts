import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/request-security";
import { signOutSession } from "@/server/auth/session";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403 });
  await signOutSession();
  return NextResponse.json({ authenticated: false }, { headers: { "Cache-Control": "no-store" } });
}
