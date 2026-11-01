import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeWishlistSlugs } from "@/lib/wishlist";

type ExistingWishlistRow = { product_id: string; products: { slug: string } | null };
type ProductRow = { id: string; slug: string };

export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid wishlist request." }, { status: 400 }); }
  const payload = body as { slugs?: unknown } | null;
  const localSlugs = normalizeWishlistSlugs(payload?.slugs);
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ authenticated: false, slugs: localSlugs });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ authenticated: false, slugs: localSlugs });

  const { data: existingData, error: existingError } = await supabase.from("wishlist_items")
    .select("product_id,products(slug)").eq("user_id", user.id);
  if (existingError) return NextResponse.json({ error: "Unable to load your saved pieces." }, { status: 502 });
  const existing = (existingData ?? []) as unknown as ExistingWishlistRow[];
  const slugs = Array.from(new Set([...localSlugs, ...existing.flatMap((row) => row.products ? [row.products.slug] : [])]));
  if (!slugs.length) return NextResponse.json({ authenticated: true, slugs: [] });

  const { data: productData, error: productError } = await supabase.from("products")
    .select("id,slug").eq("status", "active").in("slug", slugs);
  if (productError) return NextResponse.json({ error: "Unable to refresh saved pieces." }, { status: 502 });
  const products = (productData ?? []) as unknown as ProductRow[];
  const validIds = new Set(products.map((product) => product.id));
  const staleIds = existing.filter((row) => !validIds.has(row.product_id)).map((row) => row.product_id);
  if (staleIds.length) {
    const { error } = await supabase.from("wishlist_items").delete().eq("user_id", user.id).in("product_id", staleIds);
    if (error) return NextResponse.json({ error: "Unable to remove unavailable saved pieces." }, { status: 502 });
  }
  const rows = products.map((product) => ({ user_id: user.id, product_id: product.id }));
  if (rows.length) {
    const { error } = await supabase.from("wishlist_items").upsert(rows, { onConflict: "user_id,product_id", ignoreDuplicates: true });
    if (error) return NextResponse.json({ error: "Unable to save your wishlist to your account." }, { status: 502 });
  }
  return NextResponse.json({ authenticated: true, slugs: products.map((product) => product.slug) }, { headers: { "Cache-Control": "no-store" } });
}
