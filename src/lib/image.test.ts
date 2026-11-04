import { describe, expect, it } from "vitest";
import { galleryBlurDataUrl, isRemoteImage } from "./image";

describe("storefront image helpers", () => {
  it("provides a self-contained SVG blur placeholder", () => {
    expect(galleryBlurDataUrl).toMatch(/^data:image\/svg\+xml,/);
    expect(galleryBlurDataUrl).toContain("%23e8dfd2");
  });

  it("identifies remote image URLs without allowing arbitrary hosts", () => {
    expect(isRemoteImage("https://images.example.test/piece.webp")).toBe(true);
    expect(isRemoteImage("/product-media/products/a/b.webp")).toBe(false);
  });
});
