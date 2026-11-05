import { NextResponse, type NextRequest } from "next/server";
import { processRazorpayWebhook } from "@/server/payments/mysql-payments";
import { isRazorpaySandboxConfigured } from "@/server/payments/razorpay";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!isRazorpaySandboxConfigured()) {
    return NextResponse.json({ error: "Sandbox payment webhooks are not enabled." }, { status: 503 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > 65_536) {
    return NextResponse.json({ error: "Webhook body is too large." }, { status: 413 });
  }

  // Signature verification must use the exact raw body; do not parse or reserialize first.
  const rawBody = await request.text();
  if (rawBody.length > 65_536) return NextResponse.json({ error: "Webhook body is too large." }, { status: 413 });
  const signature = request.headers.get("x-razorpay-signature") ?? "";
  const eventId = request.headers.get("x-razorpay-event-id") ?? "";
  const eventType = request.headers.get("x-razorpay-event") ?? "";

  try {
    const result = await processRazorpayWebhook({ eventId, eventType, rawBody, signature });
    return NextResponse.json(result, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch {
    // Do not echo provider payloads, signatures, or secrets into logs or responses.
    return NextResponse.json({ error: "The payment webhook could not be verified or processed." }, { status: 400 });
  }
}
