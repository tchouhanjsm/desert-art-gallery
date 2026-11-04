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

  const description = product.seoDescription?.trim()
    || product.description?.trim()
    || product.note.trim();

  return {
    title: product.seoTitle?.trim() || product.name,
    ...(description ? { description } : {}),
    openGraph: {
      images: product.images?.length
        ? product.images.map((image) => image.url)
        : [product.image],
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
    ? "Select an option to view its price"
    : product.priceMinor != null && product.currency
      ? formatMoneyFromMinor(resolvedVariantPrices[0] ?? product.priceMinor, product.currency)
      : "Price available on enquiry";
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
    product.description
    || materials.length
    || sizes.length
    || measurements.length
    || product.conditionNotes
    || product.provenance
    || product.craftStory,
  );

  return (
    <div className="page-shell atelier-page-shell">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
      <div className="breadcrumb atelier-breadcrumb">
        <Link href="/shop">THE GALLERY</Link>
        {product.category ? <><span aria-hidden="true">/</span><span>{product.category}</span></> : null}
        <span aria-hidden="true">/</span>
        <span>{product.name}</span>
      </div>
      <div className="product-detail atelier-product-detail">
        <div className="atelier-product-gallery-wrap">
          <ProductGallery images={galleryImages} title={product.name} />
          {!product.id && <p className="atelier-image-disclaimer">Development preview · original product photography awaits gallery approval.</p>}
        </div>
        <div className="detail-copy atelier-detail-copy">
          <div className="section-kicker">{product.category || "FROM THE GALLERY"}</div>
          <h1 className="section-title">{product.name}</h1>
          {product.note && <div className="detail-note">{product.note}</div>}
          <div className="atelier-product-price-panel">
            <div className="detail-price">{priceLabel}</div>
            <span>{product.priceMinor != null ? "Price shown for this listing" : "Ask the gallery for current pricing"}</span>
          </div>
          <div className="atelier-stock-note">
            <span className="atelier-stock-dot" />
            {product.id && !hasAvailableStock
              ? "No current stock recorded — contact the gallery"
              : product.id
                ? "Availability is subject to final confirmation"
                : "Preview listing — contact the gallery to confirm details"}
          </div>
          <p className="product-purchase-guidance">
            Review the information supplied for this listing. Contact the gallery if you need clarification before making a purchase decision.
          </p>
          {product.id
            && product.priceMinor != null
            && product.currency
            && hasAvailableStock
            && <AddToBagButton
              slug={product.slug}
              quantityOnHand={product.quantityOnHand ?? 0}
              variants={variants}
              priceMinor={product.priceMinor}
              currency={product.currency}
              isOneOfAKind={product.isOneOfAKind ?? false}
            />}
          <WishlistToggle slug={product.slug} />
          <Link
            className="button-outline enquiry-button"
            href={buildProductEnquiryHref(product.slug)}
          >
            Enquire about this piece <span aria-hidden="true">↗</span>
          </Link>
          <div className="detail-footnote">
            Desert Art Gallery · Jaisalmer, Rajasthan, India<br />
            Confirm the final price, availability and delivery charges with the gallery before payment.
          </div>
        </div>
      </div>

      <section className="product-information atelier-product-information" aria-labelledby="product-information-heading">
        <div className="section-kicker">THE DETAILS</div>
        <h2 id="product-information-heading" className="section-title">More about this <em>piece.</em></h2>
        {hasProductInformation ? (
          <>
            {product.description && <p className="product-long-description">{product.description}</p>}
            <div className="product-accordion">
              {materials.length > 0 && <details><summary>Materials</summary><p>{materials.join(", ")}</p></details>}
              {sizes.length > 0 && <details><summary>Sizes</summary><p>{sizes.join(", ")}</p></details>}
              {measurements.length > 0 && (
                <details><summary>Measurements</summary>
                  <dl className="product-measurements">
                    {measurements.map((measurement) => (
                      <div key={measurement.label}><dt>{measurement.label}</dt><dd>{measurement.value}</dd></div>
                    ))}
                  </dl>
                </details>
              )}
              {product.conditionNotes && <details><summary>Condition notes</summary><p>{product.conditionNotes}</p></details>}
              {product.provenance && <details><summary>Provenance</summary><p>{product.provenance}</p></details>}
              {product.craftStory && <details><summary>Additional story</summary><p>{product.craftStory}</p></details>}
            </div>
          </>
        ) : (
          <div className="atelier-product-details-pending">
            <p>Additional product details have not yet been supplied for this listing.</p>
            <p>Materials, measurements, condition and provenance are not assumed. Use the product enquiry link above to retain this piece&apos;s context when contacting the gallery.</p>
          </div>
        )}
      </section>
      <div className="mobile-buy-bar">
        <div><b>{product.name}</b><span>{priceLabel}</span></div>
        <Link className="button-primary" href={buildProductEnquiryHref(product.slug)}>Enquire</Link>
      </div>
    </div>
  );
}
