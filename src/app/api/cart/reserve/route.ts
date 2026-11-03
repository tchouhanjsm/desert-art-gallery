import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeCartLines } from "@/lib/cart";
import { normalizeVariantId } from "@/lib/variants";
import { isSameOriginRequest } from "@/lib/request-security";
import { isMySqlCustomerAuthEnabled } from "@/server/auth/local-customer";

export const dynamic = "force-dynamic";

type VariantRow = { id: string; status: string };
type ProductRow = { id: string; slug: string; currency: string; product_variants: VariantRow[] | null };

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  if (isMySqlCustomerAuthEnabled()) {
    return NextResponse.json({ error: "MySQL checkout reservations are part of the next commerce phase and are not enabled yet." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim() ?? "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
    return NextResponse.json({ error: "A UUID Idempotency-Key header is required." }, { status: 400 });
  }

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid reservation request." }, { status: 400 }); }
  const payload = body as { lines?: unknown } | null;
  const lines = normalizeCartLines(payload?.lines);
  if (!Array.isArray(payload?.lines) || lines.length < 1 || lines.length > 20 || payload.lines.length !== lines.length) {
    return NextResponse.json({ error: "Choose between one and twenty valid cart lines." }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "The live catalogue is not configured." }, { status: 503 });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in before reserving inventory." }, { status: 401 });

  const { data, error } = await supabase.from("products")
    .select("id,slug,currency,product_variants(id,status)")
    .eq("status", "active")
    .in("slug", lines.map((line) => line.slug));
  if (error) return NextResponse.json({ error: "Unable to validate current catalogue items." }, { status: 502 });
  const products = (data ?? []) as unknown as ProductRow[];
  const bySlug = new Map(products.map((product) => [product.slug, product]));
  const currencies = new Set(lines.map((line) => bySlug.get(line.slug)?.currency).filter((currency): currency is string => typeof currency === "string"));
  if (currencies.size > 1 || [...currencies].some((currency) => !/^[A-Z]{3}$/.test(currency))) {
    return NextResponse.json({ error: "Prepare one currency per checkout. Separate products priced in different currencies into different orders." }, { status: 422, headers: { "Cache-Control": "no-store" } });
  }
  const items: { product_id: string; variant_id: string | null; quantity: number }[] = [];

  for (const line of lines) {
    const product = bySlug.get(line.slug);
    if (!product) return NextResponse.json({ error: "A selected product is no longer available." }, { status: 409 });
    const activeVariants = (product.product_variants ?? []).filter((variant) => variant.status === "active");
    const variantId = line.variantId ? normalizeVariantId(line.variantId) : null;
    if (activeVariants.length > 0 && (!variantId || !activeVariants.some((variant) => variant.id === variantId))) {
      return NextResponse.json({ error: "Choose an active option for every product with variants." }, { status: 422 });
    }
    if (variantId && !activeVariants.some((variant) => variant.id === variantId)) {
      return NextResponse.json({ error: "A selected product option is no longer available." }, { status: 409 });
    }
    items.push({ product_id: product.id, variant_id: variantId, quantity: line.quantity });
  }

  const { data: reservation, error: reservationError } = await supabase.rpc("reserve_inventory", {
    p_items: items,
    p_idempotency_key: idempotencyKey,
    p_ttl_seconds: 900,
  });
  if (reservationError || !reservation) {
    return NextResponse.json({ error: "Inventory could not be reserved. Refresh the bag and try again." }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
  const reservationResult = reservation as { status?: string; replayed?: boolean };
  if (reservationResult.status !== "reserved") {
    return NextResponse.json({ error: "This reservation request has already been released or expired. Start a new reservation with a new idempotency key." }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(reservation, { status: reservationResult.replayed ? 200 : 201, headers: { "Cache-Control": "no-store" } });
}
