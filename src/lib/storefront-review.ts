export type StorefrontReviewRoute = {
  id: string;
  path: string;
  area: "customer" | "operations";
  allowedStatuses: readonly number[];
};

/**
 * The automated route sweep intentionally runs without customer or owner
 * credentials. Dynamic product/collection routes may be 404 against the
 * empty CI catalogue; those results are captured and reviewed, not treated
 * as proof that real merchant content has been visually accepted.
 */
export const storefrontReviewRoutes = [
  { id: "home", path: "/", area: "customer", allowedStatuses: [200] },
  { id: "shop", path: "/shop", area: "customer", allowedStatuses: [200] },
  { id: "collection-banjara", path: "/collections/banjara", area: "customer", allowedStatuses: [200, 404] },
  { id: "product-preview", path: "/products/banjara-vintage-embroidered-jacket", area: "customer", allowedStatuses: [200, 404] },
  { id: "cart", path: "/cart", area: "customer", allowedStatuses: [200] },
  { id: "checkout", path: "/checkout", area: "customer", allowedStatuses: [200] },
  { id: "login", path: "/login", area: "customer", allowedStatuses: [200] },
  { id: "register", path: "/register", area: "customer", allowedStatuses: [200] },
  { id: "account", path: "/account", area: "customer", allowedStatuses: [200, 302, 307, 308] },
  { id: "account-recovery", path: "/account/recovery", area: "customer", allowedStatuses: [200] },
  { id: "wishlist", path: "/wishlist", area: "customer", allowedStatuses: [200, 302, 307, 308] },
  { id: "story", path: "/story", area: "customer", allowedStatuses: [200] },
  { id: "artisans", path: "/artisans", area: "customer", allowedStatuses: [200] },
  { id: "journal", path: "/journal", area: "customer", allowedStatuses: [200] },
  { id: "contact", path: "/contact", area: "customer", allowedStatuses: [200] },
  { id: "shipping", path: "/shipping", area: "customer", allowedStatuses: [200] },
  { id: "returns", path: "/returns", area: "customer", allowedStatuses: [200] },
  { id: "faq", path: "/faq", area: "customer", allowedStatuses: [200] },
  { id: "tracking", path: "/tracking", area: "customer", allowedStatuses: [200] },
  { id: "privacy", path: "/privacy", area: "customer", allowedStatuses: [200] },
  { id: "terms", path: "/terms", area: "customer", allowedStatuses: [200] },
  { id: "not-found", path: "/route-that-does-not-exist-review", area: "customer", allowedStatuses: [404] },
  { id: "admin-entry", path: "/admin", area: "operations", allowedStatuses: [200, 302, 307, 308, 401, 403] },
  { id: "owner-login", path: "/owner/login", area: "operations", allowedStatuses: [200] },
  { id: "storefront-visual-assets", path: "/storefront-visual-assets", area: "customer", allowedStatuses: [200] },
] as const satisfies readonly StorefrontReviewRoute[];

export const storefrontReviewViewports = [
  { id: "mobile-360", width: 360, height: 800 },
  { id: "mobile-414", width: 414, height: 896 },
  { id: "tablet-768", width: 768, height: 1024 },
  { id: "desktop-1440", width: 1440, height: 1000 },
  { id: "wide-1600", width: 1600, height: 1100 },
] as const;


/** Navigation is intentionally replaced by the capture loop; Chromium reports
 * canceled speculative requests as ERR_ABORTED, not as broken resources. */
export function isExpectedNavigationAbort(errorText: string | null | undefined): boolean {
  return Boolean(errorText && /net::ERR_ABORTED|net::ERR_CANCELED|ERR_BLOCKED_BY_CLIENT/i.test(errorText));
}
