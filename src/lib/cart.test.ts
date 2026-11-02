import { describe, expect, it } from "vitest";
import { cartLineKey, combineCartLines, mergeCartLine, normalizeCartLines, setCartLineQuantity, shouldMergeSavedCart } from "./cart";

const variantA = "550e8400-e29b-41d4-a716-446655440000";
const variantB = "550e8400-e29b-41d4-a716-446655440001";

describe("cart line normalization", () => {
  it("drops malformed lines and deduplicates repeated base-product slugs", () => {
    expect(normalizeCartLines([
      { slug: "vintage-jacket", quantity: 2 },
      { slug: "vintage-jacket", quantity: 3 },
      { slug: "../bad", quantity: 4 },
    ])).toEqual([{ slug: "vintage-jacket", quantity: 5 }]);
  });

  it("keeps separately selected variants as distinct cart lines", () => {
    expect(normalizeCartLines([
      { slug: "woven-jacket", variantId: variantA, quantity: 1 },
      { slug: "woven-jacket", variantId: variantB, quantity: 2 },
      { slug: "woven-jacket", quantity: 1 },
    ])).toEqual([
      { slug: "woven-jacket", variantId: variantA, quantity: 1 },
      { slug: "woven-jacket", variantId: variantB, quantity: 2 },
      { slug: "woven-jacket", quantity: 1 },
    ]);
    expect(cartLineKey("woven-jacket", variantA)).not.toBe(cartLineKey("woven-jacket", variantB));
  });

  it("rejects malformed variant identifiers instead of merging them into a base line", () => {
    expect(normalizeCartLines([{ slug: "woven-jacket", variantId: "../bad", quantity: 1 }])).toEqual([]);
  });

  it("caps quantities and limits distinct product/variant lines", () => {
    const many = Array.from({ length: 40 }, (_, index) => ({ slug: "piece-" + index, quantity: 200 }));
    const normalized = normalizeCartLines(many);
    expect(normalized).toHaveLength(30);
    expect(normalized[0].quantity).toBe(99);
  });

  it("merges only the matching product and variant identity", () => {
    expect(mergeCartLine([{ slug: "kantha-jacket", variantId: variantA, quantity: 1 }], "kantha-jacket", 2, 9, variantA))
      .toEqual([{ slug: "kantha-jacket", variantId: variantA, quantity: 3 }]);
    expect(mergeCartLine([{ slug: "kantha-jacket", variantId: variantA, quantity: 1 }], "kantha-jacket", 1, 9, variantB))
      .toHaveLength(2);
  });

  it("removes or changes only the selected variant line", () => {
    const lines = [
      { slug: "woven-jacket", variantId: variantA, quantity: 1 },
      { slug: "woven-jacket", variantId: variantB, quantity: 2 },
    ];
    expect(setCartLineQuantity(lines, "woven-jacket", 0, variantA)).toEqual([lines[1]]);
    expect(setCartLineQuantity(lines, "woven-jacket", 4, variantB)).toEqual([{ ...lines[0] }, { ...lines[1], quantity: 4 }]);
  });
});


describe("authenticated cart synchronization policy", () => {
  it("merges saved and guest lines only when the authenticated account changes", () => {
    const saved = [{ slug: "woven-jacket", variantId: variantA, quantity: 2 }];
    const guest = [{ slug: "woven-jacket", variantId: variantA, quantity: 1 }];
    expect(shouldMergeSavedCart(null, "customer-a")).toBe(true);
    expect(shouldMergeSavedCart("customer-a", "customer-a")).toBe(false);
    expect(shouldMergeSavedCart("customer-a", "customer-b")).toBe(true);
    expect(combineCartLines(saved, guest, true)).toEqual([
      { slug: "woven-jacket", variantId: variantA, quantity: 3 },
    ]);
    expect(combineCartLines(saved, guest, false)).toEqual(guest);
  });
});
