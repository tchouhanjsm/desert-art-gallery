import { NextResponse, type NextRequest } from "next/server";
import { isSameOriginRequest } from "@/lib/request-security";
import { isCheckoutUuid } from "@/lib/checkout";
import { getCurrentCustomer, isMySqlCustomerAuthEnabled } from "@/server/auth/local-customer";
import { verifyMySqlRazorpayPayment } from "@/server/payments/mysql-payments";
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
    return NextResponse.json({ error: "Sign in before confirming payment." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  if (!isRazorpaySandboxConfigured()) {
    return NextResponse.json({ error: "Sandbox payment processing is not enabled on this environment." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 16_384) {
    return NextResponse.json({ error: "Payment confirmation is too large." }, { status: 413 });
  }
  let payload: unknown;
  try { payload = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid payment confirmation." }, { status: 400 });
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return NextResponse.json({ error: "Invalid payment confirmation." }, { status: 400 });
  }
  const body = payload as Record<string, unknown>;
  if (!isCheckoutUuid(body.orderId)
    || typeof body.razorpay_order_id !== "string"
    || typeof body.razorpay_payment_id !== "string"
    || typeof body.razorpay_signature !== "string"
    || body.razorpay_signature.length > 256) {
    return NextResponse.json({ error: "The provider payment details are incomplete." }, { status: 400 });
  }

  try {
    const result = await verifyMySqlRazorpayPayment({
      customerUserId: customer.id,
      orderId: body.orderId,
      providerOrderId: body.razorpay_order_id,
      providerPaymentId: body.razorpay_payment_id,
      signature: body.razorpay_signature,
    });
    return NextResponse.json(result, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "The payment could not be verified.",
    }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
}
