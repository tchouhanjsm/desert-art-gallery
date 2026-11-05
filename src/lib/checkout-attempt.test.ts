import { describe, expect, it, vi } from "vitest";
import type { CartLine } from "@/lib/cart";
import type { CheckoutAddress } from "@/lib/checkout";
import { buildCheckoutAttemptFingerprint, buildReservationFingerprint, getCheckoutAttemptKeys } from "./checkout-attempt";

const lines: CartLine[] = [
  { slug: "woven-runner", variantId: "11111111-1111-4111-8111-111111111111", quantity: 1 },
  { slug: "embroidered-cushion", quantity: 2 },
];
const address: CheckoutAddress = { recipient_name: "Gallery Customer", address_line_1: "12 Market Road", city: "Jaipur", postal_code: "302001", country_code: "IN" };
const input = { lines, address, shippingRateId: "22222222-2222-4222-8222-222222222222", customerNote: "Leave with reception." };

describe("checkout attempt fingerprints", () => {
  it("normalizes cart line order for both requests", () => {
    expect(buildCheckoutAttemptFingerprint(input)).toBe(buildCheckoutAttemptFingerprint({ ...input, lines: [...lines].reverse() }));
    expect(buildReservationFingerprint(lines)).toBe(buildReservationFingerprint([...lines].reverse()));
  });
  it("changes the order fingerprint for address, rate, note or quantity changes", () => {
    const original = buildCheckoutAttemptFingerprint(input);
    expect(buildCheckoutAttemptFingerprint({ ...input, address: { ...address, city: "Jodhpur" } })).not.toBe(original);
    expect(buildCheckoutAttemptFingerprint({ ...input, shippingRateId: "33333333-3333-4333-8333-333333333333" })).not.toBe(original);
    expect(buildCheckoutAttemptFingerprint({ ...input, customerNote: "Call on arrival." })).not.toBe(original);
    expect(buildCheckoutAttemptFingerprint({ ...input, lines: [{ ...lines[0], quantity: 2 }, lines[1]] })).not.toBe(original);
  });
  it("keeps reservation identity unchanged for address, rate and note edits", () => {
    const reservation = buildReservationFingerprint(lines);
    expect(buildReservationFingerprint(lines)).toBe(reservation);
    expect(buildReservationFingerprint(lines)).toBe(buildReservationFingerprint([...lines]));
    expect(buildCheckoutAttemptFingerprint({ ...input, address: { ...address, city: "Jodhpur" } })).not.toBe(buildCheckoutAttemptFingerprint(input));
  });
  it("changes reservation identity when cart lines change", () => {
    expect(buildReservationFingerprint([{ ...lines[0], quantity: 2 }, lines[1]])).not.toBe(buildReservationFingerprint(lines));
  });
});

describe("checkout idempotency keys", () => {
  it("reuses both keys for an unchanged checkout request", () => {
    const fingerprint = buildCheckoutAttemptFingerprint(input);
    const reservationFingerprint = buildReservationFingerprint(lines);
    const first = getCheckoutAttemptKeys(fingerprint, reservationFingerprint, null, vi.fn().mockReturnValueOnce("reservation").mockReturnValueOnce("order-1"));
    const createKey = vi.fn();
    expect(getCheckoutAttemptKeys(fingerprint, reservationFingerprint, first, createKey)).toBe(first);
    expect(createKey).not.toHaveBeenCalled();
  });
  it("reuses reservation identity but rotates order identity when details change", () => {
    const first = getCheckoutAttemptKeys(buildCheckoutAttemptFingerprint(input), buildReservationFingerprint(lines), null, vi.fn().mockReturnValueOnce("reservation").mockReturnValueOnce("order-1"));
    const changed = { ...input, address: { ...address, city: "Jodhpur" } };
    const next = getCheckoutAttemptKeys(buildCheckoutAttemptFingerprint(changed), buildReservationFingerprint(lines), first, vi.fn().mockReturnValueOnce("order-2"));
    expect(next.reservationKey).toBe(first.reservationKey);
    expect(next.orderDraftKey).toBe("order-2");
  });
  it("generates a new reservation key when cart lines change", () => {
    const first = getCheckoutAttemptKeys(buildCheckoutAttemptFingerprint(input), buildReservationFingerprint(lines), null, vi.fn().mockReturnValueOnce("reservation-1").mockReturnValueOnce("order-1"));
    const updated = [{ ...lines[0], quantity: 2 }, lines[1]];
    const next = getCheckoutAttemptKeys(buildCheckoutAttemptFingerprint({ ...input, lines: updated }), buildReservationFingerprint(updated), first, vi.fn().mockReturnValueOnce("reservation-2").mockReturnValueOnce("order-2"));
    expect(next.reservationKey).toBe("reservation-2");
  });
  it("rejects duplicate or empty keys", () => {
    expect(() => getCheckoutAttemptKeys("f", "r", null, () => "same")).toThrow("Checkout attempt keys must be distinct non-empty values.");
  });
});
