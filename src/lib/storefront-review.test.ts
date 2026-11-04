import { describe, expect, it } from "vitest";
import { storefrontReviewRoutes, storefrontReviewViewports } from "./storefront-review";

describe("storefront visual review matrix", () => {
  it("defines unique, rooted route entries with explicit accepted statuses", () => {
    const ids = storefrontReviewRoutes.map((route) => route.id);
    expect(new Set(ids).size).toBe(ids.length);

    for (const route of storefrontReviewRoutes) {
      expect(route.path.startsWith("/")).toBe(true);
      expect(route.allowedStatuses.length).toBeGreaterThan(0);
    }
  });

  it("covers customer shopping, account, support and policy routes", () => {
    const paths = new Set<string>(storefrontReviewRoutes.map((route) => route.path));
    for (const path of [
      "/", "/shop", "/cart", "/checkout", "/login", "/register", "/account",
      "/account/recovery", "/wishlist", "/story", "/artisans", "/journal",
      "/contact", "/shipping", "/returns", "/faq", "/tracking", "/privacy", "/terms",
    ]) {
      expect(paths.has(path), `Missing visual review route: ${path}`).toBe(true);
    }
  });

  it("keeps operations entry points explicitly identified", () => {
    expect(storefrontReviewRoutes.filter((route) => route.area === "operations").map((route) => route.path))
      .toEqual(["/admin", "/owner/login"]);
  });

  it("covers the required mobile, tablet, desktop and wide-desktop widths", () => {
    expect(storefrontReviewViewports.map((viewport) => viewport.width))
      .toEqual([360, 414, 768, 1440, 1600]);
  });
});
