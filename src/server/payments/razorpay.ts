import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const API_BASE = "https://api.razorpay.com/v1";
const PAYMENT_ID_PATTERN = /^pay_[A-Za-z0-9]+$/;
const ORDER_ID_PATTERN = /^order_[A-Za-z0-9]+$/;
const REFUND_ID_PATTERN = /^rfnd_[A-Za-z0-9]+$/;

export class PaymentConfigurationError extends Error {
  constructor(message = "Sandbox payment processing is not configured.") {
    super(message);
    this.name = "PaymentConfigurationError";
  }
}

export class RazorpayApiError extends Error {
  readonly status: number;
  readonly providerCode: string | null;

  constructor(status: number, providerCode: string | null) {
    super("The payment provider request could not be completed.");
    this.name = "RazorpayApiError";
    this.status = status;
    this.providerCode = providerCode;
  }
}

export type RazorpayPayment = {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  captured: boolean;
  amount_refunded: number;
};

export type RazorpayOrder = {
  id: string;
  amount: number;
  currency: string;
  receipt: string | null;
  status: string;
};

export type RazorpayRefund = {
  id: string;
  payment_id: string;
  amount: number;
  currency: string;
  status: "pending" | "processed" | "failed";
};

export type RazorpayConfiguration = {
  keyId: string;
  keySecret: string;
  webhookSecret: string;
};

export function getRazorpaySandboxConfiguration(): RazorpayConfiguration {
  const enabled = process.env.PAYMENTS_ENABLED?.trim().toLowerCase() === "true";
  const provider = process.env.PAYMENT_PROVIDER?.trim().toLowerCase();
  const mode = process.env.PAYMENT_MODE?.trim().toLowerCase();
  const keyId = process.env.RAZORPAY_KEY_ID?.trim() ?? "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET ?? "";
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";

  if (!enabled || provider !== "razorpay" || mode !== "test") {
    throw new PaymentConfigurationError();
  }
  if (!/^rzp_test_[A-Za-z0-9]+$/.test(keyId) || keySecret.length < 8 || webhookSecret.length < 8) {
    throw new PaymentConfigurationError("Complete Razorpay test-mode credentials and webhook secret are required.");
  }

  return { keyId, keySecret, webhookSecret };
}

export function isRazorpaySandboxConfigured(): boolean {
  try {
    getRazorpaySandboxConfiguration();
    return true;
  } catch {
    return false;
  }
}

function safeHexDigest(value: string): Buffer | null {
  if (!/^[a-f0-9]{64}$/i.test(value)) return null;
  return Buffer.from(value, "hex");
}

function verifyHmacSha256(message: string, signature: string, secret: string): boolean {
  if (!secret || !signature) return false;
  const supplied = safeHexDigest(signature);
  if (!supplied) return false;
  const expected = createHmac("sha256", secret).update(message, "utf8").digest();
  return supplied.length === expected.length && timingSafeEqual(expected, supplied);
}

export function verifyRazorpayCheckoutSignature(input: {
  providerOrderId: string;
  providerPaymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  if (!ORDER_ID_PATTERN.test(input.providerOrderId) || !PAYMENT_ID_PATTERN.test(input.providerPaymentId)) {
    return false;
  }
  return verifyHmacSha256(
    input.providerOrderId + "|" + input.providerPaymentId,
    input.signature,
    input.keySecret,
  );
}

export function verifyRazorpayWebhookSignature(input: {
  rawBody: string;
  signature: string;
  webhookSecret: string;
}): boolean {
  return verifyHmacSha256(input.rawBody, input.signature, input.webhookSecret);
}

async function razorpayRequest<T>(
  path: string,
  method: "GET" | "POST",
  payload?: Record<string, unknown>,
  idempotencyKey?: string,
): Promise<T> {
  const config = getRazorpaySandboxConfiguration();
  const headers: Record<string, string> = {
    Authorization: "Basic " + Buffer.from(config.keyId + ":" + config.keySecret).toString("base64"),
    Accept: "application/json",
  };
  if (payload) headers["Content-Type"] = "application/json";
  if (idempotencyKey) headers["X-Refund-Idempotency"] = idempotencyKey;

  let response: Response;
  try {
    response = await fetch(API_BASE + path, {
      method,
      headers,
      ...(payload ? { body: JSON.stringify(payload) } : {}),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    // A network failure is ambiguous: the provider may have received the operation.
    throw new Error("PAYMENT_PROVIDER_NETWORK_AMBIGUOUS");
  }

  const text = await response.text();
  let parsed: unknown = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = null; }
  if (!response.ok) {
    const providerCode = parsed && typeof parsed === "object"
      ? ((parsed as { error?: { code?: unknown } }).error?.code)
      : null;
    throw new RazorpayApiError(
      response.status,
      typeof providerCode === "string" && /^[A-Z0-9_]{1,80}$/.test(providerCode) ? providerCode : null,
    );
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("PAYMENT_PROVIDER_INVALID_RESPONSE");
  }
  return parsed as T;
}

export async function createRazorpayOrder(input: {
  amountMinor: number;
  currency: string;
  receipt: string;
  orderId: string;
  paymentAttemptId: string;
}): Promise<RazorpayOrder> {
  if (!Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0
    || !/^[A-Z]{3}$/.test(input.currency) || !/^[A-Za-z0-9_-]{1,40}$/.test(input.receipt)) {
    throw new Error("The payment amount, currency or receipt is invalid.");
  }
  const result = await razorpayRequest<RazorpayOrder>("/orders", "POST", {
    amount: input.amountMinor,
    currency: input.currency,
    receipt: input.receipt,
    notes: {
      internal_order_id: input.orderId,
      payment_attempt_id: input.paymentAttemptId,
    },
  });
  if (!ORDER_ID_PATTERN.test(result.id) || result.amount !== input.amountMinor
    || result.currency !== input.currency || result.receipt !== input.receipt) {
    throw new Error("PAYMENT_PROVIDER_ORDER_MISMATCH");
  }
  return result;
}

export async function fetchRazorpayPayment(paymentId: string): Promise<RazorpayPayment> {
  if (!PAYMENT_ID_PATTERN.test(paymentId)) throw new Error("A valid provider payment is required.");
  const result = await razorpayRequest<RazorpayPayment>("/payments/" + encodeURIComponent(paymentId), "GET");
  if (result.id !== paymentId || !ORDER_ID_PATTERN.test(result.order_id ?? "")
    || !Number.isSafeInteger(result.amount) || !/^[A-Z]{3}$/.test(result.currency)
    || !["created", "authorized", "captured", "refunded", "failed"].includes(result.status)
    || typeof result.captured !== "boolean" || !Number.isSafeInteger(result.amount_refunded)) {
    throw new Error("PAYMENT_PROVIDER_INVALID_PAYMENT");
  }
  return result;
}

export async function fetchRazorpayOrderPayments(providerOrderId: string): Promise<RazorpayPayment[]> {
  if (!ORDER_ID_PATTERN.test(providerOrderId)) throw new Error("A valid provider order is required.");
  const result = await razorpayRequest<{ items?: RazorpayPayment[] }>(
    "/orders/" + encodeURIComponent(providerOrderId) + "/payments?count=100",
    "GET",
  );
  if (!Array.isArray(result.items)) throw new Error("PAYMENT_PROVIDER_INVALID_PAYMENT_LIST");
  return result.items.filter((item) =>
    item && item.order_id === providerOrderId && PAYMENT_ID_PATTERN.test(item.id)
    && Number.isSafeInteger(item.amount) && /^[A-Z]{3}$/.test(item.currency)
    && ["created", "authorized", "captured", "refunded", "failed"].includes(item.status)
    && typeof item.captured === "boolean" && Number.isSafeInteger(item.amount_refunded),
  );
}

export async function createRazorpayRefund(input: {
  paymentId: string;
  amountMinor: number;
  receipt: string;
  idempotencyKey: string;
}): Promise<RazorpayRefund> {
  if (!PAYMENT_ID_PATTERN.test(input.paymentId)
    || !Number.isSafeInteger(input.amountMinor) || input.amountMinor <= 0
    || !/^[A-Za-z0-9_-]{10,40}$/.test(input.idempotencyKey)
    || !/^[A-Za-z0-9_-]{1,40}$/.test(input.receipt)) {
    throw new Error("The refund request is invalid.");
  }
  const result = await razorpayRequest<RazorpayRefund>(
    "/payments/" + encodeURIComponent(input.paymentId) + "/refund",
    "POST",
    { amount: input.amountMinor, receipt: input.receipt },
    input.idempotencyKey,
  );
  if (!REFUND_ID_PATTERN.test(result.id) || result.payment_id !== input.paymentId
    || result.amount !== input.amountMinor || !/^[A-Z]{3}$/.test(result.currency)
    || !["pending", "processed", "failed"].includes(result.status)) {
    throw new Error("PAYMENT_PROVIDER_REFUND_MISMATCH");
  }
  return result;
}
