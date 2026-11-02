import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { cartLineKey, combineCartLines, normalizeCartLines, shouldMergeSavedCart } from "@/lib/cart";
import { normalizeVariantId } from "@/lib/variants";
import { isSameOriginRequest } from "@/lib/request-security";

type ExistingCartRow = {
  id: string;
  product_id: string;
  quantity: number;
  selected_options: Record<string, unknown> | null;
  products: { slug: string } | null;
};
type ProductVariantRow = { id: string; status: string; quantity_on_hand: number };
type ProductRow = {
  id: string;
  slug: string;
  quantity_on_hand: number;
  is_one_of_a_kind: boolean;
  product_variants: ProductVariantRow[] | null;
};

function rowVariantId(row: ExistingCartRow): string | undefined {
  const value = row.selected_options?.variant_id;
  return normalizeVariantId(value) ?? undefined;
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid cart request." }, { status: 400 }); }
  const payload = body as { lines?: unknown; syncedUserId?: unknown } | null;
  const guestLines = normalizeCartLines(payload?.lines);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ authenticated: false, lines: guestLines });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ authenticated: false, lines: guestLines });

  const { data: existingData, error: existingError } = await supabase.from("cart_items")
    .select("id,product_id,quantity,selected_options,products(slug)")
    .eq("user_id", user.id);
  if (existingError) return NextResponse.json({ error: "Unable to load your saved bag." }, { status: 502 });
  const existing = (existingData ?? []) as unknown as ExistingCartRow[];
  const mergeSaved = shouldMergeSavedCart(payload?.syncedUserId, user.id);
  const allSlugs = Array.from(new Set([
    ...guestLines.map((line) => line.slug),
    ...existing.flatMap((row) => row.products ? [row.products.slug] : []),
  ]));

  if (!allSlugs.length) return NextResponse.json({ authenticated: true, userId: user.id, lines: [] });

  const { data: productData, error: productError } = await supabase.from("products")
    .select("id,slug,quantity_on_hand,is_one_of_a_kind,product_variants(id,status,quantity_on_hand)")
    .eq("status", "active")
    .in("slug", allSlugs);
  if (productError) return NextResponse.json({ error: "Unable to refresh saved bag items." }, { status: 502 });
  const products = (productData ?? []) as unknown as ProductRow[];
  const productsBySlug = new Map(products.map((product) => [product.slug, product]));
  const requests = new Map<string, { slug: string; variantId?: string; quantity: number }>();

  const addRequest = (slug: string, quantity: number, variantId?: string) => {
    const key = cartLineKey(slug, variantId);
    const current = requests.get(key);
    requests.set(key, { slug, ...(variantId ? { variantId } : {}), quantity: Math.min(99, (current?.quantity ?? 0) + quantity) });
  };
  const savedLines = existing.flatMap((row) => row.products?.slug
    ? [{ slug: row.products.slug, ...(rowVariantId(row) ? { variantId: rowVariantId(row) } : {}), quantity: row.quantity }]
    : []);
  const requestedLines = combineCartLines(savedLines, guestLines, mergeSaved);
  for (const line of requestedLines) addRequest(line.slug, line.quantity, line.variantId);

  const upsertRows: {
    user_id: string;
    product_id: string;
    quantity: number;
    selected_options: Record<string, string>;
  }[] = [];
  for (const requestLine of Array.from(requests.values()).slice(0, 30)) {
    const product = productsBySlug.get(requestLine.slug);
    if (!product) continue;
    const activeVariants = (product.product_variants ?? []).filter((variant) => variant.status === "active");
    const selectedVariant = requestLine.variantId
      ? activeVariants.find((variant) => variant.id === requestLine.variantId)
      : undefined;
    if (activeVariants.length > 0 && !selectedVariant) continue;
    if (requestLine.variantId && !selectedVariant) continue;
    const rawQuantity = selectedVariant?.quantity_on_hand ?? (activeVariants.length === 0 ? product.quantity_on_hand : 0);
    const maximum = Math.max(0, product.is_one_of_a_kind ? Math.min(1, rawQuantity ?? 0) : Math.min(99, rawQuantity ?? 0));
    const quantity = Math.min(requestLine.quantity, maximum);
    if (quantity < 1) continue;
    upsertRows.push({
      user_id: user.id,
      product_id: product.id,
      quantity,
      selected_options: requestLine.variantId ? { variant_id: requestLine.variantId } : {},
    });
  }

  const validKeys = new Set(upsertRows.map((row) => {
    const product = products.find((item) => item.id === row.product_id);
    const variantId = normalizeVariantId(row.selected_options.variant_id) ?? undefined;
    return product ? cartLineKey(product.slug, variantId) : "";
  }));
  const staleIds = existing.filter((row) => {
    const slug = row.products?.slug;
    return !slug || !validKeys.has(cartLineKey(slug, rowVariantId(row)));
  }).map((row) => row.id);
  if (staleIds.length) {
    const { error } = await supabase.from("cart_items").delete().eq("user_id", user.id).in("id", staleIds);
    if (error) return NextResponse.json({ error: "Unable to remove unavailable saved bag items." }, { status: 502 });
  }
  if (upsertRows.length) {
    const { error } = await supabase.from("cart_items").upsert(upsertRows, { onConflict: "user_id,product_id,selected_options" });
    if (error) return NextResponse.json({ error: "Unable to save your bag to your account." }, { status: 502 });
  }

  const mergedLines = upsertRows.flatMap((row) => {
    const product = products.find((item) => item.id === row.product_id);
    if (!product) return [];
    const variantId = normalizeVariantId(row.selected_options.variant_id);
    return [{ slug: product.slug, ...(variantId ? { variantId } : {}), quantity: row.quantity }];
  });
  return NextResponse.json({ authenticated: true, userId: user.id, lines: mergedLines }, { headers: { "Cache-Control": "no-store" } });
}
