import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeCartLines } from "@/lib/cart";
import { capPurchasableQuantity } from "@/lib/variants";
import { isMySqlCatalogueEnabled } from "@/server/db";
import { getMySqlCartPreview } from "@/server/customer/shopping";

export const dynamic = "force-dynamic";

type ProductImage = {
  storage_path: string;
  alt_text: string | null;
  sort_order: number | null;
  is_primary: boolean;
  rights_confirmed: boolean;
};
type ProductVariantRow = {
  id: string;
  label: string;
  price_override_minor: number | string | null;
  quantity_on_hand: number;
  status: string;
};
type ProductRow = {
  id: string;
  slug: string;
  title: string;
  currency: string;
  price_minor: number | string | null;
  quantity_on_hand: number;
  is_one_of_a_kind: boolean;
  product_images: ProductImage[] | null;
  product_variants: ProductVariantRow[] | null;
};

function safeMinor(value: number | string | null): number | null {
  if (value === null) return null;
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(amount) && amount >= 0 ? amount : null;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid cart request." }, { status: 400 }); }
  const payload = body as { lines?: unknown } | null;
  const lines = normalizeCartLines(payload?.lines);
  if (!lines.length) return NextResponse.json({ items: [] }, { headers: { "Cache-Control": "no-store" } });
  if (isMySqlCatalogueEnabled()) {
    try {
      const items = await getMySqlCartPreview(lines);
      return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return NextResponse.json({ error: "Unable to refresh the MySQL catalogue bag." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "The live catalogue is not configured." }, { status: 503 });

  const { data, error } = await supabase.from("products")
    .select("id,slug,title,currency,price_minor,quantity_on_hand,is_one_of_a_kind,product_images(storage_path,alt_text,sort_order,is_primary,rights_confirmed),product_variants(id,label,price_override_minor,quantity_on_hand,status)")
    .eq("status", "active")
    .in("slug", lines.map((line) => line.slug));

  if (error) return NextResponse.json({ error: "Unable to refresh current product details." }, { status: 502 });
  const products = (data ?? []) as unknown as ProductRow[];
  const bySlug = new Map(products.map((product) => [product.slug, product]));

  const items = await Promise.all(lines.map(async (line) => {
    const product = bySlug.get(line.slug);
    if (!product) return {
      slug: line.slug, variantId: line.variantId ?? null, variantLabel: null,
      name: "This piece is no longer available", quantityRequested: line.quantity,
      availableQuantity: 0, available: false, priceMinor: null, currency: null, image: null, imageAlt: "",
    };

    const activeVariants = (product.product_variants ?? []).filter((variant) => variant.status === "active");
    const selectedVariant = line.variantId
      ? activeVariants.find((variant) => variant.id === line.variantId) ?? null
      : null;
    const invalidSelection = activeVariants.length > 0
      ? !selectedVariant
      : Boolean(line.variantId);
    const rawPrice = selectedVariant
      ? selectedVariant.price_override_minor ?? product.price_minor
      : activeVariants.length === 0 && !line.variantId ? product.price_minor : null;
    const priceMinor = safeMinor(rawPrice);
    const rawQuantity = selectedVariant
      ? selectedVariant.quantity_on_hand
      : activeVariants.length === 0 && !line.variantId ? product.quantity_on_hand : 0;
    const availableQuantity = capPurchasableQuantity(rawQuantity ?? 0, product.is_one_of_a_kind);
    const approvedImages = (product.product_images ?? [])
      .filter((image) => image.rights_confirmed && image.storage_path && image.alt_text?.trim())
      .sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || (a.sort_order ?? 0) - (b.sort_order ?? 0));
    const primary = approvedImages[0];
    let image: string | null = null;
    if (primary) {
      const { data: signed } = await supabase.storage.from("product-media").createSignedUrl(primary.storage_path, 900);
      image = signed?.signedUrl ?? null;
    }
    return {
      slug: product.slug,
      variantId: line.variantId ?? null,
      variantLabel: selectedVariant?.label ?? (invalidSelection ? "Select an option on the product page" : null),
      name: product.title,
      quantityRequested: line.quantity,
      availableQuantity,
      available: !invalidSelection && availableQuantity >= line.quantity && priceMinor !== null,
      priceMinor,
      currency: priceMinor === null ? null : product.currency,
      image,
      imageAlt: primary?.alt_text?.trim() ?? "",
    };
  }));

  return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
}
