import { describe, expect, it } from "vitest";
import type { Product } from "./products";
import {
  ALL_SHOP_CATEGORY,
  filterAndSortProducts,
  getShopCategories,
  getShopCategorySummary,
  normalizeShopSearchText,
  parseShopQuery,
  sanitizeShopQuery,
  serializeShopQuery,
} from "./shop-query";

const catalogue: Product[] = [
  {
    slug: "cafe-throw",
    name: "Café Throw",
    category: "Textiles",
    image: "/images/textile-placeholder.svg",
    imageAlt: "Test fixture",
    note: "Soft woven surface",
    availability: "inquiry",
    priceMinor: 2500,
    currency: "USD",
  },
  {
    slug: "amber-object",
    name: "Amber Object",
    category: "Objects",
    image: "/images/textile-placeholder.svg",
    imageAlt: "Test fixture",
    note: "A considered display piece",
    availability: "inquiry",
    priceMinor: 1200,
    currency: "USD",
    featured: true,
  },
  {
    slug: "unpriced-textile",
    name: "Unpriced Textile",
    category: "Textiles",
    image: "/images/textile-placeholder.svg",
    imageAlt: "Test fixture",
    note: "Details available by enquiry",
    availability: "inquiry",
  },
];

describe("shop query state", () => {
  const categories = getShopCategories(catalogue);

  it("hydrates a header search query and valid category and sort values", () => {
    expect(
      parseShopQuery(
        new URLSearchParams("q=Caf%C3%A9&category=Textiles&sort=price-low"),
        categories,
      ),
    ).toEqual({ q: "Café", category: "Textiles", sort: "price-low" });
  });

  it("falls back safely for unknown categories and unsupported sort values", () => {
    expect(
      parseShopQuery(
        new URLSearchParams("category=not-a-category&sort=database"),
        categories,
      ),
    ).toEqual({ q: "", category: ALL_SHOP_CATEGORY, sort: "featured" });
  });

  it("normalizes compatibility forms, removes control characters and caps query length", () => {
    expect(sanitizeShopQuery("  Cafe\u0000  \u212B ")).toBe("  Cafe  Å ");
    expect(sanitizeShopQuery("x".repeat(140))).toHaveLength(100);
    expect(normalizeShopSearchText("  CAFÉ   THROW ")).toBe("cafe throw");
  });

  it("filters by the verified searchable fields and selected category", () => {
    const result = filterAndSortProducts(catalogue, {
      q: "cafe",
      category: "Textiles",
      sort: "featured",
    });

    expect(result.map((product) => product.slug)).toEqual(["cafe-throw"]);
  });

  it("keeps products without a verified price after priced products in both price directions", () => {
    const lowToHigh = filterAndSortProducts(catalogue, {
      q: "",
      category: ALL_SHOP_CATEGORY,
      sort: "price-low",
    });
    const highToLow = filterAndSortProducts(catalogue, {
      q: "",
      category: ALL_SHOP_CATEGORY,
      sort: "price-high",
    });

    expect(lowToHigh.map((product) => product.slug)).toEqual([
      "amber-object",
      "cafe-throw",
      "unpriced-textile",
    ]);
    expect(highToLow.map((product) => product.slug)).toEqual([
      "cafe-throw",
      "amber-object",
      "unpriced-textile",
    ]);
  });

  it("preserves unrelated campaign parameters while omitting default shop filters", () => {
    const params = new URLSearchParams("utm_source=gallery&sort=price-high&category=Objects");
    const result = serializeShopQuery(
      { q: "  woven  ", category: ALL_SHOP_CATEGORY, sort: "featured" },
      params,
    );

    expect(result).toBe("utm_source=gallery&q=++woven++");
  });

  it("returns category counts in the same stable order as the filter options", () => {
    expect(getShopCategorySummary(catalogue)).toEqual([
      { category: ALL_SHOP_CATEGORY, count: 3 },
      { category: "Objects", count: 1 },
      { category: "Textiles", count: 2 },
    ]);
  });

  it("counts an empty catalogue without inventing category options", () => {
    expect(getShopCategorySummary([])).toEqual([
      { category: ALL_SHOP_CATEGORY, count: 0 },
    ]);
  });

  it("derives only categories present in the supplied published catalogue", () => {
    expect(categories).toEqual(["All pieces", "Objects", "Textiles"]);
  });
});
