import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const customerInterfaceFiles = [
  "../app/layout.tsx",
  "../app/page.tsx",
  "../app/shop/page.tsx",
  "../app/collections/[slug]/page.tsx",
  "../app/products/[slug]/page.tsx",
  "../app/story/page.tsx",
  "../app/artisans/page.tsx",
  "../app/journal/page.tsx",
  "../app/contact/page.tsx",
  "../app/cart/page.tsx",
  "../app/checkout/page.tsx",
  "../app/wishlist/page.tsx",
  "../app/[slug]/page.tsx",
  "../app/not-found.tsx",
  "../app/login/customer-login-form.tsx",
  "../app/login/legacy-login-form.tsx",
  "../app/register/customer-register-form.tsx",
  "../app/account/customer-page.tsx",
  "../app/account/legacy-page.tsx",
  "../app/account/orders/[id]/page.tsx",
  "../components/Header.tsx",
  "../components/Footer.tsx",
  "../components/ShopBrowser.tsx",
  "../components/StorefrontProductCard.tsx",
  "../components/AddToBagButton.tsx",
  "../components/ProductGallery.tsx",
  "../components/WishlistToggle.tsx",
  "../components/WishlistPageClient.tsx",
  "../components/CartPageClient.tsx",
  "../components/CartProvider.tsx",
  "../components/CheckoutForm.tsx",
  "../lib/navigation.ts",
  "../lib/storefront-information.ts",
];

describe("English-language, Japan-informed storefront contract", () => {
  it("declares English as the document language", () => {
    expect(source("../app/layout.tsx")).toContain('<html lang="en">');
    expect(source("../app/layout.tsx")).not.toContain('<html lang="ja">');
  });

  it("keeps all source-authored customer interface copy in English", () => {
    const cjkCharacters = /[\u3040-\u30ff\u3400-\u9fff]/u;
    for (const file of customerInterfaceFiles) {
      expect(source(file), file).not.toMatch(cjkCharacters);
    }
  });

  it("retains Japanese retail design conventions without Japanese-language UI", () => {
    const home = source("../app/page.tsx");
    const header = source("../components/Header.tsx");
    const navigation = source("../lib/navigation.ts");
    const storefrontStyles = source("../styles/japan-storefront.css");

    expect(home).toContain("CURATED COLLECTIONS");
    expect(header).toContain("Search products or keywords");
    expect(navigation).toContain('label: "Shop all"');
    expect(storefrontStyles).toContain("Japan-inspired storefront system");
  });

  it("keeps checkout and order-draft payment safeguards explicit", () => {
    const checkout = source("../components/CheckoutForm.tsx");
    const order = source("../app/account/orders/[id]/page.tsx");

    expect(checkout).toContain("no payment is collected");
    expect(checkout).toContain("order draft only");
    expect(order).toContain("This is an unpaid order draft.");
    expect(order).toContain("No payment has been requested or received.");
  });
});
