import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layout = readFileSync(new URL("../app/layout.tsx", import.meta.url), "utf8");
const globalStyles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const storefrontStyles = readFileSync(new URL("../styles/japan-storefront.css", import.meta.url), "utf8");
const packageJson = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  dependencies?: Record<string, string>;
};

describe("English storefront typography", () => {
  it("loads local Latin font families without remote font requests", () => {
    expect(layout).toContain('@fontsource-variable/inter');
    expect(layout).toContain('@fontsource-variable/playfair-display');
    expect(layout).not.toContain("next/font/google");
    expect(globalStyles).not.toContain("fonts.googleapis.com");
    expect(storefrontStyles).toContain("--atelier-body: var(--font-body)");
    expect(storefrontStyles).toContain("--atelier-display: var(--font-display)");
    expect(storefrontStyles).not.toContain("Noto Sans JP");
    expect(storefrontStyles).not.toContain("Noto Serif JP");
  });

  it("uses the font packages already declared by the application", () => {
    const playfair = packageJson.dependencies?.["@fontsource-variable/playfair-display"] ?? "";
    const inter = packageJson.dependencies?.["@fontsource-variable/inter"] ?? "";
    expect(playfair.startsWith("5.") || playfair.startsWith("^5.")).toBe(true);
    expect(inter.startsWith("5.") || inter.startsWith("^5.")).toBe(true);
    expect(globalStyles).toContain("--font-display:");
    expect(globalStyles).toContain("--font-body:");
  });
});

describe("Japanese-inspired storefront style isolation", () => {
  it("keeps responsive storefront selectors scoped outside owner/admin UI", () => {
    expect(storefrontStyles).toContain(".jp-storefront .utility-row.jp-utility-row");
    expect(storefrontStyles).toContain(".jp-storefront .product-grid");
    expect(storefrontStyles).not.toContain(".atelier-product-grid, .product-grid");
  });

  it("keeps account and wishlist controls available on compact screens", () => {
    expect(storefrontStyles).not.toContain('.jp-utility-actions .icon-button[aria-label^="My account"]');
    expect(storefrontStyles).not.toContain(".jp-utility-actions .wishlist-link{ display:none");
  });

  it("collapses the five-column footer before tablet widths become cramped", () => {
    expect(storefrontStyles).toContain("@media (max-width: 1000px)");
    expect(storefrontStyles).toContain(".jp-storefront .jp-footer-main { grid-template-columns: repeat(2, minmax(0, 1fr)); }");
  });
});
