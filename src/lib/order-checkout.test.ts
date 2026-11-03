import { describe, expect, it } from "vitest";
import {
  calculateCheckoutTax,
  calculateCheckoutTotal,
  getOrderDraftExpiry,
  toSafeOrderMinor,
} from "./order-checkout";

describe("MySQL checkout arithmetic", () => {
  it("calculates destination taxes using integer minor units", () => {
    const result = calculateCheckoutTax(BigInt(10000), BigInt(500), [
      { name: "GST", rateBasisPoints: 1800, taxableShipping: false },
      { name: "Shipping levy", rateBasisPoints: 500, taxableShipping: true },
    ]);
    expect(result.breakdown).toEqual([
      { name: "GST", rate_basis_points: 1800, amount_minor: 1800 },
      { name: "Shipping levy", rate_basis_points: 500, amount_minor: 525 },
    ]);
    expect(result.taxMinor).toBe(BigInt(2325));
  });

  it("requires an explicit zero-rate rule when no tax applies", () => {
    expect(calculateCheckoutTax(BigInt(5000), BigInt(0), [
      { name: "No tax applies", rateBasisPoints: 0, taxableShipping: false },
    ]).taxMinor).toBe(BigInt(0));
    expect(() => calculateCheckoutTax(BigInt(5000), BigInt(0), [])).toThrow("At least one destination tax rule is required.");
    expect(() => calculateCheckoutTax(BigInt(5000), BigInt(0), [
      { name: "Invalid", rateBasisPoints: 10001, taxableShipping: false },
    ])).toThrow("A destination tax rule is invalid.");
  });

  it("rounds each tax component and rejects imprecise total values", () => {
    expect(calculateCheckoutTax(BigInt(1), BigInt(0), [
      { name: "Half minor unit", rateBasisPoints: 5000, taxableShipping: false },
    ]).taxMinor).toBe(BigInt(1));
    expect(() => toSafeOrderMinor(BigInt(Number.MAX_SAFE_INTEGER) + BigInt(1), "test")).toThrow();
    expect(() => calculateCheckoutTotal({
      subtotalMinor: BigInt(Number.MAX_SAFE_INTEGER), shippingMinor: BigInt(1), taxMinor: BigInt(0),
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
