import { describe, expect, it } from "vitest";
import { mergeCartLine, normalizeCartLines, setCartLineQuantity } from "./cart";

describe("cart line normalization", () => {
  it("drops malformed lines and deduplicates repeated slugs", () => {
    expect(normalizeCartLines([{ slug: "vintage-jacket", quantity: 2 }, { slug: "vintage-jacket", quantity: 3 }, { slug: "../bad", quantity: 4 }])).toEqual([{ slug: "vintage-jacket", quantity: 5 }]);
  });

  it("caps quantities and limits distinct product lines", () => {
    const many = Array.from({ length: 40 }, (_, index) => ({ slug: "piece-" + index, quantity: 200 }));
    const normalized = normalizeCartLines(many);
    expect(normalized).toHaveLength(30);
    expect(normalized[0].quantity).toBe(99);
  });

  it("merges a quantity into an existing line", () => {
    expect(mergeCartLine([{ slug: "kantha-jacket", quantity: 1 }], "kantha-jacket", 2)).toEqual([{ slug: "kantha-jacket", quantity: 3 }]);
  });

  it("removes a line when its quantity reaches zero", () => {
    expect(setCartLineQuantity([{ slug: "one", quantity: 1 }, { slug: "two", quantity: 2 }], "one", 0)).toEqual([{ slug: "two", quantity: 2 }]);
  });
});
