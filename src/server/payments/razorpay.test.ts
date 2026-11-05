import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  getRazorpaySandboxConfiguration,
  isRazorpaySandboxConfigured,
  verifyRazorpayCheckoutSignature,
  verifyRazorpayWebhookSignature,
} from "./razorpay";

const originalEnv = { ...process.env };

afterEach(() => {
  vi.restoreAllMocks();
  for (const key of [
    "PAYMENTS_ENABLED", "PAYMENT_PROVIDER", "PAYMENT_MODE",
    "RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET", "RAZORPAY_WEBHOOK_SECRET",
  ]) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value !== undefined) process.env[key] = value;
  }
});

function sign(message: string, secret: string) {
  return createHmac("sha256", secret).update(message).digest("hex");
}

describe("Razorpay sandbox configuration and signatures", () => {
  it("fails closed when payments are disabled or credentials are missing", () => {
    expect(isRazorpaySandboxConfigured()).toBe(false);
    expect(() => getRazorpaySandboxConfiguration()).toThrow(/not configured/i);

    process.env.PAYMENTS_ENABLED = "true";
    process.env.PAYMENT_PROVIDER = "razorpay";
    process.env.PAYMENT_MODE = "test";
    process.env.RAZORPAY_KEY_ID = "rzp_live_never-allow";
    process.env.RAZORPAY_KEY_SECRET = "test-secret-value";
    process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-secret-value";
    expect(isRazorpaySandboxConfigured()).toBe(false);
  });

  it("accepts only explicit Razorpay test-mode credentials", () => {
    process.env.PAYMENTS_ENABLED = "true";
    process.env.PAYMENT_PROVIDER = "razorpay";
    process.env.PAYMENT_MODE = "test";
    process.env.RAZORPAY_KEY_ID = "rzp_test_0123456789";
    process.env.RAZORPAY_KEY_SECRET = "test-secret-value";
    process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-secret-value";

    expect(getRazorpaySandboxConfiguration()).toEqual({
      keyId: "rzp_test_0123456789",
      keySecret: "test-secret-value",
      webhookSecret: "webhook-secret-value",
    });
    expect(isRazorpaySandboxConfigured()).toBe(true);
  });

  it("rejects live mode even when payments are explicitly enabled", () => {
    process.env.PAYMENTS_ENABLED = "true";
    process.env.PAYMENT_PROVIDER = "razorpay";
    process.env.PAYMENT_MODE = "live";
    process.env.RAZORPAY_KEY_ID = "rzp_live_0123456789";
    process.env.RAZORPAY_KEY_SECRET = "test-secret-value";
    process.env.RAZORPAY_WEBHOOK_SECRET = "webhook-secret-value";
    expect(isRazorpaySandboxConfigured()).toBe(false);
  });

  it("verifies the checkout signature from provider order id and payment id", () => {
    const providerOrderId = "order_123456789";
    const providerPaymentId = "pay_123456789";
    const keySecret = "private-test-key";
    const signature = sign(providerOrderId + "|" + providerPaymentId, keySecret);

    expect(verifyRazorpayCheckoutSignature({
      providerOrderId, providerPaymentId, signature, keySecret,
    })).toBe(true);
    expect(verifyRazorpayCheckoutSignature({
      providerOrderId, providerPaymentId, signature: signature.toUpperCase(), keySecret,
    })).toBe(true);
    expect(verifyRazorpayCheckoutSignature({
      providerOrderId, providerPaymentId, signature: sign("different", keySecret), keySecret,
    })).toBe(false);
    expect(verifyRazorpayCheckoutSignature({
      providerOrderId: "not-an-order", providerPaymentId, signature, keySecret,
    })).toBe(false);
  });

  it("verifies webhooks against the untouched raw request body", () => {
    const rawBody = '{ "event":"payment.captured", "created_at": 123 }';
    const webhookSecret = "test-webhook-secret";
    const signature = sign(rawBody, webhookSecret);

    expect(verifyRazorpayWebhookSignature({ rawBody, signature, webhookSecret })).toBe(true);
    expect(verifyRazorpayWebhookSignature({ rawBody: JSON.stringify(JSON.parse(rawBody)), signature, webhookSecret })).toBe(false);
    expect(verifyRazorpayWebhookSignature({ rawBody, signature: "bad-signature", webhookSecret })).toBe(false);
  });
});
