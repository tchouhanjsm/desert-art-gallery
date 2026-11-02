import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { footerNavigation, primaryNavigation } from "./navigation";

describe("storefront navigation", () => {
  it("uses unique primary navigation destinations", () => {
    const destinations = primaryNavigation.map((item) => item.href);
    expect(new Set(destinations).size).toBe(destinations.length);
  });

  it("links only to implemented App Router pages", () => {
    const links = [
      ...primaryNavigation,
      ...footerNavigation.flatMap((section) => section.links),
    ];

    for (const item of links) {
      const route = item.href.split(/[?#]/, 1)[0];
      const segments = route.split("/").filter(Boolean);
      const pagePath = join(process.cwd(), "src", "app", ...segments, "page.tsx");
      expect(existsSync(pagePath), item.href + " should resolve to an implemented route").toBe(true);
    }
  });
});
