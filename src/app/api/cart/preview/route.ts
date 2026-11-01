import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeCartLines } from "@/lib/cart";

export const dynamic = "force-dynamic";

type ProductImage = { storage_path: string; alt_text: string; sort_order: number; rights_confirmed: boolean };
type ProductRow = {
  id: string;
  slug: string;
  title: string;
  currency: string;
  price_minor: number | string | null;
  quantity_on_hand: number;
  product_images: ProductImage[] | null;
};

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid cart request." }, { status: 400 }); }
  const payload = body as { lines?: unknown } | null;
  const lines = normalizeCartLines(payload?.lines);
  if (!lines.length) return NextResponse.json({ items: [] });

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "The live catalogue is not configured." }, { status: 503 });

  const { data, error } = await supabase.from("products")
    .select("id,slug,title,currency,price_minor,quantity_on_hand,product_images(storage_path,alt_text,sort_order,rights_confirmed)")
    .eq("status", "active")
    .in("slug", lines.map((line) => line.slug));

  if (error) return NextResponse.json({ error: "Unable to refresh current product details." }, { status: 502 });
  const products = (data ?? []) as unknown as ProductRow[];
  const bySlug = new Map(products.map((product) => [product.slug, product]));

  const items = await Promise.all(lines.map(async (line) => {
    const product = bySlug.get(line.slug);
    if (!product) return {
      slug: line.slug, name: "This piece is no longer available", quantityRequested: line.quantity,
      availableQuantity: 0, available: false, priceMinor: null, currency: null, image: null, imageAlt: "",
    };

    const priceMinor = product.price_minor === null ? null : Number(product.price_minor);
    const safePrice = priceMinor !== null && Number.isSafeInteger(priceMinor) && priceMinor >= 0 ? priceMinor : null;
    const approvedImages = (product.product_images ?? [])
      .filter((image) => image.rights_confirmed)
      .sort((a, b) => a.sort_order - b.sort_order);
    const primary = approvedImages[0];
    let image: string | null = null;
    if (primary) {
      const { data: signed } = await supabase.storage.from("product-media").createSignedUrl(primary.storage_path, 900);
      image = signed?.signedUrl ?? null;
    }
    const availableQuantity = Math.max(0, product.quantity_on_hand ?? 0);
    return {
      slug: product.slug, name: product.title, quantityRequested: line.quantity,
      availableQuantity, available: availableQuantity >= line.quantity && safePrice !== null,
      priceMinor: safePrice, currency: product.currency, image, imageAlt: primary?.alt_text ?? "",
    };
  }));

  return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
}
