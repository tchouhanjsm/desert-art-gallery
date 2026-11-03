import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSameOriginRequest } from "@/lib/request-security";
import { isCheckoutUuid, normalizeCheckoutAddress } from "@/lib/checkout";
import { getCurrentCustomer, isMySqlCustomerAuthEnabled } from "@/server/auth/local-customer";
import { createMySqlOrderDraft } from "@/server/checkout/mysql-orders";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 16_384) {
    return NextResponse.json({ error: "Checkout details are too large." }, { status: 413 });
  }

  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
  }
  const body = payload as Record<string, unknown>;
  const reservationId = body.reservationId;
  const shippingRateId = body.shippingRateId;
  const idempotencyKey = body.idempotencyKey;
  const shippingAddress = normalizeCheckoutAddress(body.shippingAddress);
  const customerNote = body.customerNote == null ? null : body.customerNote;
  if (!isCheckoutUuid(reservationId) || !isCheckoutUuid(shippingRateId) || !isCheckoutUuid(idempotencyKey) || !shippingAddress) {
    return NextResponse.json({ error: "A valid reservation, shipping option, idempotency key and delivery address are required." }, { status: 400 });
  }
  if (customerNote !== null && (typeof customerNote !== "string" || customerNote.trim().length > 1000)) {
    return NextResponse.json({ error: "The delivery note must be 1,000 characters or fewer." }, { status: 400 });
  }

  if (isMySqlCustomerAuthEnabled()) {
    const customer = await getCurrentCustomer();
    if (!customer) return NextResponse.json({ error: "Sign in before preparing an order." }, { status: 401, headers: { "Cache-Control": "no-store" } });
    try {
      const draft = await createMySqlOrderDraft({
        customerUserId: customer.id,
        reservationId,
        shippingRateId,
        shippingAddress,
        customerNote: typeof customerNote === "string" ? customerNote.trim() : null,
        idempotencyKey: idempotencyKey.toLowerCase(),
      });
      if (draft.status !== "draft") {
        return NextResponse.json({ error: "This unpaid order draft has expired. Return to your bag and prepare a new checkout." }, { status: 409, headers: { "Cache-Control": "no-store" } });
      }
      return NextResponse.json({
        order_id: draft.orderId,
        order_number: draft.orderNumber,
        status: draft.status,
        currency: draft.currency,
        subtotal_minor: draft.subtotalMinor,
        shipping_minor: draft.shippingMinor,
        tax_minor: draft.taxMinor,
        total_minor: draft.totalMinor,
        expires_at: draft.expiresAt.toISOString(),
        replayed: draft.replayed,
      }, { status: draft.replayed ? 200 : 201, headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      return NextResponse.json({
        error: error instanceof Error ? error.message : "The order draft could not be prepared.",
      }, { status: 409, headers: { "Cache-Control": "no-store" } });
    }
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "Checkout is not configured." }, { status: 503 });
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in before preparing an order." }, { status: 401 });

  const { data, error } = await supabase.rpc("create_order_from_reservation", {
    p_reservation_id: reservationId,
    p_shipping_rate_id: shippingRateId,
    p_shipping_address: shippingAddress,
    p_customer_note: typeof customerNote === "string" ? customerNote.trim() : null,
    p_idempotency_key: idempotencyKey.toLowerCase(),
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) {
    return NextResponse.json({
      error: "The order draft could not be prepared. Check the delivery destination and configured shipping and tax rules, then refresh your bag.",
    }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
  const result = data as Record<string, unknown>;
  if (!isCheckoutUuid(result.order_id)) {
    return NextResponse.json({ error: "The checkout service returned an invalid order response." }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
  if (result.status !== "draft") {
    return NextResponse.json({ error: "This reservation no longer has an active unpaid draft. Refresh your bag to request a new reservation." }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json(result, {
    status: result.replayed === true ? 200 : 201,
    headers: { "Cache-Control": "no-store" },
  });
}
