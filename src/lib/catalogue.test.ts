import { describe, expect, it } from "vitest";
import { formatMoneyFromMinor } from "./money";
import { collections, products } from "./products";

describe("formatMoneyFromMinor", () => {
  it("formats two-decimal currencies from minor units", () => {
    expect(formatMoneyFromMinor(1299, "USD")).toContain("12.99");
    expect(formatMoneyFromMinor(1299, "GBP")).toContain("12.99");
  });

  it("respects currencies without fractional minor units", () => {
    expect(formatMoneyFromMinor(1299, "JPY")).toContain("1,299");
  });

  it("respects currencies with three fractional minor units", () => {
    expect(formatMoneyFromMinor(1299, "KWD")).toContain("1.299");
  });

  it("does not throw for a malformed currency code", () => {
    expect(formatMoneyFromMinor(1299, "invalid")).toContain("12.99");
  });
});


describe("development catalogue asset rights", () => {
  it("uses only local placeholders for unverified preview records", () => {
    const imagePaths = [...products.map((product) => product.image), ...collections.map((collection) => collection.image)];
    expect(imagePaths.length).toBeGreaterThan(0);
    expect(imagePaths.every((path) => path.startsWith("/images/"))).toBe(true);
    expect(imagePaths.some((path) => /^https?:\/\//i.test(path))).toBe(false);
  });

  it("keeps preview products inquiry-only and without invented sale values", () => {
    expect(products.every((product) => product.availability === "inquiry")).toBe(true);
    expect(products.every((product) => product.priceMinor == null && product.quantityOnHand == null)).toBe(true);
  });
});
