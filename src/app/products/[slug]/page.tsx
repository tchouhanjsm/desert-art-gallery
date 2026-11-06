import Link from "next/link";
import { notFound } from "next/navigation";
import { getStorefrontProduct, getStorefrontProducts } from "@/lib/catalogue";
import { products, type ProductImage } from "@/lib/products";
import { amountInMajorUnits, formatMoneyFromMinor } from "@/lib/money";
import { formatProductMeasurements } from "@/lib/product-details";
import { buildProductEnquiryHref } from "@/lib/product-enquiry";
import type { Metadata } from "next";
import { AddToBagButton } from "@/components/AddToBagButton";
import { ProductGallery } from "@/components/ProductGallery";
import { StorefrontMediaPlaceholder } from "@/components/StorefrontMediaPlaceholder";
import { getSiteUrl } from "@/lib/site-url";
import { WishlistToggle } from "@/components/WishlistToggle";
import { hasPurchasableProductOption, isPublishedProductRecord } from "@/lib/storefront-presentation";
import { StorefrontProductCard } from "@/components/StorefrontProductCard";

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
  const [product, catalogueProducts] = await Promise.all([getStorefrontProduct(slug), getStorefrontProducts()]);
  if (!product) notFound();

  const relatedByCollection = catalogueProducts.filter((candidate) =>
    candidate.slug !== product.slug
    && isPublishedProductRecord(candidate)
    && Boolean(candidate.collectionSlugs?.some((collectionSlug) => product.collectionSlugs?.includes(collectionSlug))),
  );
  const relatedProducts = [
    ...relatedByCollection,
    ...catalogueProducts.filter((candidate) =>
      candidate.slug !== product.slug
      && isPublishedProductRecord(candidate)
      && Boolean(product.category && candidate.category === product.category)
      && !relatedByCollection.some((related) => related.slug === candidate.slug),
    ),
  ].slice(0, 4);
  const relatedHeading = relatedByCollection.length > 0 ? "More from this collection" : "More from this category";
  const variants = product.variants ?? [];
  const activeVariants = variants.filter((variant) => variant.status === "active");
  const canAddToBag = hasPurchasableProductOption(product);
  const resolvedVariantPrices = activeVariants
    .map((variant) => variant.priceMinor ?? product.priceMinor)
    .filter((price): price is number => price !== null && price !== undefined);
  const distinctVariantPrices = new Set(resolvedVariantPrices);
  const priceLabel = variants.length > 0 && distinctVariantPrices.size > 1
    ? "Select an option to see the price"
    : product.priceMinor != null && product.currency
      ? formatMoneyFromMinor(resolvedVariantPrices[0] ?? product.priceMinor, product.currency)
      : "Price on request";
  const hasAvailableStock = variants.length > 0
    ? activeVariants.some((variant) => variant.quantityOnHand > 0)
    : (product.quantityOnHand ?? 0) > 0;
  const galleryImages: ProductImage[] = product.images ?? [];

  const siteUrl = getSiteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    ...(product.description || product.note ? { description: product.description || product.note } : {}),
    ...(galleryImages.length ? { image: galleryImages.map((image) => new URL(image.url, siteUrl).toString()) } : {}),
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
      <nav className="breadcrumb atelier-breadcrumb" aria-label="Breadcrumb navigation">
        <Link href="/shop">All products</Link>
        {product.category ? <><span aria-hidden="true">/</span><Link href={"/shop?category=" + encodeURIComponent(product.category)}>{product.category}</Link></> : null}
        <span aria-hidden="true">/</span>
        <span aria-current="page">{product.name}</span>
      </nav>

      <div className="product-detail atelier-product-detail">
        <div className="atelier-product-gallery-wrap">
          {galleryImages.length > 0 ? (
            <ProductGallery images={galleryImages} title={product.name} />
          ) : (
            <div className="detail-gallery-main product-image-wrap">
              <StorefrontMediaPlaceholder variant="product" label={"Photography pending for " + product.name} caption="PHOTOGRAPHY PENDING" />
            </div>
          )}
          {!product.id && <p className="atelier-image-disclaimer">Development preview. Product photography must be reviewed and approved before publication.</p>}
        </div>
        <div className="detail-copy atelier-detail-copy">
          <div className="section-kicker">{product.category || "DESERT ART GALLERY"}</div>
          <h1 className="section-title">{product.name}</h1>
          {product.note && <div className="detail-note">{product.note}</div>}
          <div className="atelier-product-price-panel">
            <span className="section-kicker">PRICE</span>
            <div className="detail-price">{priceLabel}</div>
            {product.currency && <span>Currency: {product.currency}</span>}
            <span>Taxes and shipping costs depend on the destination and confirmed order details.</span>
          </div>
          <div className="atelier-stock-note">
            <span className="atelier-stock-dot" />
            {product.id && !hasAvailableStock
              ? "Currently unavailable. Contact us for more information."
              : product.id
                ? "Availability will be confirmed before an order is placed."
                : "This is a preview listing. Contact us for product details and availability."}
          </div>
          <p className="product-purchase-guidance">
            Please review the product information before purchasing. Contact us with any questions about materials, dimensions, condition or delivery.
          </p>
          <div className="atelier-product-actions" id="purchase-options">
            {canAddToBag && (
              <AddToBagButton
                slug={product.slug}
                quantityOnHand={product.quantityOnHand ?? 0}
                variants={activeVariants}
                priceMinor={product.priceMinor ?? null}
                currency={product.currency ?? ""}
                isOneOfAKind={product.isOneOfAKind ?? false}
              />
            )}
            <WishlistToggle slug={product.slug} />
            <Link className="button-outline enquiry-button" href={buildProductEnquiryHref(product.slug)}>
              Ask about this piece
            </Link>
          </div>
          <div className="detail-footnote">
            Desert Art Gallery · Jaisalmer, Rajasthan, India<br />
            Please confirm the final price, availability and delivery costs with the gallery before making any payment.
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
                <h3 className="product-information-label">DESCRIPTION</h3>
                <p className="product-long-description">{product.description}</p>
              </>
            )}
            <div className="product-accordion">
              {materials.length > 0 && <details><summary>MATERIALS</summary><p>{materials.join(", ")}</p></details>}
              {sizes.length > 0 && <details><summary>SIZE & DETAILS</summary><p>{sizes.join(", ")}</p></details>}
              {measurements.length > 0 && (
                <details><summary>MEASUREMENTS</summary>
                  <dl className="product-measurements">
                    {measurements.map((measurement) => (
                      <div key={measurement.label}><dt>{measurement.label}</dt><dd>{measurement.value}</dd></div>
                    ))}
                  </dl>
                </details>
              )}
              {product.conditionNotes && <details><summary>CONDITION</summary><p>{product.conditionNotes}</p></details>}
              {product.provenance && <details><summary>PROVENANCE</summary><p>{product.provenance}</p></details>}
              {product.craftStory && <details><summary>CRAFT & CONTEXT</summary><p>{product.craftStory}</p></details>}
            </div>
          </>
        ) : (
          <div className="atelier-product-details-pending">
            <p>Additional information about this piece has not yet been published.</p>
            <p>We do not infer missing details about materials, measurements, condition or provenance. Please use the enquiry link above to ask us to verify anything you need to know.</p>
          </div>
        )}
      </section>
      {relatedProducts.length > 0 && (
        <section className="atelier-related-products" aria-labelledby="related-products-heading">
          <div className="atelier-related-heading">
            <div>
              <div className="section-kicker">MORE TO EXPLORE</div>
              <h2 id="related-products-heading" className="section-title">{relatedHeading}</h2>
            </div>
            <Link href={product.category ? "/shop?category=" + encodeURIComponent(product.category) : "/shop"} className="text-link">Browse related pieces</Link>
          </div>
          <div className="atelier-product-grid">
            {relatedProducts.map((related) => <StorefrontProductCard key={related.slug} product={related} />)}
          </div>
        </section>
      )}
      <div className="mobile-buy-bar">
        <div><b>{product.name}</b><span>{priceLabel}</span></div>
        {canAddToBag ? (
          <Link className="button-primary" href="#purchase-options" aria-label={"View buying options for " + product.name}>
            View buying options
          </Link>
        ) : (
          <Link className="button-primary" href={buildProductEnquiryHref(product.slug)}>
            Ask about this piece
          </Link>
        )}
      </div>
    </div>
  );
}
