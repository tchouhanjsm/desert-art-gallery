import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { footerNavigation, primaryNavigation } from "./navigation";
import { getStorefrontInformationPage } from "./storefront-information";

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
      const hasStaticInformationPage = segments.length === 1
        && existsSync(join(process.cwd(), "src", "app", "[slug]", "page.tsx"))
        && getStorefrontInformationPage(segments[0]) !== null;
      expect(
        existsSync(pagePath) || hasStaticInformationPage,
        item.href + " should resolve to an implemented App Router page",
      ).toBe(true);
    }
  });
});
