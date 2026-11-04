import Link from "next/link";
import { notFound } from "next/navigation";
import { getStorefrontProduct } from "@/lib/catalogue";
import { products, type ProductImage } from "@/lib/products";
import { amountInMajorUnits, formatMoneyFromMinor } from "@/lib/money";
import { formatProductMeasurements } from "@/lib/product-details";
import { buildProductEnquiryHref } from "@/lib/product-enquiry";
import type { Metadata } from "next";
import { AddToBagButton } from "@/components/AddToBagButton";
import { ProductGallery } from "@/components/ProductGallery";
import { getSiteUrl } from "@/lib/site-url";
import { WishlistToggle } from "@/components/WishlistToggle";

export function generateStaticParams() {
  return process.env.NODE_ENV === "development" ? products.map((product) => ({ slug: product.slug })) : [];
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const product = await getStorefrontProduct(slug);
  if (!product) return {};
  const description = product.seoDescription?.trim() || product.description?.trim() || product.note.trim();
  return {
    title: product.seoTitle?.trim() || product.name,
    ...(description ? { description } : {}),
    openGraph: {
      images: product.images?.length ? product.images.map((image) => image.url) : [product.image],
    },
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getStorefrontProduct(slug);
  if (!product) notFound();

  const variants = product.variants ?? [];
  const resolvedVariantPrices = variants
    .map((variant) => variant.priceMinor ?? product.priceMinor)
    .filter((price): price is number => price !== null && price !== undefined);
  const distinctVariantPrices = new Set(resolvedVariantPrices);
  const priceLabel = variants.length > 0 && distinctVariantPrices.size > 1
    ? "オプションを選択すると価格が表示されます"
    : product.priceMinor != null && product.currency
      ? formatMoneyFromMinor(resolvedVariantPrices[0] ?? product.priceMinor, product.currency)
      : "価格はお問い合わせください";
  const hasAvailableStock = variants.length > 0
    ? variants.some((variant) => variant.quantityOnHand > 0)
    : (product.quantityOnHand ?? 0) > 0;
  const galleryImages: ProductImage[] = product.images?.length
    ? product.images
    : [{
      id: "development-preview",
      url: product.image,
      altText: product.imageAlt || product.name,
      sortOrder: 0,
      isPrimary: true,
    }];

  const siteUrl = getSiteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(product.description || product.note ? { description: product.description || product.note } : {}),
    image: galleryImages.map((image) => new URL(image.url, siteUrl).toString()),
    ...(product.category ? { category: product.category } : {}),
    ...(product.id && product.priceMinor != null && product.currency ? {
      offers: {
        "@type": "Offer",
        priceCurrency: product.currency,
        price: amountInMajorUnits(resolvedVariantPrices[0] ?? product.priceMinor, product.currency),
        availability: hasAvailableStock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
        url: new URL("/products/" + product.slug, siteUrl).toString(),
      },
    } : {}),
  };

  const measurements = formatProductMeasurements(product.measurements);
  const materials = product.materials ?? [];
  const sizes = product.sizes ?? [];
  const hasProductInformation = Boolean(
    product.description || materials.length || sizes.length || measurements.length
      || product.conditionNotes || product.provenance || product.craftStory,
  );

  return (
    <div className="page-shell atelier-page-shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <nav className="breadcrumb atelier-breadcrumb" aria-label="パンくずリスト">
        <Link href="/shop">商品一覧</Link>
        {product.category ? <><span aria-hidden="true">/</span><span>{product.category}</span></> : null}
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="product-detail atelier-product-detail">
        <div className="atelier-product-gallery-wrap">
          <ProductGallery images={galleryImages} title={product.name} />
          {!product.id && <p className="atelier-image-disclaimer">開発用プレビューです。商品写真は公開前の確認が必要です。</p>}
        </div>
        <div className="detail-copy atelier-detail-copy">
          <div className="section-kicker">{product.category || "DESERT ART GALLERY"}</div>
          <h1 className="section-title">{product.name}</h1>
          {product.note && <div className="detail-note">{product.note}</div>}
          <div className="atelier-product-price-panel">
            <span className="section-kicker">価格</span>
            <div className="detail-price">{priceLabel}</div>
            {product.currency && <span>通貨: {product.currency}</span>}
            <span>税金・配送費は配送先と確定した注文内容に応じてご案内します。</span>
          </div>
          <div className="atelier-stock-note">
            <span className="atelier-stock-dot" />
            {product.id && !hasAvailableStock
              ? "現在の在庫はありません。お問い合わせください。"
              : product.id
                ? "在庫状況はご注文前に最終確認いたします。"
                : "プレビュー商品です。詳細と在庫はお問い合わせください。"}
          </div>
          <p className="product-purchase-guidance">
            ご購入前に商品情報をご確認ください。素材、サイズ、状態、配送についてご不明な点がございましたらお問い合わせください。
          </p>
          {product.id && product.priceMinor != null && product.currency && hasAvailableStock && (
            <AddToBagButton
              slug={product.slug}
              quantityOnHand={product.quantityOnHand ?? 0}
              variants={variants}
              priceMinor={product.priceMinor}
              currency={product.currency}
              isOneOfAKind={product.isOneOfAKind ?? false}
            />
          )}
          <WishlistToggle slug={product.slug} />
          <Link className="button-outline enquiry-button" href={buildProductEnquiryHref(product.slug)}>
            この商品について問い合わせる
          </Link>
          <div className="detail-footnote">
            Desert Art Gallery · Jaisalmer, Rajasthan, India<br />
            最終価格、在庫、配送費用はお支払い前にギャラリーへご確認ください。
          </div>
        </div>
      </div>

      <section className="product-information atelier-product-information" aria-labelledby="product-information-heading">
        <div className="section-kicker">PRODUCT INFORMATION</div>
        <h2 id="product-information-heading" className="section-title">商品について</h2>
        {hasProductInformation ? (
          <>
            {product.description && (
              <>
                <h3 className="product-information-label">商品説明</h3>
                <p className="product-long-description">{product.description}</p>
              </>
            )}
            <div className="product-accordion">
              {materials.length > 0 && <details><summary>素材</summary><p>{materials.join("、")}</p></details>}
              {sizes.length > 0 && <details><summary>サイズ・仕様</summary><p>{sizes.join("、")}</p></details>}
              {measurements.length > 0 && (
                <details><summary>寸法</summary>
                  <dl className="product-measurements">
                    {measurements.map((measurement) => (
                      <div key={measurement.label}><dt>{measurement.label}</dt><dd>{measurement.value}</dd></div>
                    ))}
                  </dl>
                </details>
              )}
              {product.conditionNotes && <details><summary>状態について</summary><p>{product.conditionNotes}</p></details>}
              {product.provenance && <details><summary>来歴</summary><p>{product.provenance}</p></details>}
              {product.craftStory && <details><summary>背景・ものづくり</summary><p>{product.craftStory}</p></details>}
            </div>
          </>
        ) : (
          <div className="atelier-product-details-pending">
            <p>この商品について、追加情報はまだ掲載されていません。</p>
            <p>素材、寸法、状態、来歴などは推測で補っていません。確認したい内容は上記のお問い合わせよりご連絡ください。</p>
          </div>
        )}
      </section>
      <div className="mobile-buy-bar">
        <div><b>{product.name}</b><span>{priceLabel}</span></div>
        <Link className="button-primary" href={buildProductEnquiryHref(product.slug)}>お問い合わせ</Link>
      </div>
    </div>
  );
}
