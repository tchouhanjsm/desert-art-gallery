import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StorefrontMediaPlaceholder } from "./StorefrontMediaPlaceholder";

describe("StorefrontMediaPlaceholder", () => {
  it("keeps product media pending without repeating a large brand monogram", () => {
    const markup = renderToStaticMarkup(
      <StorefrontMediaPlaceholder
        variant="product"
        label="Photography pending for a catalogue item"
        caption="PHOTOGRAPHY PENDING"
      />,
    );

    expect(markup).toContain('role="img"');
    expect(markup).toContain('aria-label="Photography pending for a catalogue item"');
    expect(markup).toContain("PHOTOGRAPHY PENDING");
    expect(markup).not.toContain("storefront-media-placeholder-mark");
  });

  it("keeps collection placeholders free of repeated brand marks", () => {
    const markup = renderToStaticMarkup(
      <StorefrontMediaPlaceholder
        variant="collection"
        label="Collection photography pending"
        caption="COLLECTION PHOTO PENDING"
      />,
    );

    expect(markup).toContain("COLLECTION PHOTO PENDING");
    expect(markup).not.toContain("storefront-media-placeholder-mark");
  });

  it("reserves the DAG signature for the single homepage hero", () => {
    const markup = renderToStaticMarkup(
      <StorefrontMediaPlaceholder
        variant="hero"
        label="Homepage photography pending"
        caption="PHOTOGRAPHY PENDING"
      />,
    );

    expect(markup).toContain("storefront-media-placeholder-mark");
    expect(markup).toContain(">DAG</span>");
  });
});
