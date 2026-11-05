import * as React from "react";
import Link from "next/link";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { StorefrontPageHeading } from "./StorefrontPageHeading";
import { StorefrontSectionHeading } from "./StorefrontSectionHeading";

describe("shared storefront headings", () => {
  it("keeps page title, description and route-specific masthead classes semantic", () => {
    const markup = renderToStaticMarkup(
      <StorefrontPageHeading
        eyebrow="DESERT ART GALLERY · ONLINE STORE"
        title={<>All products</>}
        description="Explore the published catalogue."
        id="shop-heading"
        className="atelier-page-heading atelier-page-heading--shop"
      >
        <Link className="text-link" href="/contact">Ask a question</Link>
      </StorefrontPageHeading>,
    );

    expect(markup).toContain('class="atelier-page-heading atelier-page-heading--shop"');
    expect(markup).toContain('<h1 id="shop-heading">All products</h1>');
    expect(markup).toContain("<p>Explore the published catalogue.</p>");
    expect(markup).toContain('href="/contact"');
  });

  it("supports a concise section heading with a real action and accessible target", () => {
    const markup = renderToStaticMarkup(
      <StorefrontSectionHeading
        eyebrow="THE ONLINE COLLECTION"
        title={<>Shop considered pieces</>}
        id="catalogue-heading"
        action={<Link className="text-link" href="/shop">View more products</Link>}
      />,
    );

    expect(markup).toContain('class="jp-home-section-heading"');
    expect(markup).toContain('<h2 id="catalogue-heading" class="section-title">Shop considered pieces</h2>');
    expect(markup).toContain('href="/shop"');
  });

  it("omits optional descriptions and actions instead of rendering empty placeholders", () => {
    const page = renderToStaticMarkup(
      <StorefrontPageHeading eyebrow="ACCOUNT" title="Your account" />,
    );
    const section = renderToStaticMarkup(
      <StorefrontSectionHeading eyebrow="DISCOVER" title="Find a starting point" />,
    );

    expect(page).not.toContain("<p>");
    expect(section).not.toContain("<p>");
    expect(section).not.toContain("undefined");
  });
});
