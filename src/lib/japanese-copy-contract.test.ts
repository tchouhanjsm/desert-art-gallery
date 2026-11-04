import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const publicInterfaceFiles = [
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
  "../app/login/page.tsx",
  "../app/login/customer-login-form.tsx",
  "../app/login/legacy-login-form.tsx",
  "../app/register/page.tsx",
  "../app/register/customer-register-form.tsx",
  "../app/account/page.tsx",
  "../app/account/customer-page.tsx",
  "../app/account/legacy-page.tsx",
  "../app/account/orders/[id]/page.tsx",
  "../app/wishlist/page.tsx",
  "../app/[slug]/page.tsx",
  "../app/not-found.tsx",
  "../components/Header.tsx",
  "../components/Footer.tsx",
  "../components/AddToBagButton.tsx",
  "../components/CartProvider.tsx",
  "../components/CartPageClient.tsx",
  "../components/CheckoutForm.tsx",
  "../components/StorefrontProductCard.tsx",
  "../components/ShopBrowser.tsx",
  "../components/ProductGallery.tsx",
  "../components/WishlistPageClient.tsx",
  "../components/WishlistToggle.tsx",
  "../lib/navigation.ts",
  "../lib/storefront-information.ts",
];

describe("English-language, Japanese-inspired storefront contract", () => {
  it("sets the public document language to English", () => {
    expect(source("../app/layout.tsx")).toContain('<html lang="en">');
    expect(source("../app/layout.tsx")).not.toContain('<html lang="ja">');
  });

  it("keeps customer-facing source copy in English across the whole shopping journey", () => {
    const japaneseText = /[\\u3000-\\u30ff\\u3400-\\u9fff]/;
    const offenders = publicInterfaceFiles.filter((path) => japaneseText.test(source(path)));
    expect(offenders, `Japanese UI copy remains in: ${offenders.join(", ")}`).toEqual([]);
  });

  it("retains the intended editorial ecommerce direction in English", () => {
    expect(source("../app/page.tsx")).toContain("CURATED COLLECTIONS");
    expect(source("../app/shop/page.tsx")).toContain("All products");
    expect(source("../app/products/[slug]/page.tsx")).toContain("ABOUT THIS PIECE");
    expect(source("../styles/japan-storefront.css")).toContain("--atelier-ivory");
  });

  it("clearly labels order drafts as unpaid", () => {
    const order = source("../app/account/orders/[id]/page.tsx");
    expect(order).toContain("This is an unpaid order draft");
    expect(order).toContain("No payment has been taken");
  });
});
