import { describe, expect, it } from "vitest";
import type { CartLine } from "./cart";
import { formatCartFallbackName, getCartDisplayRows, type CartPreviewItem } from "./cart-presentation";

const lines: CartLine[] = [
  { slug: "embroidered-cushion", quantity: 2 },
  { slug: "woven-runner", variantId: "11111111-1111-4111-8111-111111111111", quantity: 1 },
];

const wovenVariantPreview: CartPreviewItem = {
  slug: "woven-runner",
  variantId: "11111111-1111-4111-8111-111111111111",
  variantLabel: "Long",
  name: "Woven Runner",
  quantityRequested: 1,
  availableQuantity: 3,
  available: true,
  priceMinor: 12500,
  currency: "INR",
  image: null,
  imageAlt: "",
};

describe("cart presentation rows", () => {
  it("keeps locally stored lines visible while server previews are pending or failed", () => {
    expect(getCartDisplayRows(lines, [])).toEqual([
      { line: lines[0], item: null },
      { line: lines[1], item: null },
    ]);
  });

  it("joins a server preview to the exact product and variant line", () => {
    const rows = getCartDisplayRows(lines, [wovenVariantPreview]);
    expect(rows[0].item).toBeNull();
    expect(rows[1].item).toEqual(wovenVariantPreview);
  });

  it("does not attach a product-level preview to a variant-specific line", () => {
    const productPreview = { ...wovenVariantPreview, variantId: null };
    const rows = getCartDisplayRows(lines, [productPreview]);
    expect(rows[1].item).toBeNull();
  });

  it("formats a missing-preview fallback without exposing a slug", () => {
    expect(formatCartFallbackName("embroidered-cushion")).toBe("Embroidered Cushion");
  });
});
