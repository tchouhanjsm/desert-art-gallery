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
    ? "Choose an option to see the price"
    : product.priceMinor != null && product.currency
      ? formatMoneyFromMinor(resolvedVariantPrices[0] ?? product.priceMinor, product.currency)
      : "Contact us for pricing";
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
      <nav className="breadcrumb atelier-breadcrumb" aria-label="Breadcrumb">
        <Link href="/shop">Shop</Link>
        {product.category ? <><span aria-hidden="true">/</span><span>{product.category}</span></> : null}
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="product-detail atelier-product-detail">
        <div className="atelier-product-gallery-wrap">
          <ProductGallery images={galleryImages} title={product.name} />
          {!product.id && <p className="atelier-image-disclaimer">Development preview. Product photography must be reviewed before publication.</p>}
        </div>
        <div className="detail-copy atelier-detail-copy">
          <div className="section-kicker">{product.category || "DESERT ART GALLERY"}</div>
          <h1 className="section-title">{product.name}</h1>
          {product.note && <div className="detail-note">{product.note}</div>}
          <div className="atelier-product-price-panel">
            <span className="section-kicker">Price</span>
            <div className="detail-price">{priceLabel}</div>
            {product.currency && <span>Currency: {product.currency}</span>}
            <span>Taxes and shipping are based on the destination and confirmed order details.</span>
          </div>
          <div className="atelier-stock-note">
            <span className="atelier-stock-dot" />
            {product.id && !hasAvailableStock
              ? "Currently out of stock. Contact the gallery for availability."
              : product.id
                ? "Availability will be reconfirmed before an order is placed."
                : "This is a preview listing. Contact the gallery for details and availability."}
          </div>
          <p className="product-purchase-guidance">
            Please review the product information before purchase. Contact the gallery with any questions about materials, size, condition or shipping.
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
            Enquire about this piece
          </Link>
          <div className="detail-footnote">
            Desert Art Gallery · Jaisalmer, Rajasthan, India<br />
            Please confirm the final price, availability and shipping costs with the gallery before making payment.
          </div>
        </div>
      </div>

      <section className="product-information atelier-product-information" aria-labelledby="product-information-heading">
        <div className="section-kicker">PRODUCT INFORMATION</div>
        <h2 id="product-information-heading" className="section-title">ABOUT THIS PIECE</h2>
        {hasProductInformation ? (
          <>
            {product.description && (
              <>
                <h3 className="product-information-label">Description</h3>
                <p className="product-long-description">{product.description}</p>
              </>
            )}
            <div className="product-accordion">
              {materials.length > 0 && <details><summary>Materials</summary><p>{materials.join(", ")}</p></details>}
              {sizes.length > 0 && <details><summary>Size & specifications</summary><p>{sizes.join(", ")}</p></details>}
              {measurements.length > 0 && (
                <details><summary>Measurements</summary>
                  <dl className="product-measurements">
                    {measurements.map((measurement) => (
                      <div key={measurement.label}><dt>{measurement.label}</dt><dd>{measurement.value}</dd></div>
                    ))}
                  </dl>
                </details>
              )}
              {product.conditionNotes && <details><summary>Condition</summary><p>{product.conditionNotes}</p></details>}
              {product.provenance && <details><summary>Provenance</summary><p>{product.provenance}</p></details>}
              {product.craftStory && <details><summary>Craft and context</summary><p>{product.craftStory}</p></details>}
            </div>
          </>
        ) : (
          <div className="atelier-product-details-pending">
            <p>Additional information about this piece has not yet been published.</p>
            <p>We do not fill gaps in materials, measurements, condition or provenance with assumptions. Please contact the gallery with any questions.</p>
          </div>
        )}
      </section>
      <div className="mobile-buy-bar">
        <div><b>{product.name}</b><span>{priceLabel}</span></div>
        <Link className="button-primary" href={buildProductEnquiryHref(product.slug)}>Contact the gallery</Link>
      </div>
    </div>
  );
}
