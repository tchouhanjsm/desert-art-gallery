import { describe, expect, it } from "vitest";
import type { Product } from "./products";
import { selectStorefrontHeroProduct } from "./storefront-presentation";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    slug: "preview-textile",
    name: "Preview textile",
    category: "Textiles",
    image: "/images/textile-placeholder.svg",
    imageAlt: "Preview artwork only",
    note: "",
    availability: "inquiry",
    ...overrides,
  };
}

describe("selectStorefrontHeroProduct", () => {
  it("does not promote development-only preview products into the hero", () => {
    expect(selectStorefrontHeroProduct([makeProduct()])).toBeNull();
  });

  it("skips preview records and selects the first persisted product with media", () => {
    const preview = makeProduct();
    const published = makeProduct({
      id: "product-123",
      slug: "published-textile",
      image: "/api/media/products/product-123/primary",
      imageAlt: "Published textile",
    });

    expect(selectStorefrontHeroProduct([preview, published])).toBe(published);
  });

  it("does not select a persisted record with an empty image URL", () => {
    expect(selectStorefrontHeroProduct([
      makeProduct({ id: "product-123", image: " " }),
    ])).toBeNull();
  });
});
