import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentLocalAdmin } from "@/server/auth/local-admin";
import { getMySqlDb, isMySqlCatalogueEnabled } from "@/server/db";
import { productMedia } from "@/server/db/schema";
import { readProductMedia, safeProductStorageKey } from "@/server/media/product-storage";

export const dynamic = "force-dynamic";

function emptyResponse(status: number) {
  return new NextResponse(null, {
    status,
    headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string[] }> },
) {
  if (!isMySqlCatalogueEnabled()) return emptyResponse(404);

  let key: string;
  try {
    const resolved = await params;
    key = safeProductStorageKey((resolved.key ?? []).join("/"));
  } catch {
    return emptyResponse(404);
  }

  try {
    const admin = await getCurrentLocalAdmin();
    if (!admin) return emptyResponse(401);

    const [row] = await getMySqlDb().select({ id: productMedia.id })
      .from(productMedia)
      .where(eq(productMedia.storageKey, key))
      .limit(1);
    if (!row) return emptyResponse(404);

    const asset = await readProductMedia(key);
    if (!asset) return emptyResponse(404);

    return new NextResponse(new Uint8Array(asset.bytes), {
      status: 200,
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Length": String(asset.bytes.byteLength),
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cross-Origin-Resource-Policy": "same-origin",
      },
    });
  } catch {
    return emptyResponse(503);
  }
}
