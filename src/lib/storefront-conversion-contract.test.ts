import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("storefront conversion contract", () => {
  it("does not link product enquiries to an unverified email address", () => {
    const productPage = readFileSync(
      join(root, "src/app/products/[slug]/page.tsx"),
      "utf8",
    );
    expect(productPage).not.toContain("mailto:");
    expect(productPage).not.toContain("hello@desertartgallery.net");
    expect(productPage).toContain("buildProductEnquiryHref(product.slug)");
  });

  it("retains verified product context on the contact page without claiming to send a message", () => {
    const contactPage = readFileSync(join(root, "src/app/contact/page.tsx"), "utf8");
    expect(contactPage).toContain("searchParams");
    expect(contactPage).toContain("parseProductEnquirySlug(params.product)");
    expect(contactPage).toContain("getStorefrontProduct(requestedSlug)");
    expect(contactPage).toContain("メッセージは送信されていません");
  });

  it("offers a wishlist action outside the product link on each catalogue card", () => {
    const card = readFileSync(join(root, "src/components/StorefrontProductCard.tsx"), "utf8");
    expect(card).toContain("WishlistToggle slug={product.slug} compact");
    expect(card.indexOf("atelier-product-card-wishlist")).toBeLessThan(
      card.indexOf('<Link className="atelier-product-link"'),
    );
  });

  it("provides previous and next controls and selected thumbnail states in the gallery", () => {
    const gallery = readFileSync(join(root, "src/components/ProductGallery.tsx"), "utf8");
    expect(gallery).toContain("前の商品画像を見る");
    expect(gallery).toContain("次の商品画像を見る");
    expect(gallery).toContain('aria-pressed={activeIndex === index}');
    expect(gallery).toContain("aria-live=\"polite\"");
  });

  it("explains when merchant-supplied product detail fields are not available", () => {
    const productPage = readFileSync(
      join(root, "src/app/products/[slug]/page.tsx"),
      "utf8",
    );
    expect(productPage).toContain("この商品について、追加情報はまだ掲載されていません。");
    expect(productPage).toContain("素材、寸法、状態、来歴などは推測で補っていません。");
  });
});
