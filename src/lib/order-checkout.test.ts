import { describe, expect, it } from "vitest";
import {
  calculateCheckoutTax,
  calculateCheckoutTotal,
  getOrderDraftExpiry,
  toSafeOrderMinor,
} from "./order-checkout";

describe("MySQL checkout arithmetic", () => {
  it("calculates destination taxes using integer minor units", () => {
    const result = calculateCheckoutTax(10000n, 500n, [
      { name: "GST", rateBasisPoints: 1800, taxableShipping: false },
      { name: "Shipping levy", rateBasisPoints: 500, taxableShipping: true },
    ]);
    expect(result.breakdown).toEqual([
      { name: "GST", rate_basis_points: 1800, amount_minor: 1800 },
      { name: "Shipping levy", rate_basis_points: 500, amount_minor: 525 },
    ]);
    expect(result.taxMinor).toBe(2325n);
  });

  it("requires an explicit zero-rate rule when no tax applies", () => {
    expect(calculateCheckoutTax(5000n, 0n, [
      { name: "No tax applies", rateBasisPoints: 0, taxableShipping: false },
    ]).taxMinor).toBe(0n);
    expect(() => calculateCheckoutTax(5000n, 0n, [])).toThrow("At least one destination tax rule is required.");
    expect(() => calculateCheckoutTax(5000n, 0n, [
      { name: "Invalid", rateBasisPoints: 10001, taxableShipping: false },
    ])).toThrow("A destination tax rule is invalid.");
  });

  it("rounds each tax component and rejects imprecise total values", () => {
    expect(calculateCheckoutTax(1n, 0n, [
      { name: "Half minor unit", rateBasisPoints: 5000, taxableShipping: false },
    ]).taxMinor).toBe(1n);
    expect(() => toSafeOrderMinor(BigInt(Number.MAX_SAFE_INTEGER) + 1n, "test")).toThrow();
    expect(() => calculateCheckoutTotal({
      subtotalMinor: BigInt(Number.MAX_SAFE_INTEGER), shippingMinor: 1n, taxMinor: 0n,
    })).toThrow();
  });

  it("caps order draft expiry at the earlier reservation or draft expiry", () => {
    const now = new Date("2026-11-03T10:00:00.000Z");
    expect(getOrderDraftExpiry(new Date("2026-11-03T10:20:00.000Z"), now, 900000).toISOString())
      .toBe("2026-11-03T10:15:00.000Z");
    expect(getOrderDraftExpiry(new Date("2026-11-03T10:05:00.000Z"), now, 900000).toISOString())
      .toBe("2026-11-03T10:05:00.000Z");
    expect(() => getOrderDraftExpiry(now, now, 900000)).toThrow("The inventory reservation has expired.");
  });
});
