import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProductGallery } from "./ProductGallery";

const images = [
  { id: "image-1", url: "/api/media/products/product-1/front", altText: "Front of an indigo woven textile", sortOrder: 0, isPrimary: true },
  { id: "image-2", url: "/api/media/products/product-1/detail", altText: "Close detail of the textile weave", sortOrder: 1, isPrimary: false },
];

describe("ProductGallery", () => {
  it("names the gallery and retains accessible previous, next and thumbnail controls", () => {
    const markup = renderToStaticMarkup(
      <ProductGallery images={images} title="Indigo woven textile" />,
    );

    expect(markup).toContain('role="group"');
    expect(markup).toContain('aria-label="Indigo woven textile product image gallery"');
    expect(markup).toContain('aria-label="View previous product image"');
    expect(markup).toContain('aria-label="View next product image"');
    expect(markup).toContain('aria-label="Choose a product image"');
    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('aria-live="polite"');
  });

  it("does not render non-functional navigation for a single image", () => {
    const markup = renderToStaticMarkup(
      <ProductGallery images={[images[0]]} title="Indigo woven textile" />,
    );

    expect(markup).toContain('aria-label="Indigo woven textile product image gallery"');
    expect(markup).not.toContain('aria-label="View previous product image"');
    expect(markup).not.toContain('aria-label="Choose a product image"');
  });

  it("renders no gallery when there are no approved images", () => {
    expect(renderToStaticMarkup(<ProductGallery images={[]} title="A product" />)).toBe("");
  });
});
