import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/request-security";
import { isCheckoutUuid } from "@/lib/checkout";
import { getCurrentCustomer, isMySqlCustomerAuthEnabled } from "@/server/auth/local-customer";
import { createMySqlRazorpayPaymentSession } from "@/server/payments/mysql-payments";
import { isRazorpaySandboxConfigured } from "@/server/payments/razorpay";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Cross-origin request rejected." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  if (!isMySqlCustomerAuthEnabled()) {
    return NextResponse.json({ error: "MySQL customer checkout is not enabled." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const customer = await getCurrentCustomer();
  if (!customer) {
    return NextResponse.json({ error: "Sign in before starting payment." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (!isRazorpaySandboxConfigured()) {
    return NextResponse.json({ error: "Sandbox payment processing is not enabled on this environment." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 16_384) {
    return NextResponse.json({ error: "Payment request is too large." }, { status: 413 });
  }
  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid payment request." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Invalid payment request." }, { status: 400 });
  }
  const body = payload as Record<string, unknown>;
  const orderId = body.orderId;
  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim() ?? "";
  if (!isCheckoutUuid(orderId) || !isCheckoutUuid(idempotencyKey)) {
    return NextResponse.json({ error: "A valid order and UUID Idempotency-Key are required." }, { status: 400 });
  }

  try {
    const session = await createMySqlRazorpayPaymentSession({
      customerUserId: customer.id,
      orderId,
      idempotencyKey: idempotencyKey.toLowerCase(),
    });
    return NextResponse.json({
      order_id: session.orderId,
      order_number: session.orderNumber,
      razorpay_order_id: session.providerOrderId,
      key_id: session.keyId,
      amount: session.amountMinor,
      currency: session.currency,
      replayed: session.replayed,
    }, { status: session.replayed ? 200 : 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "The payment session could not be created.",
    }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
}
