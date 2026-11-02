import { describe, expect, it } from "vitest";
import { normalizeWishlistSlugs, toggleWishlistSlug } from "./wishlist";

describe("wishlist slug helpers", () => {
  it("deduplicates and rejects unsafe slugs", () => {
    expect(normalizeWishlistSlugs(["banjara-jacket", "banjara-jacket", "../escape"])).toEqual(["banjara-jacket"]);
  });

  it("toggles a saved product on and off", () => {
    const first = toggleWishlistSlug([], "kantha-coat");
    expect(first).toEqual(["kantha-coat"]);
    expect(toggleWishlistSlug(first, "kantha-coat")).toEqual([]);
  });
});
