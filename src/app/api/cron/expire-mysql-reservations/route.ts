import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { isMySqlCatalogueEnabled } from "@/server/db";
import { expireVariantStockReservations } from "@/server/catalogue/inventory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function hasValidBearerSecret(request: NextRequest): boolean {
  const expected = process.env.INVENTORY_EXPIRY_CRON_SECRET?.trim() ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  if (expected.length < 32 || !authorization.startsWith("Bearer ")) return false;
  const suppliedBytes = Buffer.from(authorization.slice(7));
  const expectedBytes = Buffer.from(expected);
  return suppliedBytes.length === expectedBytes.length && timingSafeEqual(suppliedBytes, expectedBytes);
}

export async function POST(request: NextRequest) {
  if (!hasValidBearerSecret(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (!isMySqlCatalogueEnabled()) {
    return NextResponse.json({ error: "MySQL catalogue mode is not enabled." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  try {
    const expired = await expireVariantStockReservations(250);
    return NextResponse.json({ ok: true, expired }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Reservation expiry could not be completed." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
