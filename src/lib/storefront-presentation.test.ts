import { describe, expect, it } from "vitest";
import type { Product } from "./products";
import {
  getProductCardFacts,
  hasPurchasableProductOption,
  isPublishedCollectionImage,
  isPublishedProductRecord,
  selectStorefrontHeroProduct,
} from "./storefront-presentation";

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
    const published = makeProduct({ id: "product-123", slug: "published-textile", image: "/api/media/products/product-123/primary", imageAlt: "Published textile" });
    expect(selectStorefrontHeroProduct([preview, published])).toBe(published);
  });
  it("does not select a persisted record with an empty image URL", () => {
    expect(selectStorefrontHeroProduct([makeProduct({ id: "product-123", image: " " })])).toBeNull();
  });
});

describe("isPublishedProductRecord", () => {
  it("rejects development preview records with no persisted ID", () => {
    expect(isPublishedProductRecord(makeProduct())).toBe(false);
  });
  it("accepts records with a non-empty persisted ID", () => {
    expect(isPublishedProductRecord(makeProduct({ id: "product-123" }))).toBe(true);
  });
  it("rejects whitespace-only IDs", () => {
    expect(isPublishedProductRecord(makeProduct({ id: "  " }))).toBe(false);
  });
});

describe("published collection imagery", () => {
  const approvedImage = {
    id: "c1",
    image: "/api/media/collections/c1/hero",
    imageAlt: "Folded indigo textile with embroidered edging",
    imageApproved: true,
  };
  it("requires persisted identity and server-confirmed image approval", () => {
    expect(isPublishedCollectionImage({ ...approvedImage, id: undefined })).toBe(false);
    expect(isPublishedCollectionImage({ ...approvedImage, imageApproved: false })).toBe(false);
    expect(isPublishedCollectionImage(approvedImage)).toBe(true);
  });
  it("never promotes a placeholder or generic alternative text to collection photography", () => {
    expect(isPublishedCollectionImage({ ...approvedImage, image: "/images/textile-placeholder.svg" })).toBe(false);
    expect(isPublishedCollectionImage({ ...approvedImage, imageAlt: "Collection image" })).toBe(false);
    expect(isPublishedCollectionImage({ ...approvedImage, imageAlt: " " })).toBe(false);
  });
});

describe("product card facts and purchase status", () => {
  it("returns only product facts supplied by the catalogue", () => {
    expect(getProductCardFacts(makeProduct())).toEqual([]);
    expect(getProductCardFacts(makeProduct({
      isOneOfAKind: true, materials: ["Cotton", "Mirror work", "Other"], sizes: ["One size", "Long"],
    }))).toEqual(["One of a kind", "Cotton · Mirror work", "One size · Long"]);
  });
  it("requires a persisted product, base price, currency and available purchase option", () => {
    expect(hasPurchasableProductOption(makeProduct({ priceMinor: 1000, currency: "INR", quantityOnHand: 1 }))).toBe(false);
    expect(hasPurchasableProductOption(makeProduct({ id: "p1", priceMinor: 1000, currency: "INR", quantityOnHand: 0 }))).toBe(false);
    expect(hasPurchasableProductOption(makeProduct({ id: "p1", priceMinor: 1000, currency: "INR", quantityOnHand: 1 }))).toBe(true);
    expect(hasPurchasableProductOption(makeProduct({
      id: "p2", priceMinor: 1000, currency: "INR",
      variants: [{ id: "v1", label: "Small", sku: null, attributes: {}, priceMinor: null, quantityOnHand: 2, status: "active" }],
    }))).toBe(true);
    expect(hasPurchasableProductOption(makeProduct({
      id: "p3", priceMinor: null, currency: "INR",
      variants: [{ id: "v1", label: "Small", sku: null, attributes: {}, priceMinor: 1000, quantityOnHand: 2, status: "active" }],
    }))).toBe(false);
  });
});
