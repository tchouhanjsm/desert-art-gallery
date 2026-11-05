import { describe, expect, it, vi } from "vitest";
import type { CartLine } from "@/lib/cart";
import type { CheckoutAddress } from "@/lib/checkout";
import {
  buildCheckoutAttemptFingerprint,
  getCheckoutAttemptKeys,
} from "./checkout-attempt";

const lines: CartLine[] = [
  { slug: "woven-runner", variantId: "11111111-1111-4111-8111-111111111111", quantity: 1 },
  { slug: "embroidered-cushion", quantity: 2 },
];
const address: CheckoutAddress = {
  recipient_name: "  Gallery Customer ",
  address_line_1: "  12 Market Road ",
  city: " Jaipur ",
  postal_code: " 302001 ",
  country_code: "in",
};
const input = {
  lines,
  address,
  shippingRateId: "22222222-2222-4222-8222-222222222222",
  customerNote: "  Leave with reception.  ",
};

describe("checkout attempt fingerprint", () => {
  it("normalizes line order, address whitespace and country code", () => {
    const normalized = buildCheckoutAttemptFingerprint(input);
    const reordered = buildCheckoutAttemptFingerprint({
      ...input,
      lines: [...lines].reverse(),
      address: {
        ...address,
        recipient_name: "Gallery Customer",
        address_line_1: "12 Market Road",
        city: "Jaipur",
        postal_code: "302001",
        country_code: "IN",
      },
      customerNote: "Leave with reception.",
    });
    expect(normalized).toBe(reordered);
  });

  it("changes when any order-defining input changes", () => {
    const original = buildCheckoutAttemptFingerprint(input);
    expect(buildCheckoutAttemptFingerprint({ ...input, shippingRateId: "33333333-3333-4333-8333-333333333333" })).not.toBe(original);
    expect(buildCheckoutAttemptFingerprint({ ...input, customerNote: "Call on arrival." })).not.toBe(original);
    expect(buildCheckoutAttemptFingerprint({ ...input, lines: [{ ...lines[0], quantity: 2 }, lines[1]] })).not.toBe(original);
  });
});

describe("checkout idempotency keys", () => {
  it("reuses both reservation and order keys for an unchanged checkout request", () => {
    const fingerprint = buildCheckoutAttemptFingerprint(input);
    const firstKeys = getCheckoutAttemptKeys(fingerprint, null, vi.fn()
      .mockReturnValueOnce("reservation-key")
      .mockReturnValueOnce("order-key"));
    const createKey = vi.fn();
    const replayed = getCheckoutAttemptKeys(fingerprint, firstKeys, createKey);
    expect(replayed).toBe(firstKeys);
    expect(createKey).not.toHaveBeenCalled();
  });

  it("creates a new reservation and order key pair only when the request changes", () => {
    const fingerprint = buildCheckoutAttemptFingerprint(input);
    const firstKeys = getCheckoutAttemptKeys(fingerprint, null, vi.fn()
      .mockReturnValueOnce("reservation-key-1")
      .mockReturnValueOnce("order-key-1"));
    const nextKeys = getCheckoutAttemptKeys(fingerprint + "-changed", firstKeys, vi.fn()
      .mockReturnValueOnce("reservation-key-2")
      .mockReturnValueOnce("order-key-2"));
    expect(nextKeys).toEqual({
      fingerprint: fingerprint + "-changed",
      reservationKey: "reservation-key-2",
      orderDraftKey: "order-key-2",
    });
    expect(nextKeys.reservationKey).not.toBe(firstKeys.reservationKey);
    expect(nextKeys.orderDraftKey).not.toBe(firstKeys.orderDraftKey);
  });

  it("rejects a key factory that does not return a distinct pair", () => {
    expect(() => getCheckoutAttemptKeys("fingerprint", null, () => "same-key"))
      .toThrow("Checkout attempt keys must be distinct non-empty values.");
  });
});
