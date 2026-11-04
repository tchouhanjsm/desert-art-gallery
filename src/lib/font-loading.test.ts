import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layout = readFileSync(
  new URL("../app/layout.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../app/globals.css", import.meta.url),
  "utf8",
);
const japanStyles = readFileSync(
  new URL("../styles/japan-storefront.css", import.meta.url),
  "utf8",
);
const packageJson = JSON.parse(readFileSync(
  new URL("../../package.json", import.meta.url),
  "utf8",
)) as { dependencies?: Record<string, string> };

describe("self-hosted typography", () => {
  it("does not require a remote Google Fonts fetch during the production build", () => {
    expect(layout).not.toContain("next/font/google");
    expect(layout).toContain("@fontsource-variable/playfair-display");
    expect(layout).toContain("@fontsource-variable/inter");
  });

  it("declares pinned font packages and the CSS family tokens used by the design system", () => {
    expect(packageJson.dependencies?.["@fontsource-variable/playfair-display"]).toMatch(/^\^?5\./);
    expect(packageJson.dependencies?.["@fontsource-variable/inter"]).toMatch(/^\^?5\./);
    expect(styles).toContain("--font-display:");
    expect(styles).toContain("--font-body:");
  });
});


describe("Japanese storefront style isolation", () => {
  it("scopes responsive product and utility selectors to the customer shell", () => {
    expect(japanStyles).toContain(".jp-storefront .utility-row.jp-utility-row");
    expect(japanStyles).toContain(".jp-storefront .product-grid");
    expect(japanStyles).not.toContain(".atelier-product-grid, .product-grid");
  });
});


describe("mobile customer navigation and footer layout", () => {
  it("keeps account and wishlist controls available in the compact header", () => {
    expect(japanStyles).not.toContain('.jp-utility-actions .icon-button[aria-label^="マイページ"]');
    expect(japanStyles).not.toContain(".jp-utility-actions .wishlist-link{ display:none");
  });

  it("collapses the five-column footer before tablet widths become cramped", () => {
    expect(japanStyles).toContain("@media (max-width: 1000px)");
    expect(japanStyles).toContain(".jp-storefront .jp-footer-main { grid-template-columns: repeat(2, minmax(0, 1fr)); }");
  });
});
