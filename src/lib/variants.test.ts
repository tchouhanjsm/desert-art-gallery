import { describe, expect, it } from "vitest";
import {
  isVariantInStock,
  normalizeVariantId,
  parseVariantAttributes,
  resolveVariantPriceMinor,
} from "./variants";

describe("product variant domain rules", () => {
  it("normalizes valid UUIDs and rejects arbitrary identifiers", () => {
    expect(normalizeVariantId("550E8400-E29B-41D4-A716-446655440000")).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(normalizeVariantId("../variant")).toBeNull();
    expect(normalizeVariantId(null)).toBeNull();
  });

  it("accepts only bounded scalar merchant-supplied attributes", () => {
    expect(parseVariantAttributes({ size: "  M  ", edition: 2, signed: false })).toEqual({
      size: "M",
      edition: 2,
      signed: false,
    });
    expect(() => parseVariantAttributes({})).toThrow(/between one and twelve/);
    expect(() => parseVariantAttributes({ size: ["M", "L"] })).toThrow(/scalar values/);
    expect(() => parseVariantAttributes({ "bad key": "value" })).toThrow(/attribute names/);
  });

  it("uses an explicit variant price or falls back to the verified base price", () => {
    expect(resolveVariantPriceMinor(12500, 10000)).toBe(12500);
    expect(resolveVariantPriceMinor(null, 10000)).toBe(10000);
    expect(resolveVariantPriceMinor(null, null)).toBeNull();
    expect(resolveVariantPriceMinor(Number.MAX_SAFE_INTEGER + 1, 10000)).toBeNull();
  });

  it("does not present draft or zero-stock variants as available", () => {
    expect(isVariantInStock({ status: "active", quantityOnHand: 1 })).toBe(true);
    expect(isVariantInStock({ status: "draft", quantityOnHand: 3 })).toBe(false);
    expect(isVariantInStock({ status: "active", quantityOnHand: 0 })).toBe(false);
  });
});
