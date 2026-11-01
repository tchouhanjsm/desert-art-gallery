import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeCartLines } from "@/lib/cart";

type ExistingCartRow = { id: string; product_id: string; quantity: number; products: { slug: string } | null };
type ProductRow = { id: string; slug: string; quantity_on_hand: number; is_one_of_a_kind: boolean };

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid cart request." }, { status: 400 }); }
  const payload = body as { lines?: unknown } | null;
  const guestLines = normalizeCartLines(payload?.lines);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ authenticated: false, lines: guestLines });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ authenticated: false, lines: guestLines });

  const { data: existingData, error: existingError } = await supabase.from("cart_items")
    .select("id,product_id,quantity,products(slug)")
    .eq("user_id", user.id);
  if (existingError) return NextResponse.json({ error: "Unable to load your saved bag." }, { status: 502 });
  const existing = (existingData ?? []) as unknown as ExistingCartRow[];
  const allSlugs = Array.from(new Set([...guestLines.map((line) => line.slug), ...existing.flatMap((row) => row.products ? [row.products.slug] : [])]));

  if (!allSlugs.length) {
    return NextResponse.json({ authenticated: true, lines: [] });
  }

  const { data: productData, error: productError } = await supabase.from("products")
    .select("id,slug,quantity_on_hand,is_one_of_a_kind")
    .eq("status", "active").in("slug", allSlugs);
  if (productError) return NextResponse.json({ error: "Unable to refresh saved bag items." }, { status: 502 });
  const products = (productData ?? []) as unknown as ProductRow[];
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  const guestQuantity = new Map(guestLines.map((line) => [line.slug, line.quantity]));
  const existingQuantity = new Map<string, number>();
  for (const row of existing) existingQuantity.set(row.product_id, (existingQuantity.get(row.product_id) ?? 0) + row.quantity);

  const upsertRows = products.flatMap((product) => {
    const available = Math.max(0, product.quantity_on_hand ?? 0);
    const requested = (existingQuantity.get(product.id) ?? 0) + (guestQuantity.get(product.slug) ?? 0);
    const maximum = product.is_one_of_a_kind ? 1 : Math.min(99, available);
    const quantity = Math.min(requested, maximum);
    return quantity > 0 ? [{ user_id: user.id, product_id: product.id, quantity, selected_options: {} }] : [];
  });

  const validProductIds = new Set(upsertRows.map((row) => row.product_id));
  const staleIds = existing.filter((row) => !validProductIds.has(row.product_id)).map((row) => row.id);
  if (staleIds.length) {
    const { error } = await supabase.from("cart_items").delete().eq("user_id", user.id).in("id", staleIds);
    if (error) return NextResponse.json({ error: "Unable to remove unavailable saved bag items." }, { status: 502 });
  }
  if (upsertRows.length) {
    const { error } = await supabase.from("cart_items").upsert(upsertRows, { onConflict: "user_id,product_id,selected_options" });
    if (error) return NextResponse.json({ error: "Unable to save your bag to your account." }, { status: 502 });
  }

  const mergedLines = products.flatMap((product) => {
    const row = upsertRows.find((item) => item.product_id === product.id);
    return row ? [{ slug: product.slug, quantity: row.quantity }] : [];
  });
  return NextResponse.json({ authenticated: true, lines: mergedLines }, { headers: { "Cache-Control": "no-store" } });
}
